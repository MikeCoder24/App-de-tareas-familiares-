import { Aviso, Pantalla, Seccion, Texto } from '@/components/ui';

/** M1 flujo 6 — Recuperar acceso. */
export default function Olvide() {
  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Seccion titulo="Padre o madre">
        <Texto>Te enviaremos un enlace a tu correo para crear una contraseña nueva.</Texto>
        <Aviso tipo="info">
          El envío de correos se activa al conectar la app con el servidor (Supabase). Mientras tanto, si olvidaste tu
          contraseña en esta versión de prueba, crea una cuenta nueva.
        </Aviso>
      </Seccion>
      <Seccion titulo="Hijo o hija">
        <Texto>
          Si olvidaste tu PIN, pídele a tu papá o mamá que lo restablezca desde Gestión › Hijos › Restablecer PIN.
        </Texto>
      </Seccion>
    </Pantalla>
  );
}
