// M1 — Acceso y registro.
import { crearSecreto, nuevoId, verificarSecreto } from '../cripto';
import { type BaseDeDatos, leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import type { Familia, Usuario } from '../tipos';
import { buscarInvitacionValida } from './invitaciones';
import { esVigente } from './permisos';
import {
  normalizarIdentificador,
  validarContrasena,
  validarNombre,
  validarPin,
} from './validacion';

export interface SesionActiva {
  usuario: Usuario;
  familia: Familia;
}

function abrirSesion(db: BaseDeDatos, u: Usuario) {
  db.dispositivo.sesion = { usuarioId: u.id, sesionVersion: u.sesionVersion };
  const cuentas = db.dispositivo.cuentas ?? [];
  if (!cuentas.includes(u.id)) db.dispositivo.cuentas = [...cuentas, u.id];
}

// ---------- Padre ----------

export async function registrarPadre(datos: {
  nombre: string;
  identificador: string;
  contrasena: string;
  /** Si otro padre lo invitó: se une a esa familia en lugar de crear una. */
  codigoInvitacion?: string;
}): Promise<Usuario> {
  const nombre = validarNombre(datos.nombre);
  const identificador = normalizarIdentificador(datos.identificador);
  validarContrasena(datos.contrasena);
  const secreto = await crearSecreto(datos.contrasena);

  return modificar((db) => {
    if (db.usuarios.some((u) => u.rol === 'padre' && esVigente(u) && u.identificador === identificador)) {
      throw new ErrorApp('Ya existe una cuenta con ese correo o teléfono. Inicia sesión.');
    }
    const ahora = new Date().toISOString();
    const codigo = datos.codigoInvitacion?.trim();

    let familiaId: string;
    let estado: Usuario['estado'];
    if (codigo) {
      const inv = buscarInvitacionValida(db, codigo, 'padre');
      inv.usada = true;
      familiaId = inv.familiaId;
      estado = 'pendiente'; // Se invita "igual que un hijo": otro padre lo aprueba.
    } else {
      familiaId = nuevoId();
      estado = 'activo';
      db.familias.push({
        id: familiaId,
        nombre: `Familia de ${nombre.split(' ')[0]}`,
        foto: null,
        plan: 'gratis',
        creadaEn: ahora,
      });
      db.suscripciones.push({ familiaId, plan: 'gratis', tienda: null, vence: null });
    }

    const padre: Usuario = {
      id: nuevoId(),
      familiaId,
      rol: 'padre',
      nombre,
      avatar: '🧑',
      estado,
      identificador,
      ...secreto,
      pushToken: null,
      sesionVersion: 1,
      creadoEn: ahora,
    };
    db.usuarios.push(padre);
    abrirSesion(db, padre);
    return padre;
  });
}

export async function iniciarSesionPadre(identificadorCrudo: string, contrasena: string): Promise<Usuario> {
  const identificador = normalizarIdentificador(identificadorCrudo);
  const db = await leer();
  const candidatos = db.usuarios.filter((u) => u.rol === 'padre' && u.identificador === identificador);
  const padre = candidatos.find(esVigente) ?? candidatos[0];
  const ok = padre && (await verificarSecreto(contrasena, padre.secretoSal, padre.secretoHash));
  if (!padre || !ok) throw new ErrorApp('Correo/teléfono o contraseña incorrectos.');
  if (padre.estado === 'rechazado') throw new ErrorApp('Tu solicitud para unirte a la familia fue rechazada.');
  if (padre.estado === 'desvinculado') throw new ErrorApp('Tu cuenta ya no pertenece a ninguna familia.');
  await modificar((d) => abrirSesion(d, padre));
  return padre;
}

// ---------- Hijo ----------

export async function registrarHijo(datos: {
  codigo: string;
  nombre: string;
  avatar: string;
  pin: string;
}): Promise<Usuario> {
  const nombre = validarNombre(datos.nombre, 'tu nombre o apodo');
  validarPin(datos.pin);
  const secreto = await crearSecreto(datos.pin);

  return modificar((db) => {
    const inv = buscarInvitacionValida(db, datos.codigo, 'hijo');
    const repetido = db.usuarios.some(
      (u) =>
        u.familiaId === inv.familiaId &&
        esVigente(u) &&
        u.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (repetido) throw new ErrorApp('Ya hay alguien con ese nombre en tu familia. Usa un apodo.');

    inv.usada = true;
    const hijo: Usuario = {
      id: nuevoId(),
      familiaId: inv.familiaId,
      rol: 'hijo',
      nombre,
      avatar: datos.avatar,
      estado: 'pendiente',
      identificador: null,
      ...secreto,
      pushToken: null,
      sesionVersion: 1,
      creadoEn: new Date().toISOString(),
    };
    db.usuarios.push(hijo);
    db.dispositivo.hijosVinculados.push(hijo.id);
    abrirSesion(db, hijo);
    return hijo;
  });
}

/** Hijos que ya se registraron en este teléfono (para entrar con usuario + PIN). */
export async function hijosDelDispositivo(): Promise<Usuario[]> {
  const db = await leer();
  return db.dispositivo.hijosVinculados
    .map((id) => db.usuarios.find((u) => u.id === id))
    .filter((u): u is Usuario => !!u && esVigente(u));
}

export async function iniciarSesionHijo(hijoId: string, pin: string): Promise<Usuario> {
  validarPin(pin);
  const db = await leer();
  const hijo = db.usuarios.find((u) => u.id === hijoId && u.rol === 'hijo');
  if (!hijo || !db.dispositivo.hijosVinculados.includes(hijoId)) {
    throw new ErrorApp('Este teléfono ya no está vinculado a ese usuario.');
  }
  if (!(await verificarSecreto(pin, hijo.secretoSal, hijo.secretoHash))) {
    throw new ErrorApp('PIN incorrecto.');
  }
  await modificar((d) => abrirSesion(d, hijo));
  return hijo;
}

// ---------- Sesión ----------

/**
 * Devuelve la sesión abierta en este teléfono, o null si no hay, si el usuario
 * ya no existe o si un padre la cerró a distancia (cambió `sesionVersion`).
 */
export async function sesionActual(): Promise<SesionActiva | null> {
  const db = await leer();
  const s = db.dispositivo.sesion;
  if (!s) return null;
  const usuario = db.usuarios.find((u) => u.id === s.usuarioId);
  const familia = usuario && db.familias.find((f) => f.id === usuario.familiaId);
  if (!usuario || !familia || usuario.estado === 'desvinculado' || usuario.sesionVersion !== s.sesionVersion) {
    await cerrarSesion();
    return null;
  }
  return { usuario, familia };
}

export async function cerrarSesion(): Promise<void> {
  await modificar((db) => {
    db.dispositivo.sesion = null;
  });
}

/** Hijo rechazado: se quita del teléfono para que pueda usar otro código. */
export async function olvidarHijoEnDispositivo(hijoId: string): Promise<void> {
  await modificar((db) => {
    db.dispositivo.hijosVinculados = db.dispositivo.hijosVinculados.filter((id) => id !== hijoId);
    if (db.dispositivo.sesion?.usuarioId === hijoId) db.dispositivo.sesion = null;
  });
}
