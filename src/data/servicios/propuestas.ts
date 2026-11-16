// M6 — Propuestas del hijo y justificaciones; reprogramar (padre).
import { modificar } from '../db';
import { ErrorApp } from '../errores';
import { aplicar } from '../estados';
import { claveDia, deClave } from '../fechas';
import type { Categoria, Usuario } from '../tipos';
import { avisarHijo, avisarPadres, cuando } from './avisos';
import { exigirPadreActivo } from './permisos';
import { insertarTarea, leerSincronizado, type OcurrenciaVista, sincronizar, vistas } from './tareas';
import { validarNombre } from './validacion';

export interface FormularioPropuesta {
  titulo: string;
  categoria: Categoria;
  fecha: string;
  hora: string;
  duracionMin: number;
  motivo: string;
}

function aFecha(fecha: string, hora: string) {
  const [h, m] = hora.split(':').map(Number);
  const d = deClave(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

// ---------- Proponer (hijo) ----------

export async function proponerTarea(hijoId: string, f: FormularioPropuesta): Promise<void> {
  const titulo = validarNombre(f.titulo, 'qué quieres hacer');
  const motivo = f.motivo.trim();
  if (motivo.length < 3) throw new ErrorApp('Cuéntales a tus papás por qué quieres hacerla.');
  if (motivo.length > 200) throw new ErrorApp('El motivo es muy largo (máximo 200 caracteres).');
  const inicio = aFecha(f.fecha, f.hora);
  const fin = new Date(inicio.getTime() + f.duracionMin * 60_000);
  if (fin <= new Date()) throw new ErrorApp('Elige una fecha y hora que todavía no pasen.');

  await modificar((db) => {
    const hijo = db.usuarios.find((u) => u.id === hijoId && u.rol === 'hijo' && u.estado === 'activo');
    if (!hijo) throw new ErrorApp('Tu cuenta ya no está activa.');
    const tarea = insertarTarea(db, hijo.familiaId, hijo.id, {
      titulo,
      categoria: f.categoria,
      asignadoA: hijo.id,
      horaInicio: inicio,
      horaLimite: fin,
      repeticion: null,
      origen: 'propuesta',
    });
    sincronizar(db, hijo.familiaId);
    const oc = db.ocurrencias.find((o) => o.tareaId === tarea.id);
    if (oc) oc.motivoPropuesta = motivo;
    avisarPadres(db, hijo, oc ?? null, 'propuesta', `${hijo.nombre} propuso: ${titulo}`, motivo);
  });
}

export async function misPropuestas(hijo: Usuario): Promise<OcurrenciaVista[]> {
  const db = await leerSincronizado(hijo.familiaId);
  return vistas(db, hijo.familiaId, (_o, t) => t.asignadoA === hijo.id && t.origen === 'propuesta').sort((a, b) =>
    b.tarea.creadaEn.localeCompare(a.tarea.creadaEn),
  );
}

// ---------- Justificar (hijo) ----------

export type MotivoJustificacion = 'propuesta_rechazada' | 'tarea_rechazada' | 'no_iniciada';

export function motivoDe(oc: OcurrenciaVista): MotivoJustificacion {
  if (oc.estado === 'atrasada') return 'no_iniciada';
  if (oc.tarea.origen === 'propuesta' && !oc.iniciadaEn) return 'propuesta_rechazada';
  return oc.finalizadaEn ? 'tarea_rechazada' : 'no_iniciada';
}

export interface Justificaciones {
  /** Lo que el padre no aprobó y el hijo todavía puede responder (una vez). */
  pendientes: OcurrenciaVista[];
  /** Justificadas esperando al padre. */
  enviadas: OcurrenciaVista[];
  /** Justificaciones ya resueltas por el padre (últimas 14). */
  resueltas: OcurrenciaVista[];
}

export async function justificaciones(hijo: Usuario): Promise<Justificaciones> {
  const db = await leerSincronizado(hijo.familiaId);
  const mias = vistas(db, hijo.familiaId, (_o, t) => t.asignadoA === hijo.id);
  return {
    pendientes: mias
      .filter((o) => (o.estado === 'rechazada' || o.estado === 'atrasada') && !o.justificacion)
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    enviadas: mias.filter((o) => o.estado === 'justificada'),
    resueltas: mias
      .filter((o) => o.justificacion && o.estado !== 'justificada')
      .sort((a, b) => (b.revisadaEn ?? '').localeCompare(a.revisadaEn ?? ''))
      .slice(0, 14),
  };
}

export async function contarPorJustificar(hijo: Usuario): Promise<number> {
  return (await justificaciones(hijo)).pendientes.length;
}

export async function justificar(hijoId: string, id: string, texto: string, fotoUri: string | null): Promise<void> {
  const t = texto.trim();
  if (t.length < 3) throw new ErrorApp('Escribe tu explicación.');
  if (t.length > 300) throw new ErrorApp('Es muy largo (máximo 300 caracteres).');
  await modificar((db) => {
    const oc = db.ocurrencias.find((o) => o.id === id);
    const tarea = oc && db.tareas.find((x) => x.id === oc.tareaId);
    if (!oc || !tarea || tarea.asignadoA !== hijoId) throw new ErrorApp('Esta tarea ya no existe.');
    if (oc.justificacion) throw new ErrorApp('Ya enviaste tu explicación de esta tarea.');
    aplicar(oc, 'justificar', 'hijo');
    oc.justificacion = t;
    oc.justificacionFotoUrl = fotoUri;
    const hijo = db.usuarios.find((u) => u.id === hijoId);
    if (hijo) avisarPadres(db, hijo, oc, 'justificacion', `${hijo.nombre} explicó: ${tarea.titulo}`, t);
  });
}

// ---------- Padre: decidir una justificación ----------

/** Acepta la justificación de algo que no se hizo (o una propuesta): queda aprobada sin estrellas. */
export async function aceptarSinCalificar(padreId: string, id: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const oc = db.ocurrencias.find((o) => o.id === id);
    const tarea = oc && db.tareas.find((t) => t.id === oc.tareaId && t.familiaId === padre.familiaId);
    if (!oc || !tarea) throw new ErrorApp('Esa tarea ya no existe.');
    aplicar(oc, 'aceptar_justificacion', 'padre');
    oc.revisadaEn = oc.actualizadaEn;
    avisarHijo(db, tarea, oc, 'aprobada', 'Aceptaron tu explicación', tarea.titulo);
  });
}

