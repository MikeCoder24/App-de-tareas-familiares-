// ⚠️ Pendiente de producto: límites del plan Gratis y precio de Premium (ver CLAUDE.md).
// Mientras se definen, todo vive aquí para cambiarlo en un solo lugar.
import type { BaseDeDatos } from './db';
import { ErrorApp } from './errores';
import type { Plan } from './tipos';

export interface LimitesPlan {
  hijos: number;
  rutinas: number;
  evidenciaFoto: boolean;
}

export const LIMITES: Record<Plan, LimitesPlan> = {
  gratis: { hijos: 3, rutinas: 10, evidenciaFoto: true },
  premium: { hijos: Infinity, rutinas: Infinity, evidenciaFoto: true },
};

/** ⚠️ Precios provisionales (pendiente de producto). */
export const PRECIOS = {
  mensual: { monto: 49, etiqueta: '$49 MXN al mes' },
  anual: { monto: 449, etiqueta: '$449 MXN al año', ahorro: 'Ahorra 2 meses' },
} as const;

export const BENEFICIOS: Record<Plan, string[]> = {
  gratis: [`Hasta ${LIMITES.gratis.hijos} hijos`, `Hasta ${LIMITES.gratis.rutinas} rutinas activas`, 'Tareas, recordatorios y revisión'],
  premium: ['Hijos ilimitados', 'Rutinas ilimitadas', 'Evidencia con foto', 'Estadísticas completas'],
};

function planDe(db: BaseDeDatos, familiaId: string): Plan {
  return db.familias.find((f) => f.id === familiaId)?.plan ?? 'gratis';
}

export function exigirCupoHijos(db: BaseDeDatos, familiaId: string, nuevos = 1) {
  const plan = planDe(db, familiaId);
  const actuales = db.usuarios.filter((u) => u.familiaId === familiaId && u.rol === 'hijo' && u.estado === 'activo').length;
  if (actuales + nuevos > LIMITES[plan].hijos) {
    throw new ErrorApp(`El plan Gratis permite hasta ${LIMITES[plan].hijos} hijos. Cámbiate a Premium para agregar más.`);
  }
}

export function exigirCupoRutinas(db: BaseDeDatos, familiaId: string, nuevas: number) {
  const plan = planDe(db, familiaId);
  const actuales = db.tareas.filter((t) => t.familiaId === familiaId && t.repeticion && !t.cancelada).length;
  if (actuales + nuevas > LIMITES[plan].rutinas) {
    throw new ErrorApp(
      `El plan Gratis permite hasta ${LIMITES[plan].rutinas} rutinas activas (tienes ${actuales}). Cancela alguna o cámbiate a Premium.`,
    );
  }
}
