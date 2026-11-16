import { Pantalla, Seccion, Texto } from '@/components/ui';

export default function Privacidad() {
  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Texto suave>Versión preliminar — el texto legal definitivo se agregará antes de publicar en tiendas.</Texto>
      <Seccion titulo="Qué datos guardamos">
        <Texto>
          • Del padre o madre: nombre, correo o teléfono y contraseña (cifrada).{'\n'}• De cada hijo o hija: solo
          nombre o apodo, avatar y un PIN de 4 números (cifrado). No pedimos correo ni teléfono de menores.{'\n'}• Las
          tareas de la familia, sus horarios, estados y calificaciones.
        </Texto>
      </Seccion>
      <Seccion titulo="Para qué los usamos">
        <Texto>Para organizar las tareas de tu familia y enviar avisos y recordatorios entre padres e hijos.</Texto>
      </Seccion>
      <Seccion titulo="Quién los ve">
        <Texto>
          Solo los miembros aprobados de tu familia. Un hijo solo entra con la invitación y aprobación de un padre o
          madre.
        </Texto>
      </Seccion>
      <Seccion titulo="Tus derechos">
        <Texto>
          El padre o madre puede desvincular a un hijo o eliminar la cuenta y la familia completa en cualquier momento
          desde la sección Familia.
        </Texto>
      </Seccion>
    </Pantalla>
  );
}
