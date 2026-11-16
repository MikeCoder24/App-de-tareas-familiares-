import type { BaseDeDatos } from '../db';
import { ErrorApp } from '../errores';
import type { Usuario } from '../tipos';

/** Pendiente o activo: sigue siendo parte de la familia (no rechazado ni desvinculado). */
export const esVigente = (u: Usuario) => u.estado === 'pendiente' || u.estado === 'activo';

/** Equivalente local de las reglas RLS de Supabase: solo un padre activo administra su familia. */
export function exigirPadreActivo(db: BaseDeDatos, padreId: string): Usuario {
  const padre = db.usuarios.find((u) => u.id === padreId);
  if (!padre || padre.rol !== 'padre' || padre.estado !== 'activo') {
    throw new ErrorApp('No tienes permiso para hacer esto.');
  }
  return padre;
}

export function exigirMiembroDeFamilia(db: BaseDeDatos, familiaId: string, usuarioId: string): Usuario {
  const u = db.usuarios.find((x) => x.id === usuarioId && x.familiaId === familiaId);
  if (!u) throw new ErrorApp('Ese miembro ya no pertenece a la familia.');
  return u;
}
