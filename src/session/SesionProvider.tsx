import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { suscribir } from '@/data/db';
import { cerrarSesion, type SesionActiva, sesionActual } from '@/data/servicios/auth';
import type { Familia, Usuario } from '@/data/tipos';

interface ContextoSesion {
  cargando: boolean;
  usuario: Usuario | null;
  familia: Familia | null;
  salir: () => Promise<void>;
  /** Vuelve a leer la sesión; llamar después de iniciar sesión o registrarse. */
  refrescar: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<SesionActiva | null>(null);

  const refrescar = useCallback(async () => {
    try {
      setSesion(await sesionActual());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
    // Cualquier cambio en los datos (login, aprobación, cierre remoto) re-evalúa la sesión.
    const desuscribir = suscribir(() => void refrescar());
    const app = AppState.addEventListener('change', (e) => e === 'active' && void refrescar());
    return () => {
      desuscribir();
      app.remove();
    };
  }, [refrescar]);

  const salir = useCallback(async () => {
    await cerrarSesion();
    await refrescar();
    router.replace('/');
  }, [refrescar]);

  return (
    <Contexto.Provider
      value={{ cargando, usuario: sesion?.usuario ?? null, familia: sesion?.familia ?? null, salir, refrescar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSesion(): ContextoSesion {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return ctx;
}

/** Para pantallas que solo existen con sesión iniciada (grupos (padre) e (hijo)). */
export function useUsuario(): { usuario: Usuario; familia: Familia; salir: () => Promise<void> } {
  const { usuario, familia, salir } = useSesion();
  if (!usuario || !familia) throw new Error('Pantalla protegida sin sesión');
  return { usuario, familia, salir };
}

export type DestinoSesion = 'acceso' | 'padre' | 'hijo' | 'espera';

export function destinoDe(usuario: Usuario | null): DestinoSesion {
  if (!usuario) return 'acceso';
  if (usuario.estado !== 'activo') return 'espera';
  return usuario.rol === 'padre' ? 'padre' : 'hijo';
}
