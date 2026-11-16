// M7 — Entrega en el teléfono (modo local / Expo Go).
// - Avisos de eventos: los registros de `db.notificaciones` para las cuentas de este teléfono
//   se muestran como notificación local inmediata (con Supabase llegarán como push).
// - Recordatorios (faltan N min, no se inició, resumen diario): se programan como notificaciones
//   locales con fecha. Es también el respaldo sin internet que pide el documento.
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { ajustar, type BaseDeDatos, leer } from '@/data/db';
import { claveDia, formatoHora } from '@/data/fechas';
import { alertasDe, enSilencio } from '@/data/servicios/alertas';
import { estaHecha } from '@/data/servicios/estadisticas';
import { sincronizar, vistas } from '@/data/servicios/tareas';
import type { Notificacion } from '@/data/tipos';

export const CANAL_AVISOS = 'avisos';
export const CANAL_RECORDATORIOS = 'recordatorios';
/** Avisos más viejos que esto ya no se muestran (p. ej. se generaron sin permiso). */
const VIGENCIA_AVISO_MS = 2 * 60 * 60_000;
const HORIZONTE_MS = 26 * 60 * 60_000;

export const soportado = Platform.OS !== 'web';

export async function configurar() {
  if (!soportado) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    canales.avisos = await crearCanal(CANAL_AVISOS, 'Avisos de tareas');
    canales.recordatorios = await crearCanal(CANAL_RECORDATORIOS, 'Recordatorios');
  }
}

/** Canales de Android creados. En Expo Go a veces falla crearlos: se usa el canal por defecto. */
const canales = { avisos: false, recordatorios: false };

