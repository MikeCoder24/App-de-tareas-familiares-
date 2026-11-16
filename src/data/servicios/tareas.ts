// Tareas y ocurrencias: generación, revisión del padre (M2) y consultas.
import { nuevoId } from '../cripto';
import { ajustar, type BaseDeDatos, leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import { aplicar } from '../estados';
import { capitalizar, CODIGOS_DIA, type CodigoDia, claveDia, conHoraDe, deClave, formatoHora, rangoDias } from '../fechas';
import type { Categoria, Ocurrencia, Tarea, Usuario } from '../tipos';
import { exigirCupoRutinas } from '../planes';
import { avisarHijo, cuando } from './avisos';
import { exigirPadreActivo } from './permisos';

/** Ocurrencia con su tarea y el hijo asignado, lista para pintar. */
export interface OcurrenciaVista extends Ocurrencia {
  tarea: Tarea;
  hijo: Usuario;
}

// ---------- Repetición ----------

export function diasDeRegla(regla: string | null): CodigoDia[] | 'diario' | null {
  if (!regla) return null;
  if (regla.includes('FREQ=DAILY')) return 'diario';
  const byday = /BYDAY=([A-Z,]+)/.exec(regla)?.[1];
  return byday ? (byday.split(',').filter((d) => CODIGOS_DIA.includes(d as CodigoDia)) as CodigoDia[]) : null;
}

export function reglaDeDias(dias: CodigoDia[] | 'diario' | null): string | null {
  if (!dias) return null;
  if (dias === 'diario' || dias.length === 7) return 'FREQ=DAILY';
  return `FREQ=WEEKLY;BYDAY=${dias.join(',')}`;
}

function tocaEnDia(tarea: Tarea, clave: string): boolean {
  const primerDia = claveDia(new Date(tarea.horaInicio));
  if (clave < primerDia) return false;
  const dias = diasDeRegla(tarea.repeticion);
  if (dias === null) return clave === primerDia;
  if (dias === 'diario') return true;
  return dias.includes(CODIGOS_DIA[deClave(clave).getDay()]);
}

function nuevaOcurrencia(tarea: Tarea, clave: string, ahora: Date): Ocurrencia {
  const inicio = conHoraDe(clave, tarea.horaInicio);
  const duracion = new Date(tarea.horaLimite).getTime() - new Date(tarea.horaInicio).getTime();
  return {
    id: nuevoId(),
    tareaId: tarea.id,
    fecha: clave,
    inicioProgramado: inicio.toISOString(),
    limiteProgramado: new Date(inicio.getTime() + duracion).toISOString(),
    estado: tarea.origen === 'propuesta' ? 'propuesta' : 'programada',
    iniciadaEn: null,
    finalizadaEn: null,
    calificacion: null,
    comentario: null,
    motivoRechazo: null,
    motivoPropuesta: null,
    justificacion: null,
    justificacionFotoUrl: null,
    evidenciaUrl: null,
    revisadaEn: null,
    actualizadaEn: ahora.toISOString(),
  };
}

/**
 * Mantenimiento: crea las ocurrencias que falten hasta hoy y marca como atrasadas
 * las programadas cuya hora límite ya pasó. Devuelve true si cambió algo.
 */
export function sincronizar(db: BaseDeDatos, familiaId: string, ahora = new Date(), diasExtra = 0): boolean {
  let cambio = false;
  const diaHoy = claveDia(ahora);
  /** Hasta qué día se generan rutinas (los recordatorios piden también mañana, sin guardarlo). */
  const diaTope = diasExtra ? claveDia(new Date(ahora.getTime() + diasExtra * 86_400_000)) : diaHoy;
  const existentes = new Set(db.ocurrencias.map((o) => `${o.tareaId}|${o.diaOrigen ?? o.fecha}`));

  for (const t of db.tareas) {
    if (t.familiaId !== familiaId || t.cancelada) continue;
    const primerDia = claveDia(new Date(t.horaInicio));
    // Una sola vez: su único día (aunque sea futuro). Rutina: hasta hoy.
    const hasta = t.repeticion ? diaTope : primerDia;
    if (primerDia > hasta) continue;
    for (const clave of rangoDias(primerDia, hasta)) {
      if (!tocaEnDia(t, clave) || existentes.has(`${t.id}|${clave}`)) continue;
      db.ocurrencias.push(nuevaOcurrencia(t, clave, ahora));
      existentes.add(`${t.id}|${clave}`);
      cambio = true;
    }
  }

  const tareasFamilia = new Set(db.tareas.filter((t) => t.familiaId === familiaId).map((t) => t.id));
  for (const o of db.ocurrencias) {
    if (o.estado === 'programada' && tareasFamilia.has(o.tareaId) && new Date(o.limiteProgramado) < ahora) {
      aplicar(o, 'vencer', 'sistema', ahora);
      cambio = true;
    }
  }
  return cambio;
}

/** Lee la base ya sincronizada para la familia. */
export async function leerSincronizado(familiaId: string): Promise<BaseDeDatos> {
  await ajustar((db) => sincronizar(db, familiaId));
  return leer();
}

// ---------- Alta (la usa M3 y los datos de prueba) ----------

export interface DatosTarea {
  titulo: string;
  categoria: Categoria;
  asignadoA: string;
  horaInicio: Date;
  horaLimite: Date;
  repeticion: string | null;
  recordatorioMin?: number;
  requiereFoto?: boolean;
  puntos?: number | null;
  notas?: string;
  origen?: Tarea['origen'];
}

export function insertarTarea(db: BaseDeDatos, familiaId: string, creadaPor: string, d: DatosTarea): Tarea {
  const tarea: Tarea = {
    id: nuevoId(),
    familiaId,
    titulo: d.titulo.trim(),
    categoria: d.categoria,
    asignadoA: d.asignadoA,
    horaInicio: d.horaInicio.toISOString(),
    horaLimite: d.horaLimite.toISOString(),
    repeticion: d.repeticion,
    recordatorioMin: d.recordatorioMin ?? 10,
    requiereFoto: d.requiereFoto ?? false,
    puntos: d.puntos ?? null,
    notas: d.notas ?? '',
    origen: d.origen ?? 'padre',
    creadaPor,
    creadaEn: new Date().toISOString(),
    cancelada: false,
  };
  db.tareas.push(tarea);
  return tarea;
}

// ---------- Consultas ----------

export function vistas(db: BaseDeDatos, familiaId: string, filtro: (o: Ocurrencia, t: Tarea) => boolean): OcurrenciaVista[] {
  const tareas = new Map(db.tareas.filter((t) => t.familiaId === familiaId).map((t) => [t.id, t]));
  const usuarios = new Map(db.usuarios.map((u) => [u.id, u]));
  const res: OcurrenciaVista[] = [];
  for (const o of db.ocurrencias) {
    const tarea = tareas.get(o.tareaId);
    const hijo = tarea && usuarios.get(tarea.asignadoA);
    if (!tarea || !hijo || hijo.estado !== 'activo' || !filtro(o, tarea)) continue;
    res.push({ ...o, tarea, hijo });
  }
  return res.sort((a, b) => a.inicioProgramado.localeCompare(b.inicioProgramado));
}

/** Por revisar del padre: finalizadas, propuestas y justificaciones. Más recientes primero. */
export async function porRevisar(familiaId: string): Promise<OcurrenciaVista[]> {
  const db = await leerSincronizado(familiaId);
  return vistas(db, familiaId, (o) => ['finalizada', 'propuesta', 'justificada'].includes(o.estado)).sort((a, b) =>
    b.actualizadaEn.localeCompare(a.actualizadaEn),
  );
}

export async function ocurrencia(familiaId: string, id: string): Promise<OcurrenciaVista | null> {
  const db = await leer();
  return vistas(db, familiaId, (o) => o.id === id)[0] ?? null;
}

// ---------- Revisión del padre ----------

function exigirOcurrenciaDeFamilia(db: BaseDeDatos, familiaId: string, id: string) {
  const oc = db.ocurrencias.find((o) => o.id === id);
  const tarea = oc && db.tareas.find((t) => t.id === oc.tareaId);
  if (!oc || !tarea || tarea.familiaId !== familiaId) throw new ErrorApp('Esa tarea ya no existe.');
  return { oc, tarea };
}

export async function aprobarOcurrencia(padreId: string, id: string, estrellas: number, comentario: string) {
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    throw new ErrorApp('Elige de 1 a 5 estrellas.');
  }
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const { oc, tarea } = exigirOcurrenciaDeFamilia(db, padre.familiaId, id);
    aplicar(oc, oc.estado === 'justificada' ? 'aceptar_justificacion' : 'aprobar', 'padre');
    oc.calificacion = estrellas;
    oc.comentario = comentario.trim() || null;
    oc.revisadaEn = oc.actualizadaEn;
    avisarHijo(
      db,
      tarea,
      oc,
      'aprobada',
      `¡Tu tarea fue aprobada! ${'★'.repeat(estrellas)}`,
      oc.comentario ? `${tarea.titulo}: “${oc.comentario}”` : tarea.titulo,
    );
  });
}

