// Cálculos de M2 (y luego M5): resumen por hijo, racha, dashboard de cumplimiento.
import type { BaseDeDatos } from '../db';
import { FUERA_DE_AGENDA, HECHAS } from '../estados';
import { claveDia, inicioSemana, rangoDias, sumarDias } from '../fechas';
import type { Categoria, Usuario } from '../tipos';
import { leerSincronizado, type OcurrenciaVista, vistas } from './tareas';

const enAgenda = (o: OcurrenciaVista) => !FUERA_DE_AGENDA.includes(o.estado) && !esPropuestaRechazada(o);
const esPropuestaRechazada = (o: OcurrenciaVista) => o.tarea.origen === 'propuesta' && o.revisadaEn && o.estado === 'rechazada' && !o.iniciadaEn;
export const estaHecha = (o: OcurrenciaVista) => HECHAS.includes(o.estado);
export const aTiempo = (o: OcurrenciaVista) => !!o.finalizadaEn && o.finalizadaEn <= o.limiteProgramado;

/**
 * Días seguidos (hacia atrás) en los que el hijo terminó todas sus tareas.
 * Hoy cuenta solo si ya terminó todo; los días sin tareas no rompen la racha.
 */
export function racha(ocs: OcurrenciaVista[], diaHoy: string): number {
  const porDia = new Map<string, OcurrenciaVista[]>();
  for (const o of ocs) if (enAgenda(o)) porDia.set(o.fecha, [...(porDia.get(o.fecha) ?? []), o]);
  const completo = (dia: string) => (porDia.get(dia) ?? []).every(estaHecha);

  let n = 0;
  let dia = diaHoy;
  if (porDia.has(dia) && completo(dia)) n++;
  const primero = [...porDia.keys()].sort()[0];
  for (dia = sumarDias(diaHoy, -1); primero && dia >= primero; dia = sumarDias(dia, -1)) {
    if (!porDia.has(dia)) continue;
    if (!completo(dia)) break;
    n++;
  }
  return n;
}

export interface ResumenHijo {
  hijo: Usuario;
  hechasHoy: number;
  totalHoy: number;
  enCurso: OcurrenciaVista | null;
  atrasadasHoy: number;
  racha: number;
}

function resumenDe(hijo: Usuario, ocs: OcurrenciaVista[], diaHoy: string): ResumenHijo {
  const deHoy = ocs.filter((o) => o.fecha === diaHoy && enAgenda(o));
  return {
    hijo,
    hechasHoy: deHoy.filter(estaHecha).length,
    totalHoy: deHoy.length,
    enCurso: deHoy.find((o) => o.estado === 'iniciada') ?? null,
    atrasadasHoy: deHoy.filter((o) => o.estado === 'atrasada').length,
    racha: racha(ocs, diaHoy),
  };
}

function hijosActivos(db: BaseDeDatos, familiaId: string) {
  return db.usuarios
    .filter((u) => u.familiaId === familiaId && u.rol === 'hijo' && u.estado === 'activo')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

export async function resumenHijos(familiaId: string): Promise<ResumenHijo[]> {
  const db = await leerSincronizado(familiaId);
  const diaHoy = claveDia(new Date());
  const todas = vistas(db, familiaId, () => true);
  return hijosActivos(db, familiaId).map((h) =>
    resumenDe(
      h,
      todas.filter((o) => o.hijo.id === h.id),
      diaHoy,
    ),
  );
}

// ---------- Dashboard ----------

export type Periodo = 'dia' | 'semana';

export interface FiltroDashboard {
  periodo: Periodo;
  /** Día de referencia `YYYY-MM-DD`; en semana se usa su lunes. */
  dia: string;
  hijoId: string | null;
  categoria: Categoria | null;
}

export interface Dashboard {
  desde: string;
  hasta: string;
  total: number;
  completadas: number;
  aTiempo: number;
  tarde: number;
  pendientes: number;
  porDia: { dia: string; total: number; completadas: number }[];
  porCategoria: Record<Categoria, { total: number; completadas: number }>;
  hijos: Usuario[];
}

export async function dashboard(familiaId: string, f: FiltroDashboard): Promise<Dashboard> {
  const db = await leerSincronizado(familiaId);
  const desde = f.periodo === 'dia' ? f.dia : inicioSemana(f.dia);
  const hasta = f.periodo === 'dia' ? f.dia : sumarDias(desde, 6);
  const diaHoy = claveDia(new Date());

  const ocs = vistas(
    db,
    familiaId,
    (o, t) =>
      o.fecha >= desde &&
      o.fecha <= hasta &&
      o.fecha <= diaHoy &&
      (!f.hijoId || t.asignadoA === f.hijoId) &&
      (!f.categoria || t.categoria === f.categoria),
  ).filter(enAgenda);

  const hechas = ocs.filter(estaHecha);
  const porCategoria: Dashboard['porCategoria'] = {
    domestica: { total: 0, completadas: 0 },
    escolar: { total: 0, completadas: 0 },
  };
  for (const o of ocs) {
    porCategoria[o.tarea.categoria].total++;
    if (estaHecha(o)) porCategoria[o.tarea.categoria].completadas++;
  }

  return {
    desde,
    hasta,
    total: ocs.length,
    completadas: hechas.length,
    aTiempo: hechas.filter(aTiempo).length,
    tarde: hechas.filter((o) => !aTiempo(o)).length,
    pendientes: ocs.length - hechas.length,
    porDia: rangoDias(desde, hasta).map((dia) => {
      const delDia = ocs.filter((o) => o.fecha === dia);
      return { dia, total: delDia.length, completadas: delDia.filter(estaHecha).length };
    }),
    porCategoria,
    hijos: hijosActivos(db, familiaId),
  };
}

// ---------- Detalle del hijo ----------

export interface DetalleHijo extends ResumenHijo {
  agendaHoy: OcurrenciaVista[];
  /** Días anteriores (más reciente primero) con sus ocurrencias. */
  historial: { dia: string; ocurrencias: OcurrenciaVista[] }[];
  calificacionPromedio: number | null;
  calificaciones: number;
  puntos: number;
}

export async function detalleHijo(familiaId: string, hijoId: string, diasHistorial = 14): Promise<DetalleHijo | null> {
  const db = await leerSincronizado(familiaId);
  const hijo = hijosActivos(db, familiaId).find((h) => h.id === hijoId);
  if (!hijo) return null;
  const diaHoy = claveDia(new Date());
  const ocs = vistas(db, familiaId, (_o, t) => t.asignadoA === hijoId);
  const calificadas = ocs.filter((o) => o.estado === 'aprobada' && o.calificacion);

  const historial: DetalleHijo['historial'] = [];
  for (let i = 1; i <= diasHistorial; i++) {
    const dia = sumarDias(diaHoy, -i);
    const delDia = ocs.filter((o) => o.fecha === dia && enAgenda(o));
    if (delDia.length) historial.push({ dia, ocurrencias: delDia });
  }

  return {
    ...resumenDe(hijo, ocs, diaHoy),
    agendaHoy: ocs.filter((o) => o.fecha === diaHoy && enAgenda(o)),
    historial,
    calificacionPromedio: calificadas.length
      ? calificadas.reduce((s, o) => s + (o.calificacion ?? 0), 0) / calificadas.length
      : null,
    calificaciones: calificadas.length,
    puntos: ocs.filter((o) => o.estado === 'aprobada').reduce((s, o) => s + (o.tarea.puntos ?? 0), 0),
  };
}
