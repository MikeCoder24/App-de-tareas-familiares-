// Persistencia local (fase actual). Las pantallas no usan este archivo directo:
// pasan por src/data/servicios para poder cambiar a Supabase sin tocar la UI.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Familia,
  Invitacion,
  Notificacion,
  Ocurrencia,
  Suscripcion,
  Tarea,
  Usuario,
} from './tipos';

const CLAVE = 'tareas-familiares:db:v1';

export interface SesionGuardada {
  usuarioId: string;
  sesionVersion: number;
}

export interface BaseDeDatos {
  familias: Familia[];
  usuarios: Usuario[];
  invitaciones: Invitacion[];
  tareas: Tarea[];
  ocurrencias: Ocurrencia[];
  notificaciones: Notificacion[];
  suscripciones: Suscripcion[];
  /** Estado de este teléfono: hijos vinculados y sesión abierta. */
  dispositivo: {
    hijosVinculados: string[];
    sesion: SesionGuardada | null;
    /** Usuarios que han iniciado sesión en este teléfono (reciben sus avisos aquí). */
    cuentas?: string[];
  };
}

function vacia(): BaseDeDatos {
  return {
    familias: [],
    usuarios: [],
    invitaciones: [],
    tareas: [],
    ocurrencias: [],
    notificaciones: [],
    suscripciones: [],
    dispositivo: { hijosVinculados: [], sesion: null, cuentas: [] },
  };
}

const copiar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let cache: BaseDeDatos | null = null;
let cola: Promise<unknown> = Promise.resolve();
const oyentes = new Set<() => void>();

async function cargar(): Promise<BaseDeDatos> {
  if (cache) return cache;
  const crudo = await AsyncStorage.getItem(CLAVE);
  cache = crudo ? { ...vacia(), ...(JSON.parse(crudo) as Partial<BaseDeDatos>) } : vacia();
  return cache;
}

/** Lectura: devuelve una copia para que nadie mute el estado por fuera de `modificar`. */
export async function leer(): Promise<BaseDeDatos> {
  return copiar(await cargar());
}

/** Escritura serializada: aplica `cambio`, guarda y avisa a los suscriptores. */
export function modificar<T>(cambio: (db: BaseDeDatos) => T): Promise<T> {
  const tarea = cola.then(async () => {
    const actual = await cargar();
    const borrador = copiar(actual);
    const resultado = cambio(borrador);
    await AsyncStorage.setItem(CLAVE, JSON.stringify(borrador));
    cache = borrador;
    oyentes.forEach((fn) => fn());
    return resultado;
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

/**
 * Como `modificar`, pero solo guarda y avisa si `cambio` devuelve true.
 * Para mantenimiento que corre en cada lectura (generar ocurrencias, marcar atrasadas)
 * sin provocar un ciclo de recargas.
 */
export function ajustar(cambio: (db: BaseDeDatos) => boolean): Promise<void> {
  const tarea = cola.then(async () => {
    const borrador = copiar(await cargar());
    if (!cambio(borrador)) return;
    await AsyncStorage.setItem(CLAVE, JSON.stringify(borrador));
    cache = borrador;
    oyentes.forEach((fn) => fn());
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

export function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Solo para desarrollo: borra todos los datos locales. */
export async function borrarTodo(): Promise<void> {
  await modificar((db) => {
    Object.assign(db, vacia());
  });
}