export async function rechazarOcurrencia(padreId: string, id: string, motivo: string) {
  const m = motivo.trim();
  if (m.length < 3) throw new ErrorApp('Escribe el motivo para que tu hijo sepa qué mejorar.');
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const { oc, tarea } = exigirOcurrenciaDeFamilia(db, padre.familiaId, id);
    const eraPropuesta = oc.estado === 'propuesta';
    const accion =
      oc.estado === 'propuesta' ? 'rechazar_propuesta' : oc.estado === 'justificada' ? 'mantener_rechazo' : 'rechazar';
    aplicar(oc, accion, 'padre');
    oc.motivoRechazo = m;
    oc.revisadaEn = oc.actualizadaEn;
    avisarHijo(
      db,
      tarea,
      oc,
      'rechazada',
      eraPropuesta ? 'Tu propuesta no fue aprobada' : `${tarea.titulo} no fue aprobada`,
      eraPropuesta ? `${tarea.titulo}. Toca para ver el motivo.` : 'Revisa el motivo. Puedes explicar qué pasó.',
    );
  });
}

export async function aprobarPropuesta(padreId: string, id: string) {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const { oc, tarea } = exigirOcurrenciaDeFamilia(db, padre.familiaId, id);
    aplicar(oc, 'aprobar_propuesta', 'padre');
    oc.revisadaEn = oc.actualizadaEn;
    avisarHijo(db, tarea, oc, 'propuesta_aprobada', '¡Aprobaron tu propuesta!', `${tarea.titulo}, ${cuando(oc.inicioProgramado)}`);
    // Si la hora sugerida ya pasó, que quede como atrasada en la próxima sincronización.
  });
}