/**
 * Reprograma una tarea justificada a otro día y hora (misma duración).
 * Se borra el intento anterior para que el hijo pueda volver a hacerla.
 */
export async function reprogramar(padreId: string, id: string, fecha: string, hora: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const oc = db.ocurrencias.find((o) => o.id === id);
    const tarea = oc && db.tareas.find((t) => t.id === oc.tareaId && t.familiaId === padre.familiaId);
    if (!oc || !tarea) throw new ErrorApp('Esa tarea ya no existe.');
    const duracion = new Date(oc.limiteProgramado).getTime() - new Date(oc.inicioProgramado).getTime();
    const inicio = aFecha(fecha, hora);
    const fin = new Date(inicio.getTime() + duracion);
    if (fin <= new Date()) throw new ErrorApp('Elige una fecha y hora que todavía no pasen.');

    aplicar(oc, 'reprogramar', 'padre');
    oc.diaOrigen = oc.diaOrigen ?? oc.fecha;
    oc.fecha = claveDia(inicio);
    oc.inicioProgramado = inicio.toISOString();
    oc.limiteProgramado = fin.toISOString();
    oc.iniciadaEn = null;
    oc.finalizadaEn = null;
    oc.evidenciaUrl = null;
    oc.revisadaEn = oc.actualizadaEn;
    avisarHijo(db, tarea, oc, 'reprogramada', `Se reprogramó: ${tarea.titulo}`, `Ahora es ${cuando(oc.inicioProgramado)}`);
  });
}
