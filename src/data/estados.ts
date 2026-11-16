// Máquina de estados de una ocurrencia — ver CLAUDE.md "Estados de una tarea".
// Es el único lugar donde cambia `estado`; M7 se engancha aquí para notificar.
import { ErrorApp } from './errores';
import type { EstadoOcurrencia, Ocurrencia, Rol } from './tipos';

export type Accion =
  | 'aprobar_propuesta' // padre: propuesta → programada
  | 'rechazar_propuesta' // padre: propuesta → rechazada
  | 'vencer' // sistema: programada → atrasada
  | 'iniciar' // hijo: programada | atrasada → iniciada
  | 'finalizar' // hijo: iniciada → finalizada
  | 'aprobar' // padre: finalizada → aprobada
  | 'rechazar' // padre: finalizada → rechazada
  | 'justificar' // hijo: rechazada | atrasada → justificada
  | 'aceptar_justificacion' // padre: justificada → aprobada
  | 'mantener_rechazo' // padre: justificada → rechazada
  | 'reprogramar'; // padre: justificada → programada

type Actor = Rol | 'sistema';

const TRANSICIONES: Record<Accion, { desde: EstadoOcurrencia[]; hacia: EstadoOcurrencia; actor: Actor }> = {
  aprobar_propuesta: { desde: ['propuesta'], hacia: 'programada', actor: 'padre' },
  rechazar_propuesta: { desde: ['propuesta'], hacia: 'rechazada', actor: 'padre' },
  vencer: { desde: ['programada'], hacia: 'atrasada', actor: 'sistema' },
  iniciar: { desde: ['programada', 'atrasada'], hacia: 'iniciada', actor: 'hijo' },
  finalizar: { desde: ['iniciada'], hacia: 'finalizada', actor: 'hijo' },
  aprobar: { desde: ['finalizada'], hacia: 'aprobada', actor: 'padre' },
  rechazar: { desde: ['finalizada'], hacia: 'rechazada', actor: 'padre' },
  justificar: { desde: ['rechazada', 'atrasada'], hacia: 'justificada', actor: 'hijo' },
  aceptar_justificacion: { desde: ['justificada'], hacia: 'aprobada', actor: 'padre' },
  mantener_rechazo: { desde: ['justificada'], hacia: 'rechazada', actor: 'padre' },
  reprogramar: { desde: ['justificada'], hacia: 'programada', actor: 'padre' },
};

export function puede(oc: Ocurrencia, accion: Accion, actor: Actor): boolean {
  const t = TRANSICIONES[accion];
  if (t.actor !== actor || !t.desde.includes(oc.estado)) return false;
  // El hijo justifica una sola vez.
  if (accion === 'justificar' && oc.justificacion) return false;
  return true;
}

/** Aplica la transición sobre la ocurrencia (mutándola) o lanza ErrorApp. */
export function aplicar(oc: Ocurrencia, accion: Accion, actor: Actor, ahora = new Date()): Ocurrencia {
  if (!puede(oc, accion, actor)) {
    throw new ErrorApp('Esta tarea ya cambió de estado. Desliza para actualizar.');
  }
  oc.estado = TRANSICIONES[accion].hacia;
  oc.actualizadaEn = ahora.toISOString();
  return oc;
}

export const ETIQUETA_ESTADO: Record<EstadoOcurrencia, string> = {
  propuesta: 'Propuesta',
  programada: 'Programada',
  iniciada: 'En curso',
  finalizada: 'Por revisar',
  aprobada: 'Aprobada',
  atrasada: 'Atrasada',
  rechazada: 'Rechazada',
  justificada: 'Justificada',
};

/** Estados que cuentan como "hecha" para el hijo (ya terminó su parte). */
export const HECHAS: EstadoOcurrencia[] = ['finalizada', 'aprobada'];
/** Estados que no cuentan en el total del día (aún no son tareas asignadas). */
export const FUERA_DE_AGENDA: EstadoOcurrencia[] = ['propuesta'];