// ---------- M3: crear, editar y cancelar ----------

export interface FormularioTarea {
  titulo: string;
  categoria: Categoria;
  /** Al crear: uno o varios hijos (se guarda una tarea por hijo). Al editar se ignora. */
  asignados: string[];
  /** Día de inicio `YYYY-MM-DD`. */
  fecha: string;
  /** Hora de inicio `HH:MM` (24 h). */
  hora: string;
  duracionMin: number;
  repeticion: string | null;
  recordatorioMin: number;
  requiereFoto: boolean;
  puntos: number | null;
  notas: string;
}

function horario(f: FormularioTarea, ahora: Date, esEdicion = false) {
  const [h, m] = f.hora.split(':').map(Number);
  let inicio = deClave(f.fecha);
  inicio.setHours(h, m, 0, 0);
  let fin = new Date(inicio.getTime() + f.duracionMin * 60_000);
  if (!f.repeticion && fin <= ahora) throw new ErrorApp('La hora límite ya pasó. Elige otra fecha u hora.');
  // Rutina nueva cuyo horario de hoy ya terminó: empieza mañana (no nace atrasada).
  while (f.repeticion && !esEdicion && fin <= ahora) {
    inicio = new Date(inicio.getTime() + 86_400_000);
    fin = new Date(fin.getTime() + 86_400_000);
  }
  return { inicio, fin };
}

function validarFormulario(f: FormularioTarea) {
  const titulo = f.titulo.trim();
  if (titulo.length < 2) throw new ErrorApp('Escribe el nombre de la tarea.');
  if (titulo.length > 60) throw new ErrorApp('El nombre es muy largo (máximo 60 caracteres).');
  if (!/^\d{2}:\d{2}$/.test(f.hora)) throw new ErrorApp('Elige la hora de inicio.');
  if (f.duracionMin < 5 || f.duracionMin > 720) throw new ErrorApp('La duración debe ser de 5 minutos a 12 horas.');
  const dias = diasDeRegla(f.repeticion);
  if (f.repeticion !== null && (!dias || dias.length === 0)) throw new ErrorApp('Elige al menos un día de la semana.');
  if (f.puntos !== null && (!Number.isInteger(f.puntos) || f.puntos < 0 || f.puntos > 1000)) {
    throw new ErrorApp('Los puntos deben ser un número entero de 0 a 1000.');
  }
  if (f.notas.length > 300) throw new ErrorApp('Las notas son muy largas (máximo 300 caracteres).');
}

