// M3 — Programar alertas. M7 las lee para decidir cuándo y a quién avisar.
import { leer, modificar } from '../db';
import { ErrorApp } from '../errores';
import type { ConfigAlertas, Familia } from '../tipos';
import { exigirPadreActivo } from './permisos';

export const OPCIONES_RECORDATORIO = [5, 10, 15, 30] as const;

export const ALERTAS_POR_DEFECTO: ConfigAlertas = {
  recordatorioMin: 10,
  avisoNoIniciado: { activo: true, minutos: 10 },
  sinAvisoInicioFin: [],
  silencio: { activo: true, desde: '21:00', hasta: '07:00' },
  resumenDiario: '20:00',
};

export function alertasDe(familia: Familia | undefined | null): ConfigAlertas {
  return { ...ALERTAS_POR_DEFECTO, ...(familia?.alertas ?? {}) };
}

export async function leerAlertas(familiaId: string): Promise<ConfigAlertas> {
  const db = await leer();
  return alertasDe(db.familias.find((f) => f.id === familiaId));
}

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function guardarAlertas(padreId: string, cambios: Partial<ConfigAlertas>): Promise<void> {
  const horas = [cambios.silencio?.desde, cambios.silencio?.hasta, cambios.resumenDiario].filter(
    (h): h is string => typeof h === 'string',
  );
  if (horas.some((h) => !RE_HORA.test(h))) throw new ErrorApp('Hora inválida.');
  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const familia = db.familias.find((f) => f.id === padre.familiaId);
    if (!familia) throw new ErrorApp('No se encontró la familia.');
    familia.alertas = { ...alertasDe(familia), ...cambios };
  });
}

/** ¿Está `fecha` dentro del horario silencioso? (el rango puede cruzar medianoche) */
export function enSilencio(config: ConfigAlertas, fecha: Date): boolean {
  if (!config.silencio.activo) return false;
  const m = fecha.getHours() * 60 + fecha.getMinutes();
  const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const desde = aMin(config.silencio.desde);
  const hasta = aMin(config.silencio.hasta);
  return desde <= hasta ? m >= desde && m < hasta : m >= desde || m < hasta;
}
