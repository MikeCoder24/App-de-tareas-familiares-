// M7 — Registro de avisos. Cada cambio de estado deja una Notificación para la otra parte.
// Con Supabase, una Edge Function enviará cada registro como push (FCM / APNs);
// en modo local, src/notifications/entrega.ts los muestra como notificación local.
import { nuevoId } from '../cripto';
import { ajustar, type BaseDeDatos, leer } from '../db';
import { claveDia, formatoDia, formatoHora, hoy, sumarDias } from '../fechas';
import type { Notificacion, Ocurrencia, Tarea, Usuario } from '../tipos';
import { alertasDe } from './alertas';

export type TipoAviso =
  | 'tarea_nueva'
  | 'tarea_editada'
  | 'tarea_cancelada'
  | 'inicio'
  | 'fin'
  | 'aprobada'
  | 'rechazada'
  | 'propuesta'
  | 'propuesta_aprobada'
  | 'justificacion'
  | 'reprogramada';

interface Aviso {
  usuarioId: string;
  tipo: TipoAviso;
  ocurrenciaId?: string | null;
  titulo: string;
  cuerpo: string;
  url: string;
}

export function registrarAviso(db: BaseDeDatos, a: Aviso) {
  db.notificaciones.push({
    id: nuevoId(),
    usuarioId: a.usuarioId,
    tipo: a.tipo,
    ocurrenciaId: a.ocurrenciaId ?? null,
    titulo: a.titulo,
    cuerpo: a.cuerpo,
    url: a.url,
    programadaPara: new Date().toISOString(),
    enviadaEn: null,
    leida: false,
  });
  // Solo se guardan los últimos 300 avisos en el teléfono.
  if (db.notificaciones.length > 300) db.notificaciones.splice(0, db.notificaciones.length - 300);
}

/** "hoy 6:00 p.m.", "mañana 7:30 a.m." o "mié 18 nov 5:00 p.m." */
export function cuando(iso: string): string {
  const clave = claveDia(new Date(iso));
  const nombre = clave === hoy() ? 'hoy' : clave === sumarDias(hoy(), 1) ? 'mañana' : formatoDia(clave, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${nombre} ${formatoHora(iso)}`;
}

const urlHijo = (oc: Pick<Ocurrencia, 'id'> | null) => (oc ? `/tarea/${oc.id}` : '/tareas');

/** Aviso para el hijo asignado a la tarea. */
export function avisarHijo(db: BaseDeDatos, tarea: Tarea, oc: Ocurrencia | null, tipo: TipoAviso, titulo: string, cuerpo: string) {
  registrarAviso(db, { usuarioId: tarea.asignadoA, tipo, ocurrenciaId: oc?.id, titulo, cuerpo, url: urlHijo(oc) });
}

/**
 * Aviso para los padres activos de la familia. Los avisos de inicio y fin respetan
 * la configuración "Aviso al padre al iniciar y al finalizar" por hijo (M3).
 */
export function avisarPadres(db: BaseDeDatos, hijo: Usuario, oc: Ocurrencia | null, tipo: TipoAviso, titulo: string, cuerpo: string) {
  const familia = db.familias.find((f) => f.id === hijo.familiaId);
  if ((tipo === 'inicio' || tipo === 'fin') && alertasDe(familia).sinAvisoInicioFin.includes(hijo.id)) return;
  const url = oc && ['fin', 'propuesta', 'justificacion'].includes(tipo) ? `/revisar/${oc.id}` : `/hijo/${hijo.id}`;
  for (const p of db.usuarios) {
    if (p.familiaId === hijo.familiaId && p.rol === 'padre' && p.estado === 'activo') {
      registrarAviso(db, { usuarioId: p.id, tipo, ocurrenciaId: oc?.id, titulo, cuerpo, url });
    }
  }
}

// ---------- Bandeja de avisos (dentro de la app) ----------

export async function misAvisos(usuarioId: string): Promise<Notificacion[]> {
  const db = await leer();
  return db.notificaciones.filter((n) => n.usuarioId === usuarioId).sort((a, b) => b.programadaPara.localeCompare(a.programadaPara)).slice(0, 50);
}

export async function contarNoLeidos(usuarioId: string): Promise<number> {
  const db = await leer();
  return db.notificaciones.filter((n) => n.usuarioId === usuarioId && !n.leida).length;
}

export async function marcarLeidos(usuarioId: string): Promise<void> {
  await ajustar((db) => {
    let cambio = false;
    for (const n of db.notificaciones) {
      if (n.usuarioId === usuarioId && !n.leida) {
        n.leida = true;
        cambio = true;
      }
    }
    return cambio;
  });
}
