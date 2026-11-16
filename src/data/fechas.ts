// Utilidades de fecha en hora local. Un "día" se representa como `YYYY-MM-DD`.

const dos = (n: number) => String(n).padStart(2, '0');

export function claveDia(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function deClave(clave: string): Date {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function sumarDias(clave: string, dias: number): string {
  const d = deClave(clave);
  d.setDate(d.getDate() + dias);
  return claveDia(d);
}

export const hoy = () => claveDia(new Date());

/** Lunes de la semana que contiene `clave`. */
export function inicioSemana(clave: string): string {
  const d = deClave(clave);
  const desdeLunes = (d.getDay() + 6) % 7;
  return sumarDias(clave, -desdeLunes);
}

/** Lista de días de `desde` a `hasta`, inclusive. */
export function rangoDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let c = desde; c <= hasta; c = sumarDias(c, 1)) dias.push(c);
  return dias;
}

/** Combina un día con la hora del día de una fecha ISO. */
export function conHoraDe(clave: string, isoHora: string): Date {
  const h = new Date(isoHora);
  const d = deClave(clave);
  d.setHours(h.getHours(), h.getMinutes(), 0, 0);
  return d;
}

/** "5:30 p.m." — formato manual para que Android, iOS y web se vean igual. */
export function formatoHora(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${dos(d.getMinutes())} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

export function formatoDia(clave: string, opciones: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }) {
  return deClave(clave).toLocaleDateString('es-MX', opciones);
}

/** Inicial del día de la semana para ejes: L M M J V S D. */
export function inicialDia(clave: string): string {
  return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][deClave(clave).getDay()];
}

export const CODIGOS_DIA = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type CodigoDia = (typeof CODIGOS_DIA)[number];

export const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