export async function crearTareas(padreId: string, f: FormularioTarea): Promise<Tarea[]> {
  validarFormulario(f);
  const ahora = new Date();
  const { inicio, fin } = horario(f, ahora);
  return modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    if (f.asignados.length === 0) throw new ErrorApp('Elige a quién se le asigna.');
    for (const id of f.asignados) {
      const h = db.usuarios.find((u) => u.id === id);
      if (!h || h.familiaId !== padre.familiaId || h.rol !== 'hijo' || h.estado !== 'activo') {
        throw new ErrorApp('Uno de los hijos ya no está en la familia.');
      }
    }
    if (f.repeticion) exigirCupoRutinas(db, padre.familiaId, f.asignados.length);
    const creadas = f.asignados.map((hijoId) =>
      insertarTarea(db, padre.familiaId, padre.id, {
        titulo: f.titulo,
        categoria: f.categoria,
        asignadoA: hijoId,
        horaInicio: inicio,
        horaLimite: fin,
        repeticion: f.repeticion,
        recordatorioMin: f.recordatorioMin,
        requiereFoto: f.requiereFoto,
        puntos: f.puntos,
        notas: f.notas.trim(),
      }),
    );
    sincronizar(db, padre.familiaId, ahora);
    for (const t of creadas) {
      const rep = describirRepeticion(t.repeticion);
      avisarHijo(
        db,
        t,
        primeraPendiente(db, t.id),
        'tarea_nueva',
        rep ? `Nueva rutina: ${t.titulo}` : `Nueva tarea: ${t.titulo}`,
        rep ? `${rep} a las ${formatoHora(t.horaInicio)}` : capitalizar(cuando(t.horaInicio)),
      );
    }
    return creadas;
  });
}

/**
 * Quita las ocurrencias que aún no empiezan para regenerarlas con el horario nuevo.
 * En rutinas se conserva el pasado y la de hoy si ya está atrasada (queda como registro).
 */
function quitarPendientes(db: BaseDeDatos, tarea: Tarea, diaHoy: string) {
  db.ocurrencias = db.ocurrencias.filter((o) => {
    if (o.tareaId !== tarea.id || !['programada', 'atrasada'].includes(o.estado)) return true;
    if (o.diaOrigen) return true; // reprogramada a mano por el padre: se respeta
    if (!tarea.repeticion) return false;
    return o.fecha < diaHoy || (o.fecha === diaHoy && o.estado === 'atrasada');
  });
}

export async function editarTarea(padreId: string, tareaId: string, f: FormularioTarea): Promise<void> {
  validarFormulario(f);
  const ahora = new Date();
  const { inicio, fin } = horario(f, ahora, true);
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const t = db.tareas.find((x) => x.id === tareaId && x.familiaId === padre.familiaId);
    if (!t || t.cancelada) throw new ErrorApp('Esa tarea ya no existe.');
    if (!t.repeticion && f.repeticion) exigirCupoRutinas(db, padre.familiaId, 1);
    const unaVezYaEmpezada =
      !t.repeticion && db.ocurrencias.some((o) => o.tareaId === t.id && !['programada', 'atrasada'].includes(o.estado));
    if (unaVezYaEmpezada) throw new ErrorApp('Esta tarea ya se inició; ya no se puede cambiar.');

    Object.assign(t, {
      titulo: f.titulo.trim(),
      categoria: f.categoria,
      horaInicio: inicio.toISOString(),
      horaLimite: fin.toISOString(),
      repeticion: f.repeticion,
      recordatorioMin: f.recordatorioMin,
      requiereFoto: f.requiereFoto,
      puntos: f.puntos,
      notas: f.notas.trim(),
    });
    // Rutina: lo pasado se conserva; lo que no ha empezado se vuelve a generar con el horario nuevo.
    quitarPendientes(db, t, claveDia(ahora));
    sincronizar(db, padre.familiaId, ahora);
    const rep = describirRepeticion(t.repeticion);
    avisarHijo(
      db,
      t,
      primeraPendiente(db, t.id),
      'tarea_editada',
      `Cambió una tarea: ${t.titulo}`,
      rep ? `Ahora: ${rep} a las ${formatoHora(t.horaInicio)}` : `Ahora es ${cuando(t.horaInicio)}`,
    );
  });
}

