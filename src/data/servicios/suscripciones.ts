// M4 — Suscripciones. En Expo Go no hay compras integradas: la "tienda" es simulada.
// Al pasar a development build, `tienda` se reemplaza por RevenueCat (Purchases.purchasePackage,
// Purchases.restorePurchases) y el servidor valida con webhooks; la UI no cambia.
import { Platform } from 'react-native';

import { ajustar, type BaseDeDatos, leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import type { Suscripcion } from '../tipos';
import { exigirPadreActivo } from './permisos';

export type Periodo = 'mensual' | 'anual';

function suscripcionDe(db: BaseDeDatos, familiaId: string): Suscripcion {
  let s = db.suscripciones.find((x) => x.familiaId === familiaId);
  if (!s) {
    s = { familiaId, plan: 'gratis', tienda: null, vence: null };
    db.suscripciones.push(s);
  }
  return s;
}

/** Si el periodo pagado terminó: renueva (si está activa la renovación) o vuelve a Gratis. */
function vencer(db: BaseDeDatos, familiaId: string, ahora = new Date()): boolean {
  const s = db.suscripciones.find((x) => x.familiaId === familiaId);
  if (!s || s.plan !== 'premium' || !s.vence || new Date(s.vence) > ahora) return false;
  if (s.renovacionAutomatica) {
    let vence = new Date(s.vence);
    while (vence <= ahora) vence = sumarPeriodo(vence, s.periodo ?? 'mensual');
    s.vence = vence.toISOString();
  } else {
    Object.assign(s, { plan: 'gratis', vence: null, periodo: null, tienda: null, renovacionAutomatica: false, simulada: false });
  }
  const familia = db.familias.find((f) => f.id === familiaId);
  if (familia) familia.plan = s.plan;
  return true;
}

function sumarPeriodo(d: Date, periodo: Periodo): Date {
  const r = new Date(d);
  if (periodo === 'anual') r.setFullYear(r.getFullYear() + 1);
  else r.setMonth(r.getMonth() + 1);
  return r;
}

export async function obtenerSuscripcion(familiaId: string): Promise<Suscripcion> {
  await ajustar((db) => vencer(db, familiaId));
  const db = await leer();
  return db.suscripciones.find((x) => x.familiaId === familiaId) ?? { familiaId, plan: 'gratis', tienda: null, vence: null };
}

export async function comprarPremium(padreId: string, periodo: Periodo): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const s = suscripcionDe(db, padre.familiaId);
    if (s.plan === 'premium' && s.renovacionAutomatica) throw new ErrorApp('Ya tienes Premium.');
    const ahora = new Date();
    Object.assign(s, {
      plan: 'premium',
      periodo,
      tienda: Platform.OS === 'ios' ? 'app_store' : 'play_store',
      vence: sumarPeriodo(s.plan === 'premium' && s.vence ? new Date(s.vence) : ahora, periodo).toISOString(),
      renovacionAutomatica: true,
      simulada: true,
    } satisfies Partial<Suscripcion>);
    const familia = db.familias.find((f) => f.id === padre.familiaId);
    if (familia) familia.plan = 'premium';
  });
}

/** Cancela la renovación: sigue en Premium hasta que termine el periodo pagado. */
export async function cancelarRenovacion(padreId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const s = suscripcionDe(db, padre.familiaId);
    if (s.plan !== 'premium') throw new ErrorApp('No tienes una suscripción activa.');
    s.renovacionAutomatica = false;
  });
}

export async function reactivarRenovacion(padreId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const s = suscripcionDe(db, padre.familiaId);
    if (s.plan !== 'premium') throw new ErrorApp('No tienes una suscripción activa.');
    s.renovacionAutomatica = true;
  });
}

/** Restaurar compras: con RevenueCat consulta la tienda; en modo simulado solo revisa el estado guardado. */
export async function restaurarCompras(padreId: string): Promise<Suscripcion> {
  const db = await leer();
  const padre = exigirPadreActivo(db, padreId);
  return obtenerSuscripcion(padre.familiaId);
}

/** SOLO DESARROLLO: adelanta el vencimiento para probar renovación y regreso a Gratis. */
export async function simularVencimiento(padreId: string): Promise<void> {
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const s = suscripcionDe(db, padre.familiaId);
    if (s.plan !== 'premium') throw new ErrorApp('No tienes Premium.');
    s.vence = new Date(Date.now() - 1000).toISOString();
    vencer(db, padre.familiaId);
  });
}
