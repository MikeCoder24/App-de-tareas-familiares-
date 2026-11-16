import { leer } from '../db';
import { porRevisar } from './tareas';

/** Cuántas solicitudes de ingreso esperan aprobación en la familia (insignia de Gestión). */
export async function contarSolicitudesPendientes(familiaId: string): Promise<number> {
  const db = await leer();
  return db.usuarios.filter((u) => u.familiaId === familiaId && u.estado === 'pendiente').length;
}

/** Cuántas tareas, propuestas y justificaciones esperan revisión (insignia de Inicio). */
export async function contarPorRevisar(familiaId: string): Promise<number> {
  return (await porRevisar(familiaId)).length;
}
