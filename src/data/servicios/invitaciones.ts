import { codigoSeisDigitos } from '../cripto';
import { type BaseDeDatos, leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import type { Invitacion, Rol } from '../tipos';
import { exigirCupoHijos } from '../planes';
import { exigirPadreActivo } from './permisos';
import { validarCodigoFormato } from './validacion';

export const VIGENCIA_INVITACION_HORAS = 48;

const estaVigente = (inv: Invitacion, ahora = Date.now()) =>
  !inv.usada && new Date(inv.expira).getTime() > ahora;

export async function generarInvitacion(padreId: string, rol: Rol): Promise<Invitacion> {
  return modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    if (rol === 'hijo') exigirCupoHijos(db, padre.familiaId);
    const ocupados = new Set(db.invitaciones.filter((i) => estaVigente(i)).map((i) => i.codigo));
    let codigo = codigoSeisDigitos();
    while (ocupados.has(codigo)) codigo = codigoSeisDigitos();

    const ahora = new Date();
    const inv: Invitacion = {
      codigo,
      familiaId: padre.familiaId,
      rol,
      creadaPor: padre.id,
      creadaEn: ahora.toISOString(),
      expira: new Date(ahora.getTime() + VIGENCIA_INVITACION_HORAS * 3_600_000).toISOString(),
      usada: false,
    };
    db.invitaciones.push(inv);
    return inv;
  });
}

export async function invitacionesVigentes(familiaId: string): Promise<Invitacion[]> {
  const db = await leer();
  return db.invitaciones
    .filter((i) => i.familiaId === familiaId && estaVigente(i))
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));
}

export async function cancelarInvitacion(padreId: string, codigo: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const inv = db.invitaciones.find((i) => i.codigo === codigo && i.familiaId === padre.familiaId);
    if (inv) inv.usada = true;
  });
}

/** Busca una invitación vigente para el rol esperado. Lanza ErrorApp si no sirve. */
export function buscarInvitacionValida(db: BaseDeDatos, codigoCrudo: string, rol: Rol): Invitacion {
  const codigo = validarCodigoFormato(codigoCrudo);
  const inv = db.invitaciones.find((i) => i.codigo === codigo && estaVigente(i));
  if (!inv) throw new ErrorApp('El código no existe o ya venció. Pide uno nuevo a tu papá o mamá.');
  if (inv.rol !== rol) {
    throw new ErrorApp(
      rol === 'hijo'
        ? 'Este código es para invitar a un padre o madre.'
        : 'Este código es para invitar a un hijo o hija.',
    );
  }
  return inv;
}

export async function revisarCodigo(codigo: string, rol: Rol): Promise<Invitacion> {
  return buscarInvitacionValida(await leer(), codigo, rol);
}
