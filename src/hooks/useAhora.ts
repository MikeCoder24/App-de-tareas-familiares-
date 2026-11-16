import { useEffect, useState } from 'react';

/** Hora actual que se actualiza cada `cadaMs` (para activar botones o pasar tareas a atrasadas). */
export function useAhora(cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
