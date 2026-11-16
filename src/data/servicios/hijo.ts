// M5 — Lado del hijo: tareas de hoy, iniciar / finalizar, evidencia y progreso.
import { type BaseDeDatos, modificar } from '../db';
import { ErrorApp } from '../errores';
import { aplicar } from '../estados';
import { claveDia, inicioSemana, rangoDias, sumarDias } from '../fechas';
import type { Usuario } from '../tipos';
import { avisarPadres } from './avisos';
import { aTiempo, estaHecha, racha } from './estadisticas';
import { leerSincronizado, type OcurrenciaVista, sincronizar, vistas } from './tareas';

/** El botón Iniciar se activa este número de minutos antes de la hora de inicio. */
export const MINUTOS_ANTES_PARA_INICIAR = 10;

export type GrupoHoy = 'ahora' | 'mas_tarde' | 'atrasadas' | 'hechas';

export function grupoDe(oc: OcurrenciaVista, ahora = new Date()): GrupoHoy {
  if (oc.estado === 'atrasada') return 'atrasadas';
  if (oc.estado === 'iniciada') return 'ahora';
  if (oc.estado === 'programada') return puedeIniciarYa(oc, ahora) ? 'ahora' : 'mas_tarde';
  return 'hechas';
}

export function puedeIniciarYa(oc: Pick<OcurrenciaVista, 'inicioProgramado'>, ahora = new Date()) {
  return new Date(oc.inicioProgramado).getTime() - MINUTOS_ANTES_PARA_INICIAR * 60_000 <= ahora.getTime();
}

/** La agenda del hijo para hoy (sin propuestas). */
export async function tareasDeHoy(hijo: Usuario): Promise<OcurrenciaVista[]> {
  const db = await leerSincronizado(hijo.familiaId);
  const hoy = claveDia(new Date());
  return vistas(db, hijo.familiaId, (o, t) => t.asignadoA === hijo.id && o.fecha === hoy && o.estado !== 'propuesta').filter(
    (o) => !(o.tarea.origen === 'propuesta' && o.estado === 'rechazada' && !o.iniciadaEn),
  );
}

export async function ocurrenciaDelHijo(hijo: Usuario, id: string): Promise<OcurrenciaVista | null> {
  const db = await leerSincronizado(hijo.familiaId);
  return vistas(db, hijo.familiaId, (o, t) => o.id === id && t.asignadoA === hijo.id)[0] ?? null;
}

function exigirMia(db: BaseDeDatos, hijoId: string, id: string) {
  const hijo = db.usuarios.find((u) => u.id === hijoId && u.rol === 'hijo' && u.estado === 'activo');
  if (!hijo) throw new ErrorApp('Tu cuenta ya no está activa.');
  const oc = db.ocurrencias.find((o) => o.id === id);
  const tarea = oc && db.tareas.find((t) => t.id === oc.tareaId);
  if (!oc || !tarea || tarea.asignadoA !== hijoId) throw new ErrorApp('Esta tarea ya no existe.');
  return { hijo, oc, tarea };
}

export async function iniciarTarea(hijoId: string, id: string): Promise<void> {
  await modificar((db) => {
    const { hijo, oc } = exigirMia(db, hijoId, id);
    const ahora = new Date();
    sincronizar(db, hijo.familiaId, ahora);
    if (oc.estado === 'programada' && !puedeIniciarYa(oc, ahora)) {
      throw new ErrorApp(`Todavía no. Podrás iniciarla ${MINUTOS_ANTES_PARA_INICIAR} minutos antes de la hora.`);
    }
    if (oc.estado === 'atrasada' && oc.fecha !== claveDia(ahora)) {
      throw new ErrorApp('Esta tarea ya pasó. Puedes justificarla en Propuestas.');
    }
    const tarde = oc.estado === 'atrasada';
    aplicar(oc, 'iniciar', 'hijo', ahora);
    oc.iniciadaEn = ahora.toISOString();
    const tarea = db.tareas.find((t) => t.id === oc.tareaId)!;
    avisarPadres(db, hijo, oc, 'inicio', `${hijo.nombre} inició ${tarea.titulo}`, tarde ? 'La inició tarde.' : 'A tiempo.');
  });
}

