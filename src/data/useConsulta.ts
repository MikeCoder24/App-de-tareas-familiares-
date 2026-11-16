import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { suscribir } from './db';

/**
 * Ejecuta una consulta a los servicios y la repite cuando cambian los datos
 * locales, cuando cambia `clave` o cuando la pantalla vuelve a tener foco.
 */
export function useConsulta<T>(consulta: () => Promise<T>, clave = ''): { datos: T | undefined } {
  const [datos, setDatos] = useState<T>();
  const [foco, setFoco] = useState(0);
  const ejecutar = useEffectEvent(() => consulta());

  useEffect(() => {
    let vigente = true;
    const correr = () => {
      ejecutar().then((d) => vigente && setDatos(d), console.error);
    };
    correr();
    const desuscribir = suscribir(correr);
    return () => {
      vigente = false;
      desuscribir();
    };
  }, [clave, foco]);

  useFocusEffect(useCallback(() => setFoco((f) => f + 1), []));

  return { datos };
}
