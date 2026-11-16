// Modelo de datos — ver CLAUDE.md, sección "Modelo de datos".
// Fechas en ISO 8601 (string) para que se serialicen igual en local y en Supabase.

export type Rol = 'padre' | 'hijo';
export type EstadoUsuario = 'pendiente' | 'activo' | 'rechazado' | 'desvinculado';
export type Plan = 'gratis' | 'premium';
export type Categoria = 'domestica' | 'escolar';

export type EstadoOcurrencia =
  | 'propuesta'
  | 'programada'
  | 'iniciada'
  | 'finalizada'
  | 'aprobada'
  | 'atrasada'
  | 'rechazada'
  | 'justificada';

export interface Familia {
  id: string;
  nombre: string;
  foto: string | null;
  plan: Plan;
  creadaEn: string;
  /** Opcional en datos viejos: usar `alertasDe(familia)`. */
  alertas?: ConfigAlertas;
}

/** M3 — Programar alertas. Horas en formato `HH:MM` (24 h). */
export interface ConfigAlertas {
  /** Minutos antes del inicio para recordar al hijo (valor general; cada tarea puede cambiarlo). */
  recordatorioMin: number;
  avisoNoIniciado: { activo: boolean; minutos: number };
  /** Hijos con el aviso al padre al iniciar/finalizar apagado (por defecto todos encendidos). */
  sinAvisoInicioFin: string[];
  silencio: { activo: boolean; desde: string; hasta: string };
  /** Hora del resumen diario o null si está apagado. */
  resumenDiario: string | null;
}

export interface Usuario {
  id: string;
  familiaId: string;
  rol: Rol;
  nombre: string;
  avatar: string;
  estado: EstadoUsuario;
  /** Solo padres: correo o teléfono normalizado. Al hijo no se le pide. */
  identificador: string | null;
  /** Padre: hash de la contraseña. Hijo: hash del PIN de 4 dígitos. */
  secretoHash: string;
  secretoSal: string;
  pushToken: string | null;
  /** Se incrementa para cerrar la sesión del usuario a distancia. */
  sesionVersion: number;
  creadoEn: string;
}

export interface Invitacion {
  codigo: string;
  familiaId: string;
  rol: Rol;
  creadaPor: string;
  creadaEn: string;
  expira: string;
  usada: boolean;
}

export interface Tarea {
  id: string;
  familiaId: string;
  titulo: string;
  categoria: Categoria;
  asignadoA: string;
  /** Fecha y hora (ISO) de la primera ocurrencia; en rutinas define la hora del día. */
  horaInicio: string;
  /** Fecha y hora límite (ISO) de la primera ocurrencia; en rutinas define la duración. */
  horaLimite: string;
  /** Regla tipo RRULE (`FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO,WE`); null = una sola vez. */
  repeticion: string | null;
  recordatorioMin: number;
  requiereFoto: boolean;
  puntos: number | null;
  notas: string;
  origen: 'padre' | 'propuesta';
  creadaPor: string;
  creadaEn: string;
  /** Rutina o tarea cancelada: no genera más ocurrencias. */
  cancelada: boolean;
}

export interface Ocurrencia {
  id: string;
  tareaId: string;
  /** Día local `YYYY-MM-DD` en que toca (cambia si el padre reprograma). */
  fecha: string;
  /** Día que la generó (solo si se reprogramó a otro día); evita que la rutina la vuelva a crear. */
  diaOrigen?: string;
  /** Hora de inicio y límite concretas de este día (ISO); cambian si el padre reprograma. */
  inicioProgramado: string;
  limiteProgramado: string;
  estado: EstadoOcurrencia;
  iniciadaEn: string | null;
  finalizadaEn: string | null;
  /** 1 a 5 estrellas que da el padre al aprobar. */
  calificacion: number | null;
  /** Comentario del padre al aprobar (se ve en el dashboard de satisfacción del hijo). */
  comentario: string | null;
  motivoRechazo: string | null;
  /** Motivo de la propuesta del hijo (M6). */
  motivoPropuesta: string | null;
  justificacion: string | null;
  justificacionFotoUrl: string | null;
  evidenciaUrl: string | null;
  /** Cuándo el padre aprobó o rechazó por última vez. */
  revisadaEn: string | null;
  /** Cuándo cambió de estado por última vez (orden de "Por revisar"). */
  actualizadaEn: string;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: string;
  ocurrenciaId: string | null;
  titulo: string;
  cuerpo: string;
  /** Ruta que se abre al tocar el aviso (deep link). */
  url: string;
  programadaPara: string;
  enviadaEn: string | null;
  leida: boolean;
}

export interface Suscripcion {
  familiaId: string;
  plan: Plan;
  tienda: 'app_store' | 'play_store' | null;
  /** Fin del periodo pagado (ISO). null en Gratis. */
  vence: string | null;
  periodo?: 'mensual' | 'anual' | null;
  /** false = el padre canceló: sigue en Premium hasta `vence` y luego vuelve a Gratis. */
  renovacionAutomatica?: boolean;
  /** true mientras los cobros sean simulados (Expo Go, sin RevenueCat). */
  simulada?: boolean;
}
