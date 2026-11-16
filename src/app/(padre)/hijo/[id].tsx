import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { BarraProgreso, FilaOcurrencia, Indicador } from '@/components/tareas';
import { Aviso, Avatar, Boton, estilos, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { capitalizar, formatoDia } from '@/data/fechas';
import { detalleHijo } from '@/data/servicios/estadisticas';
import type { OcurrenciaVista } from '@/data/servicios/tareas';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

/** M2 — Detalle del hijo: agenda de hoy, historial, calificación promedio y asignar tarea. */
export default function DetalleHijo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { familia } = useUsuario();
  const { datos: d } = useConsulta(() => detalleHijo(familia.id, id), id);

  if (d === undefined) return null;
  if (d === null) {
    return (
      <Pantalla bordesSeguros={['bottom']}>
        <Aviso>Este hijo ya no pertenece a la familia.</Aviso>
      </Pantalla>
    );
  }

  const abrir = (oc: OcurrenciaVista) =>
    ['finalizada', 'propuesta', 'justificada'].includes(oc.estado)
      ? () => router.push({ pathname: '/revisar/[id]', params: { id: oc.id } })
      : undefined;

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Stack.Screen options={{ title: d.hijo.nombre }} />
      <View style={[estilos.fila, { gap: espacio.l }]}>
        <Avatar emoji={d.hijo.avatar} tamano={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={estilos.titulo}>{d.hijo.nombre}</Text>
          {d.totalHoy ? (
            <>
              <Texto suave>
                {d.hechasHoy} de {d.totalHoy} tareas hoy
              </Texto>
              <BarraProgreso valor={d.hechasHoy} total={d.totalHoy} colorBarra={color.exito} />
            </>
          ) : (
            <Texto suave>Sin tareas hoy</Texto>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        <Indicador valor={`🔥 ${d.racha}`} etiqueta={d.racha === 1 ? 'día de racha' : 'días de racha'} />
        <Indicador
          valor={d.calificacionPromedio ? `★ ${d.calificacionPromedio.toFixed(1)}` : '—'}
          etiqueta="Calificación"
          detalle={d.calificaciones ? `${d.calificaciones} revisadas` : undefined}
        />
        <Indicador valor={String(d.puntos)} etiqueta="Puntos" />
      </View>

      <Boton
        titulo="Asignarle una tarea"
        icono="➕"
        onPress={() => router.push({ pathname: '/editar/[id]', params: { id: 'nueva', hijo: d.hijo.id } })}
      />

      <Seccion titulo="Agenda de hoy">
        <Tarjeta estilo={{ gap: 0, paddingVertical: espacio.xs }}>
          {d.agendaHoy.length === 0 ? <Texto suave>No tiene tareas para hoy.</Texto> : null}
          {d.agendaHoy.map((oc, i) => (
            <View key={oc.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: color.borde } : undefined}>
              <FilaOcurrencia oc={oc} onPress={abrir(oc)} />
            </View>
          ))}
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Historial">
        {d.historial.length === 0 ? <Texto suave>Todavía no hay historial.</Texto> : null}
        {d.historial.map(({ dia, ocurrencias }) => {
          const hechas = ocurrencias.filter((o) => o.estado === 'aprobada' || o.estado === 'finalizada').length;
          return (
            <Tarjeta key={dia} estilo={{ gap: 0, paddingVertical: espacio.s }}>
              <View style={[estilos.filaEntre, { paddingBottom: espacio.xs }]}>
                <Text style={estilos.etiqueta}>
                  {capitalizar(formatoDia(dia, { weekday: 'long', day: 'numeric', month: 'short' }))}
                </Text>
                <Text style={{ fontSize: 13, color: hechas === ocurrencias.length ? '#067647' : color.textoSuave }}>
                  {hechas}/{ocurrencias.length}
                </Text>
              </View>
              {ocurrencias.map((oc) => (
                <FilaOcurrencia key={oc.id} oc={oc} onPress={abrir(oc)} />
              ))}
            </Tarjeta>
          );
        })}
      </Seccion>
    </Pantalla>
  );
}