export async function guardarEvidencia(hijoId: string, id: string, uri: string | null): Promise<void> {
  await modificar((db) => {
    const { oc } = exigirMia(db, hijoId, id);
    if (oc.estado !== 'iniciada') throw new ErrorApp('Primero inicia la tarea.');
    oc.evidenciaUrl = uri;
  });
}

export async function finalizarTarea(hijoId: string, id: string): Promise<void> {
  await modificar((db) => {
    const { hijo, oc, tarea } = exigirMia(db, hijoId, id);
    if (tarea.requiereFoto && !oc.evidenciaUrl) throw new ErrorApp('Esta tarea necesita una foto antes de finalizar.');
    const ahora = new Date();
    aplicar(oc, 'finalizar', 'hijo', ahora);
    oc.finalizadaEn = ahora.toISOString();
    avisarPadres(db, hijo, oc, 'fin', `${hijo.nombre} terminó ${tarea.titulo}`, oc.evidenciaUrl ? 'Revísala: incluye foto.' : 'Revísala y califícala.');
  });
}

// ---------- Progreso ----------

export interface Progreso {
  desde: string;
  hasta: string;
  porDia: { dia: string; total: number; completadas: number }[];
  completadasSemana: number;
  totalSemana: number;
  porcentajeATiempo: number | null;
  racha: number;
  puntosTotales: number;
  puntosSemana: number;
  /** Satisfacción de los padres en la semana. */
  promedioEstrellas: number | null;
  calificadasSemana: number;
  ultimas: OcurrenciaVista[];
}

export async function progresoDelHijo(hijo: Usuario, diaSemana: string): Promise<Progreso> {
  const db = await leerSincronizado(hijo.familiaId);
  const hoy = claveDia(new Date());
  const desde = inicioSemana(diaSemana);
  const hasta = sumarDias(desde, 6);
  const todas = vistas(db, hijo.familiaId, (_o, t) => t.asignadoA === hijo.id).filter(
    (o) => o.estado !== 'propuesta' && !(o.tarea.origen === 'propuesta' && o.estado === 'rechazada' && !o.iniciadaEn),
  );
  const semana = todas.filter((o) => o.fecha >= desde && o.fecha <= hasta && o.fecha <= hoy);
  const hechas = semana.filter(estaHecha);
  const calificadas = semana.filter((o) => o.estado === 'aprobada' && o.calificacion);
  const puntos = (lista: OcurrenciaVista[]) =>
    lista.filter((o) => o.estado === 'aprobada').reduce((s, o) => s + (o.tarea.puntos ?? 0), 0);

  return {
    desde,
    hasta,
    porDia: rangoDias(desde, hasta).map((dia) => {
      const delDia = semana.filter((o) => o.fecha === dia);
      return { dia, total: delDia.length, completadas: delDia.filter(estaHecha).length };
    }),
    completadasSemana: hechas.length,
    totalSemana: semana.length,
    porcentajeATiempo: hechas.length ? Math.round((hechas.filter(aTiempo).length / hechas.length) * 100) : null,
    racha: racha(todas, hoy),
    puntosTotales: puntos(todas),
    puntosSemana: puntos(semana),
    promedioEstrellas: calificadas.length
      ? calificadas.reduce((s, o) => s + (o.calificacion ?? 0), 0) / calificadas.length
      : null,
    calificadasSemana: calificadas.length,
    ultimas: todas
      .filter((o) => o.revisadaEn && (o.estado === 'aprobada' || o.estado === 'rechazada'))
      .sort((a, b) => (b.revisadaEn ?? '').localeCompare(a.revisadaEn ?? '') || b.fecha.localeCompare(a.fecha))
      .slice(0, 8),
  };
}
