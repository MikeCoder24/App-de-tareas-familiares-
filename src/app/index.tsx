import { Redirect } from 'expo-router';

import { destinoDe, useSesion } from '@/session/SesionProvider';

/** Punto de entrada: manda a cada quien a su experiencia según rol y estado. */
export default function Inicio() {
  const { usuario } = useSesion();
  switch (destinoDe(usuario)) {
    case 'padre':
      return <Redirect href="/inicio" />;
    case 'hijo':
      return <Redirect href="/tareas" />;
    case 'espera':
      return <Redirect href="/espera" />;
    default:
      return <Redirect href="/bienvenida" />;
  }
}
