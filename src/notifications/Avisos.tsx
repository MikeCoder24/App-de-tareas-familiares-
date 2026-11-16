import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { suscribir } from '@/data/db';
import { useSesion } from '@/session/SesionProvider';

import { configurar, entregarPendientes, pedirPermiso, reprogramarRecordatorios, soportado } from './entrega';

let cola: Promise<unknown> = Promise.resolve();
/** Entrega avisos pendientes y reprograma recordatorios, sin correr dos veces a la vez. */
function sincronizarAvisos() {
  cola = cola
    .then(async () => {
      await entregarPendientes();
      await reprogramarRecordatorios();
    })
    .catch((e) => console.warn('Avisos:', e));
  return cola;
}

let ultimaRespuesta: string | null = null;
function abrir(respuesta: Notifications.NotificationResponse | null | undefined) {
  if (!respuesta || respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const id = respuesta.notification.request.identifier;
  if (id === ultimaRespuesta) return;
  ultimaRespuesta = id;
  const url = respuesta.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
}

/**
 * M7 — Componente sin interfaz montado en la raíz: configura notificaciones, pide permiso
 * al iniciar sesión, entrega avisos cuando cambian los datos y abre la tarea al tocar un aviso.
 */
export function Avisos() {
  const { usuario } = useSesion();
  const usuarioId = usuario?.id;

  useEffect(() => {
    if (!soportado) return;
    configurar().catch((e) => console.warn('Avisos:', e));

    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const programar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(sincronizarAvisos, 700);
    };
    const desuscribir = suscribir(programar);
    const app = AppState.addEventListener('change', (e) => e === 'active' && programar());
    // Cada minuto revisa si hay avisos programados para "ahora".
    const reloj = setInterval(programar, 60_000);

    const toques = Notifications.addNotificationResponseReceivedListener(abrir);
    Notifications.getLastNotificationResponseAsync()
      .then(abrir)
      .catch(() => undefined);

    programar();
    return () => {
      clearTimeout(temporizador);
      clearInterval(reloj);
      desuscribir();
      app.remove();
      toques.remove();
    };
  }, []);

  useEffect(() => {
    if (!soportado || !usuarioId) return;
    pedirPermiso()
      .then(() => sincronizarAvisos())
      .catch((e) => console.warn('Avisos:', e));
  }, [usuarioId]);

  return null;
}
