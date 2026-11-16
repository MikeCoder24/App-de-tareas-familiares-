// Administración de miembros (base de M1; M3 y M4 la amplían).
import { crearSecreto } from '../cripto';
import { leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import type { Familia, Usuario } from '../tipos';
import { esVigente, exigirMiembroDeFamilia, exigirPadreActivo } from './permisos';
import { exigirCupoHijos } from '../planes';
import { normalizarIdentificador, validarNombre, validarPin } from './validacion';

export async function obtenerFamilia(familiaId: string): Promise<Familia | null> {
  const db = await leer();
  return db.familias.find((f) => f.id === familiaId) ?? null;
}

export async function miembros(familiaId: string): Promise<Usuario[]> {
  const db = await leer();
  return db.usuarios
    .filter((u) => u.familiaId === familiaId && esVigente(u))
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

export async function aprobarMiembro(padreId: string, usuarioId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const u = exigirMiembroDeFamilia(db, padre.familiaId, usuarioId);
    if (u.estado !== 'pendiente') throw new ErrorApp('Esta solicitud ya se resolvió.');
    if (u.rol === 'hijo') exigirCupoHijos(db, padre.familiaId);
    u.estado = 'activo';
  });
}

export async function rechazarMiembro(padreId: string, usuarioId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const u = exigirMiembroDeFamilia(db, padre.familiaId, usuarioId);
    if (u.estado !== 'pendiente') throw new ErrorApp('Esta solicitud ya se resolvió.');
    u.estado = 'rechazado';
  });
}

export async function restablecerPin(padreId: string, hijoId: string, nuevoPin: string): Promise<void> {
  validarPin(nuevoPin);
  const secreto = await crearSecreto(nuevoPin);
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const hijo = exigirMiembroDeFamilia(db, padre.familiaId, hijoId);
    if (hijo.rol !== 'hijo') throw new ErrorApp('Solo se puede restablecer el PIN de un hijo.');
    Object.assign(hijo, secreto);
  });
}

/** Cierra la sesión del hijo en su teléfono: la próxima vez que abra la app pedirá PIN. */
export async function cerrarSesionRemota(padreId: string, hijoId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const hijo = exigirMiembroDeFamilia(db, padre.familiaId, hijoId);
    if (hijo.rol !== 'hijo') throw new ErrorApp('Solo se puede cerrar la sesión de un hijo.');
    hijo.sesionVersion += 1;
  });
}

export async function editarHijo(padreId: string, hijoId: string, datos: { nombre: string; avatar: string }) {
  const nombre = validarNombre(datos.nombre, 'el nombre o apodo');
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const hijo = exigirMiembroDeFamilia(db, padre.familiaId, hijoId);
    if (hijo.rol !== 'hijo') throw new ErrorApp('Solo se pueden editar los datos de un hijo.');
    const repetido = db.usuarios.some(
      (u) => u.id !== hijoId && u.familiaId === padre.familiaId && esVigente(u) && u.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (repetido) throw new ErrorApp('Ya hay alguien con ese nombre en la familia.');
    hijo.nombre = nombre;
    hijo.avatar = datos.avatar;
  });
}

/**
 * Saca al hijo de la familia: cierra su sesión y cancela sus tareas pendientes.
 * El historial se conserva. Para volver necesita una invitación nueva.
 */
export async function desvincularHijo(padreId: string, hijoId: string) {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const hijo = exigirMiembroDeFamilia(db, padre.familiaId, hijoId);
    if (hijo.rol !== 'hijo') throw new ErrorApp('Solo se puede desvincular a un hijo.');
    hijo.estado = 'desvinculado';
    hijo.sesionVersion += 1;
    const susTareas = new Set(db.tareas.filter((t) => t.asignadoA === hijoId).map((t) => t.id));
    for (const t of db.tareas) if (susTareas.has(t.id)) t.cancelada = true;
    db.ocurrencias = db.ocurrencias.filter(
      (o) => !susTareas.has(o.tareaId) || !['programada', 'atrasada', 'propuesta'].includes(o.estado),
    );
    db.dispositivo.hijosVinculados = db.dispositivo.hijosVinculados.filter((id) => id !== hijoId);
  });
}

// ---------- M4: familia y cuenta ----------

export async function editarFamilia(padreId: string, datos: { nombre?: string; foto?: string | null }) {
  const nombre = datos.nombre === undefined ? undefined : validarNombre(datos.nombre, 'el nombre de la familia');
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const familia = db.familias.find((f) => f.id === padre.familiaId);
    if (!familia) throw new ErrorApp('No se encontró la familia.');
    if (nombre !== undefined) familia.nombre = nombre;
    if (datos.foto !== undefined) familia.foto = datos.foto;
  });
}

export async function editarCuenta(padreId: string, datos: { nombre: string; identificador: string }) {
  const nombre = validarNombre(datos.nombre);
  const identificador = normalizarIdentificador(datos.identificador);
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const ocupado = db.usuarios.some(
      (u) => u.id !== padre.id && u.rol === 'padre' && esVigente(u) && u.identificador === identificador,
    );
    if (ocupado) throw new ErrorApp('Ese correo o teléfono ya lo usa otra cuenta.');
    padre.nombre = nombre;
    padre.identificador = identificador;
  });
}

/** ¿Hay otro padre o madre activo? Decide si se borra la familia o solo se sale. */
export async function hayOtroPadre(padreId: string): Promise<boolean> {
  const db = await leer();
  const yo = db.usuarios.find((u) => u.id === padreId);
  return db.usuarios.some((u) => u.id !== padreId && u.familiaId === yo?.familiaId && u.rol === 'padre' && u.estado === 'activo');
}

/**
 * Eliminar cuenta. Si hay otro padre activo, solo sale de la familia.
 * Si es el último padre, se elimina la familia completa con hijos, tareas e historial.
 */
export async function eliminarCuenta(padreId: string): Promise<'salio' | 'familia_eliminada'> {
  return modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const familiaId = padre.familiaId;
    const otroPadre = db.usuarios.some(
      (u) => u.id !== padre.id && u.familiaId === familiaId && u.rol === 'padre' && u.estado === 'activo',
    );
    if (otroPadre) {
      db.usuarios = db.usuarios.filter((u) => u.id !== padre.id);
      db.dispositivo.sesion = null;
      return 'salio' as const;
    }
    const miembrosIds = new Set(db.usuarios.filter((u) => u.familiaId === familiaId).map((u) => u.id));
    const tareasIds = new Set(db.tareas.filter((t) => t.familiaId === familiaId).map((t) => t.id));
    db.familias = db.familias.filter((f) => f.id !== familiaId);
    db.usuarios = db.usuarios.filter((u) => u.familiaId !== familiaId);
    db.invitaciones = db.invitaciones.filter((i) => i.familiaId !== familiaId);
    db.tareas = db.tareas.filter((t) => t.familiaId !== familiaId);
    db.ocurrencias = db.ocurrencias.filter((o) => !tareasIds.has(o.tareaId));
    db.notificaciones = db.notificaciones.filter((n) => !miembrosIds.has(n.usuarioId));
    db.suscripciones = db.suscripciones.filter((s) => s.familiaId !== familiaId);
    db.dispositivo.hijosVinculados = db.dispositivo.hijosVinculados.filter((id) => !miembrosIds.has(id));
    db.dispositivo.sesion = null;
    return 'familia_eliminada' as const;
  });
}