async function crearCanal(id: string, nombre: string): Promise<boolean> {
  try {
    await Notifications.setNotificationChannelAsync(id, {
      name: nombre,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
    return true;
  } catch (e) {
    console.warn(`No se pudo crear el canal "${id}"; se usa el canal por defecto.`, e);
    return false;
  }
}

export async function pedirPermiso(): Promise<boolean> {
  if (!soportado) return false;
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  if (!actual.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Usuarios cuyos avisos se muestran en este teléfono. */
function cuentasDelDispositivo(db: BaseDeDatos): Set<string> {
  const ids = new Set([...(db.dispositivo.cuentas ?? []), ...db.dispositivo.hijosVinculados]);
  if (db.dispositivo.sesion) ids.add(db.dispositivo.sesion.usuarioId);
  return ids;
}

/** Muestra los avisos pendientes de este teléfono y los marca como enviados. */
export async function entregarPendientes(): Promise<number> {
  if (!soportado) return 0;
  const ahora = new Date();
  let porMostrar: Notificacion[] = [];
  await ajustar((db) => {
    const cuentas = cuentasDelDispositivo(db);
    porMostrar = [];
    let cambio = false;
    for (const n of db.notificaciones) {
      if (n.enviadaEn || !cuentas.has(n.usuarioId) || new Date(n.programadaPara) > ahora) continue;
      n.enviadaEn = ahora.toISOString();
      cambio = true;
      const usuario = db.usuarios.find((u) => u.id === n.usuarioId);
      const familia = usuario && db.familias.find((f) => f.id === usuario.familiaId);
      const vigente = ahora.getTime() - new Date(n.programadaPara).getTime() < VIGENCIA_AVISO_MS;
      if (vigente && !enSilencio(alertasDe(familia), ahora)) porMostrar.push(n);
    }
    return cambio;
  });
  for (const n of porMostrar) {
    await Notifications.scheduleNotificationAsync({
      content: { title: n.titulo, body: n.cuerpo, data: { url: n.url } },
      trigger: canales.avisos ? { channelId: CANAL_AVISOS } : null,
    });
  }
  return porMostrar.length;
}

interface Recordatorio {
  fecha: Date;
  titulo: string;
  cuerpo: string;
  url: string;
}

/** Calcula los recordatorios de las próximas horas para las cuentas de este teléfono. */
export function calcularRecordatorios(db: BaseDeDatos, ahora = new Date()): Recordatorio[] {
  const cuentas = cuentasDelDispositivo(db);
  const limite = ahora.getTime() + HORIZONTE_MS;
  const res: Recordatorio[] = [];
  const familias = new Set(db.usuarios.filter((u) => cuentas.has(u.id)).map((u) => u.familiaId));

  for (const familiaId of familias) {
    // `db` es una copia de lectura: generar las rutinas de mañana aquí no se guarda.
    sincronizar(db, familiaId, ahora, 1);
    const familia = db.familias.find((f) => f.id === familiaId);
    const config = alertasDe(familia);
    const padresAqui = db.usuarios.filter(
      (u) => u.familiaId === familiaId && u.rol === 'padre' && u.estado === 'activo' && cuentas.has(u.id),
    );
    const agregar = (r: Recordatorio) => {
      const t = r.fecha.getTime();
      if (t > ahora.getTime() && t <= limite && !enSilencio(config, r.fecha)) res.push(r);
    };

    for (const oc of vistas(db, familiaId, () => true)) {
      if (oc.estado !== 'programada') continue;
      const inicio = new Date(oc.inicioProgramado).getTime();
      // Faltan N minutos → hijo.
      if (cuentas.has(oc.hijo.id)) {
        agregar({
          fecha: new Date(inicio - oc.tarea.recordatorioMin * 60_000),
          titulo: `En ${oc.tarea.recordatorioMin} min: ${oc.tarea.titulo}`,
          cuerpo: 'Entra y confírmala como iniciada.',
          url: `/tarea/${oc.id}`,
        });
      }
      // No se inició a tiempo → hijo y padre (si el padre lo tiene activado).
      if (config.avisoNoIniciado.activo) {
        const cuandoAviso = new Date(inicio + config.avisoNoIniciado.minutos * 60_000);
        if (cuentas.has(oc.hijo.id)) {
          agregar({ fecha: cuandoAviso, titulo: `${oc.tarea.titulo} aún no se inicia`, cuerpo: '¡Todavía puedes iniciarla!', url: `/tarea/${oc.id}` });
        }
        // Una sola notificación por teléfono aunque haya dos padres registrados en él.
        if (padresAqui.length) {
          agregar({
            fecha: cuandoAviso,
            titulo: `${oc.tarea.titulo} aún no se inicia`,
            cuerpo: `${oc.hijo.nombre} no la ha iniciado (era a las ${formatoHora(oc.inicioProgramado)}).`,
            url: `/hijo/${oc.hijo.id}`,
          });
        }
      }
    }

    // Resumen diario → padres.
    if (config.resumenDiario && padresAqui.length) {
      const [h, m] = config.resumenDiario.split(':').map(Number);
      const fecha = new Date(ahora);
      fecha.setHours(h, m, 0, 0);
      if (fecha <= ahora) fecha.setDate(fecha.getDate() + 1);
      const dia = claveDia(fecha);
      const delDia = vistas(db, familiaId, (o) => o.fecha === dia && o.estado !== 'propuesta');
      const porHijo = new Map<string, { nombre: string; hechas: number; total: number }>();
      for (const o of delDia) {
        const r = porHijo.get(o.hijo.id) ?? { nombre: o.hijo.nombre, hechas: 0, total: 0 };
        r.total++;
        if (estaHecha(o)) r.hechas++;
        porHijo.set(o.hijo.id, r);
      }
      const texto = [...porHijo.values()].map((r) => `${r.nombre} ${r.hechas}/${r.total}`).join(' · ');
      agregar({
        fecha,
        titulo: 'Resumen del día',
        cuerpo: texto ? `${texto}. Toca para ver los detalles.` : 'Hoy no hubo tareas.',
        url: '/inicio',
      });
    }
  }
  return res.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(0, 60);
}

/** Vuelve a programar todos los recordatorios (se llama cuando cambian los datos). */
export async function reprogramarRecordatorios(): Promise<number> {
  if (!soportado) return 0;
  const db = await leer();
  const recordatorios = calcularRecordatorios(db);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of recordatorios) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.titulo, body: r.cuerpo, data: { url: r.url } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.fecha,
        ...(canales.recordatorios ? { channelId: CANAL_RECORDATORIOS } : {}),
      },
    });
  }
  return recordatorios.length;
}