export async function cancelarTarea(padreId: string, tareaId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const t = db.tareas.find((x) => x.id === tareaId && x.familiaId === padre.familiaId);
    if (!t) throw new ErrorApp('Esa tarea ya no existe.');
    t.cancelada = true;
    quitarPendientes(db, t, claveDia(new Date()));
    avisarHijo(db, t, null, 'tarea_cancelada', `Se canceló: ${t.titulo}`, 'Ya no tienes que hacerla.');
  });
}

export interface TareaVista extends Tarea {
  hijo: Usuario;
  /** Estado de la ocurrencia más reciente. */
  estadoActual: Ocurrencia['estado'] | null;
}

/** Tareas vigentes: rutinas activas y tareas de una vez que aún no se cierran. */
export async function tareasVigentes(familiaId: string): Promise<TareaVista[]> {
  const db = await leerSincronizado(familiaId);
  const usuarios = new Map(db.usuarios.map((u) => [u.id, u]));
  const horaDelDia = (t: Tarea) => {
    const d = new Date(t.horaInicio);
    return d.getHours() * 60 + d.getMinutes();
  };
  const res: TareaVista[] = [];
  for (const t of db.tareas) {
    const hijo = usuarios.get(t.asignadoA);
    if (t.familiaId !== familiaId || t.cancelada || t.origen === 'propuesta' || !hijo || hijo.estado !== 'activo') continue;
    const ocs = db.ocurrencias.filter((o) => o.tareaId === t.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const estadoActual = ocs[0]?.estado ?? null;
    if (!t.repeticion && estadoActual && !['programada', 'atrasada', 'iniciada'].includes(estadoActual)) continue;
    res.push({ ...t, hijo, estadoActual });
  }
  return res.sort((a, b) => {
    if (!!a.repeticion !== !!b.repeticion) return a.repeticion ? -1 : 1;
    return a.repeticion ? horaDelDia(a) - horaDelDia(b) : a.horaInicio.localeCompare(b.horaInicio);
  });
}

export async function obtenerTarea(familiaId: string, tareaId: string): Promise<Tarea | null> {
  const db = await leer();
  return db.tareas.find((t) => t.id === tareaId && t.familiaId === familiaId && !t.cancelada) ?? null;
}

/** Formulario a partir de una tarea existente (para editar). */
export function formularioDe(t: Tarea): FormularioTarea {
  const inicio = new Date(t.horaInicio);
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    titulo: t.titulo,
    categoria: t.categoria,
    asignados: [t.asignadoA],
    fecha: claveDia(inicio),
    hora: `${dos(inicio.getHours())}:${dos(inicio.getMinutes())}`,
    duracionMin: Math.round((new Date(t.horaLimite).getTime() - inicio.getTime()) / 60_000),
    repeticion: t.repeticion,
    recordatorioMin: t.recordatorioMin,
    requiereFoto: t.requiereFoto,
    puntos: t.puntos,
    notas: t.notas,
  };
}

export const ORDEN_DIAS: CodigoDia[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const LETRA_DIA: Record<CodigoDia, string> = { MO: 'L', TU: 'M', WE: 'Mi', TH: 'J', FR: 'V', SA: 'S', SU: 'D' };

/** "Diaria", "L Mi V", "Lun a vie" o null (una vez). */
export function describirRepeticion(regla: string | null): string | null {
  const dias = diasDeRegla(regla);
  if (!dias) return null;
  if (dias === 'diario') return 'Diaria';
  const orden = ORDEN_DIAS.filter((d) => dias.includes(d));
  if (orden.join() === 'MO,TU,WE,TH,FR') return 'Lun a vie';
  if (orden.join() === 'SA,SU') return 'Fines de semana';
  return orden.map((d) => LETRA_DIA[d]).join(' ');
}

/** Próxima ocurrencia sin empezar de una tarea (para el enlace del aviso). */
function primeraPendiente(db: BaseDeDatos, tareaId: string): Ocurrencia | null {
  return (
    db.ocurrencias
      .filter((o) => o.tareaId === tareaId && (o.estado === 'programada' || o.estado === 'atrasada'))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null
  );
}
