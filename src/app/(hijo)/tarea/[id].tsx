import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { Estrellas, ICONO_CATEGORIA, InsigniaEstado, NOMBRE_CATEGORIA } from '@/components/tareas';
import { TarjetaTareaHijo } from '@/components/TarjetaTareaHijo';
import { Aviso, Boton, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { capitalizar, formatoDia, formatoHora } from '@/data/fechas';
import { aTiempo } from '@/data/servicios/estadisticas';
import { ocurrenciaDelHijo } from '@/data/servicios/hijo';
import { useConsulta } from '@/data/useConsulta';
import { useAhora } from '@/hooks/useAhora';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio, radio } from '@/theme';

/** M5 — Detalle de una tarea del hijo. Aquí llegan los avisos de M7 (deep link). */
export default function DetalleTareaHijo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useUsuario();
  const ahora = useAhora();
  const { datos: oc } = useConsulta(() => ocurrenciaDelHijo(usuario, id), `${id}|${ahora.getMinutes()}`);

  if (oc === undefined) return null;
  if (oc === null) {
    return (
      <Pantalla bordesSeguros={['bottom']}>
        <Aviso>Esta tarea ya no existe.</Aviso>
      </Pantalla>
    );
  }

  const activa = ['programada', 'atrasada', 'iniciada'].includes(oc.estado);

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Stack.Screen options={{ title: oc.tarea.titulo }} />

      {activa ? (
        <TarjetaTareaHijo oc={oc} hijoId={usuario.id} ahora={ahora} />
      ) : (
        <Tarjeta estilo={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 44 }}>{ICONO_CATEGORIA[oc.tarea.categoria]}</Text>
          <Text style={[estilos.titulo, { textAlign: 'center' }]}>{oc.tarea.titulo}</Text>
          <InsigniaEstado estado={oc.estado} />
        </Tarjeta>
      )}

      {oc.estado === 'aprobada' ? (
        <Seccion titulo="Calificación de tus papás">
          <Tarjeta estilo={{ alignItems: 'center' }}>
            <Estrellas valor={oc.calificacion ?? 0} tamano={32} />
            {oc.comentario ? <Texto centrado>“{oc.comentario}”</Texto> : null}
            {oc.tarea.puntos ? <Insignia texto={`+${oc.tarea.puntos} puntos`} tipo="exito" /> : null}
          </Tarjeta>
        </Seccion>
      ) : null}

      {oc.estado === 'finalizada' ? <Aviso tipo="info">¡Bien! Tus papás la están revisando.</Aviso> : null}
      {oc.estado === 'justificada' ? <Aviso tipo="info">Tus papás están leyendo tu explicación.</Aviso> : null}

      {oc.estado === 'rechazada' && oc.motivoRechazo ? (
        <Seccion titulo="Tus papás dicen">
          <Aviso>“{oc.motivoRechazo}”</Aviso>
          {!oc.justificacion ? (
            <Boton
              titulo="Explicar qué pasó"
              variante="hijo"
              onPress={() => router.navigate({ pathname: '/propuestas', params: { vista: 'justificar' } })}
            />
          ) : (
            <Texto suave>Ya enviaste tu explicación: “{oc.justificacion}”</Texto>
          )}
        </Seccion>
      ) : null}

      <Tarjeta>
        <Dato etiqueta="Categoría" valor={NOMBRE_CATEGORIA[oc.tarea.categoria]} />
        <Dato etiqueta="Día" valor={capitalizar(formatoDia(oc.fecha, { weekday: 'long', day: 'numeric', month: 'short' }))} />
        <Dato etiqueta="Horario" valor={`${formatoHora(oc.inicioProgramado)} – ${formatoHora(oc.limiteProgramado)}`} />
        {oc.iniciadaEn ? <Dato etiqueta="Iniciaste" valor={formatoHora(oc.iniciadaEn)} /> : null}
        {oc.finalizadaEn ? (
          <Dato etiqueta="Terminaste" valor={`${formatoHora(oc.finalizadaEn)} · ${aTiempo(oc) ? 'a tiempo ✓' : 'tarde'}`} />
        ) : null}
        {oc.tarea.puntos ? <Dato etiqueta="Puntos" valor={`⭐ ${oc.tarea.puntos}`} /> : null}
        {oc.tarea.notas ? <Dato etiqueta="Notas" valor={oc.tarea.notas} /> : null}
      </Tarjeta>

      {oc.evidenciaUrl && !activa ? (
        <Seccion titulo="Tu foto">
          <Image source={{ uri: oc.evidenciaUrl }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radio.m }} contentFit="cover" />
        </Seccion>
      ) : null}
    </Pantalla>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={[estilos.filaEntre, { alignItems: 'flex-start', gap: espacio.l }]}>
      <Text style={{ fontSize: 14, color: color.textoSuave }}>{etiqueta}</Text>
      <Text style={[estilos.texto, { flex: 1, textAlign: 'right' }]}>{valor}</Text>
    </View>
  );
}
