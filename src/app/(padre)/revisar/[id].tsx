import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { avisar } from '@/components/dialogos';
import { hora12, SelectorFecha, SelectorHora } from '@/components/formulario';
import { Estrellas, ICONO_CATEGORIA, InsigniaEstado, NOMBRE_CATEGORIA } from '@/components/tareas';
import { Aviso, Avatar, Boton, Campo, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { capitalizar, formatoDia, formatoHora, hoy, sumarDias } from '@/data/fechas';
import { aTiempo } from '@/data/servicios/estadisticas';
import { aceptarSinCalificar, motivoDe, reprogramar } from '@/data/servicios/propuestas';
import { aprobarOcurrencia, aprobarPropuesta, ocurrencia, rechazarOcurrencia } from '@/data/servicios/tareas';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio, radio } from '@/theme';

/** M2 — Revisar: aprobar con 1–5 estrellas, rechazar con motivo, o decidir una propuesta. */
export default function Revisar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario, familia } = useUsuario();
  const { datos: oc } = useConsulta(() => ocurrencia(familia.id, id), id);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [reprogramando, setReprogramando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(sumarDias(hoy(), 1));
  const [nuevaHora, setNuevaHora] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (oc === undefined) return null;
  if (oc === null) {
    return (
      <Pantalla bordesSeguros={['bottom']}>
        <Aviso>Esta tarea ya no existe.</Aviso>
      </Pantalla>
    );
  }

  const esPropuesta = oc.estado === 'propuesta';
  const esJustificacion = oc.estado === 'justificada';
  const motivoJ = esJustificacion ? motivoDe(oc) : null;
  const inicioOriginal = new Date(oc.inicioProgramado);
  const horaElegida =
    nuevaHora ?? `${String(inicioOriginal.getHours()).padStart(2, '0')}:${String(inicioOriginal.getMinutes()).padStart(2, '0')}`;
  const pendiente = ['finalizada', 'propuesta', 'justificada'].includes(oc.estado);

  async function ejecutar(accion: () => Promise<void>, mensaje: string) {
    setError('');
    setEnviando(true);
    try {
      await accion();
      router.back();
      avisar('Listo', mensaje);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <View style={estilos.fila}>
        <Avatar emoji={oc.hijo.avatar} tamano={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.titulo}>{oc.tarea.titulo}</Text>
          <Texto suave>
            {oc.hijo.nombre} · {ICONO_CATEGORIA[oc.tarea.categoria]} {NOMBRE_CATEGORIA[oc.tarea.categoria]}
          </Texto>
        </View>
      </View>

      <Tarjeta>
        <Dato etiqueta="Estado" valor={<InsigniaEstado estado={oc.estado} />} />
        <Dato
          etiqueta={esPropuesta ? 'Sugerida para' : 'Programada'}
          valor={`${formatoDia(oc.fecha, { weekday: 'long', day: 'numeric', month: 'short' })}, ${formatoHora(oc.inicioProgramado)} – ${formatoHora(oc.limiteProgramado)}`}
        />
        {oc.iniciadaEn ? <Dato etiqueta="Inició" valor={formatoHora(oc.iniciadaEn)} /> : null}
        {oc.finalizadaEn ? (
          <Dato
            etiqueta="Terminó"
            valor={
              <View style={[estilos.fila, { gap: espacio.s }]}>
                <Text style={estilos.texto}>{formatoHora(oc.finalizadaEn)}</Text>
                <Insignia texto={aTiempo(oc) ? 'A tiempo' : 'Tarde'} tipo={aTiempo(oc) ? 'exito' : 'aviso'} />
              </View>
            }
          />
        ) : null}
        {oc.tarea.puntos ? <Dato etiqueta="Puntos" valor={`${oc.tarea.puntos}`} /> : null}
        {oc.tarea.notas ? <Dato etiqueta="Notas" valor={oc.tarea.notas} /> : null}
      </Tarjeta>

      {oc.evidenciaUrl ? (
        <Seccion titulo="Evidencia">
          <Image source={{ uri: oc.evidenciaUrl }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radio.m }} contentFit="cover" />
        </Seccion>
      ) : null}

      {oc.motivoPropuesta ? (
        <Seccion titulo={`Por qué lo propone ${oc.hijo.nombre}`}>
          <Cita texto={oc.motivoPropuesta} />
        </Seccion>
      ) : null}

      {esJustificacion ? (
        <Seccion titulo={`Justificación de ${oc.hijo.nombre}`}>
          <View style={{ alignItems: 'flex-start' }}>
          <Insignia
            texto={
              motivoJ === 'no_iniciada' ? 'No la inició a tiempo' : motivoJ === 'propuesta_rechazada' ? 'Propuesta que rechazaste' : 'Tarea que rechazaste'
            }
            tipo="aviso"
          />
          </View>
          {oc.motivoRechazo ? <Texto suave>Tu motivo: “{oc.motivoRechazo}”</Texto> : null}
          <Cita texto={oc.justificacion ?? ''} />
          {oc.justificacionFotoUrl ? (
            <Image source={{ uri: oc.justificacionFotoUrl }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radio.m }} />
          ) : null}
        </Seccion>
      ) : null}

      <Aviso>{error}</Aviso>

      {!pendiente ? (
        <Aviso tipo="info">Esta tarea ya fue revisada.</Aviso>
      ) : rechazando ? (
        <Seccion titulo={esJustificacion ? 'Mantener el rechazo' : 'Rechazar'}>
          <Campo
            etiqueta="Motivo (lo verá tu hijo)"
            value={motivo}
            onChangeText={setMotivo}
            placeholder={esPropuesta ? 'Ej. Ese día tenemos visita' : 'Ej. Faltó secar los trastes'}
            multiline
            autoFocus
          />
          <View style={estilos.fila}>
            <Boton titulo="Volver" variante="secundario" estilo={{ flex: 1 }} onPress={() => setRechazando(false)} />
            <Boton
              titulo="Confirmar"
              variante="peligro"
              estilo={{ flex: 1 }}
              cargando={enviando}
              onPress={() => ejecutar(() => rechazarOcurrencia(usuario.id, oc.id, motivo), `Le avisamos a ${oc.hijo.nombre} el motivo.`)}
            />
          </View>
        </Seccion>
      ) : esPropuesta ? (
        <View style={{ gap: espacio.s }}>
          <Boton
            titulo="Aprobar propuesta"
            cargando={enviando}
            onPress={() =>
              ejecutar(() => aprobarPropuesta(usuario.id, oc.id), `“${oc.tarea.titulo}” ya es una tarea de ${oc.hijo.nombre}.`)
            }
          />
          <Boton titulo="Rechazar" variante="peligro" onPress={() => setRechazando(true)} />
        </View>
      ) : reprogramando ? (
        <Seccion titulo="Reprogramar">
          <Texto suave>Elige el nuevo día y hora. Dura lo mismo que antes y {oc.hijo.nombre} podrá volver a hacerla.</Texto>
          <SelectorFecha valor={nuevaFecha} onCambio={setNuevaFecha} />
          <Tarjeta>
            <SelectorHora valor={horaElegida} onCambio={setNuevaHora} />
          </Tarjeta>
          <View style={estilos.fila}>
            <Boton titulo="Volver" variante="secundario" estilo={{ flex: 1 }} onPress={() => setReprogramando(false)} />
            <Boton
              titulo="Reprogramar"
              estilo={{ flex: 1 }}
              cargando={enviando}
              onPress={() =>
                ejecutar(
                  () => reprogramar(usuario.id, oc.id, nuevaFecha, horaElegida),
                  `Se reprogramó para ${capitalizar(formatoDia(nuevaFecha))} a las ${hora12(horaElegida)}`,
                )
              }
            />
          </View>
        </Seccion>
      ) : esJustificacion ? (
        <Seccion titulo="¿Qué decides?">
          {motivoJ === 'tarea_rechazada' ? (
            <Tarjeta estilo={{ alignItems: 'stretch' }}>
              <Texto suave centrado>
                Si la aceptas, califícala:
              </Texto>
              <Estrellas valor={estrellas} onCambio={setEstrellas} />
              <Campo etiqueta="Comentario (opcional)" value={comentario} onChangeText={setComentario} placeholder="Ej. Gracias por explicarme" />
              <Boton
                titulo="Aceptar y aprobar"
                cargando={enviando}
                deshabilitado={!estrellas}
                onPress={() =>
                  ejecutar(() => aprobarOcurrencia(usuario.id, oc.id, estrellas, comentario), `${oc.hijo.nombre} recibió ${'★'.repeat(estrellas)}.`)
                }
              />
            </Tarjeta>
          ) : motivoJ === 'no_iniciada' ? (
            <Boton
              titulo="Aceptar la explicación"
              cargando={enviando}
              onPress={() => ejecutar(() => aceptarSinCalificar(usuario.id, oc.id), 'Se aceptó la explicación; la tarea queda cerrada.')}
            />
          ) : null}
          <Boton
            titulo={motivoJ === 'propuesta_rechazada' ? 'Aceptar y programarla' : 'Reprogramar'}
            variante={motivoJ === 'propuesta_rechazada' ? 'primario' : 'secundario'}
            onPress={() => setReprogramando(true)}
          />
          <Boton titulo="Mantener el rechazo" variante="peligro" onPress={() => setRechazando(true)} />
        </Seccion>
      ) : (
        <Seccion titulo="Califica la tarea">
          <Tarjeta estilo={{ alignItems: 'stretch' }}>
            <Estrellas valor={estrellas} onCambio={setEstrellas} />
            <Texto suave centrado>
              {estrellas ? ['', 'Necesita mejorar', 'Regular', 'Bien', 'Muy bien', '¡Excelente!'][estrellas] : 'Toca las estrellas'}
            </Texto>
            <Campo
              etiqueta="Comentario (opcional)"
              value={comentario}
              onChangeText={setComentario}
              placeholder="Ej. ¡Quedó impecable!"
            />
          </Tarjeta>
          <Boton
            titulo="Aprobar"
            cargando={enviando}
            deshabilitado={!estrellas}
            onPress={() =>
              ejecutar(
                () => aprobarOcurrencia(usuario.id, oc.id, estrellas, comentario),
                `${oc.hijo.nombre} recibió ${'★'.repeat(estrellas)}.`,
              )
            }
          />
          <Boton titulo="Rechazar" variante="peligro" onPress={() => setRechazando(true)} />
        </Seccion>
      )}
    </Pantalla>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <View style={[estilos.filaEntre, { alignItems: 'flex-start' }]}>
      <Text style={{ fontSize: 14, color: color.textoSuave }}>{etiqueta}</Text>
      {typeof valor === 'string' ? (
        <Text style={[estilos.texto, { flex: 1, textAlign: 'right' }]}>{valor}</Text>
      ) : (
        valor
      )}
    </View>
  );
}

function Cita({ texto }: { texto: string }) {
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: color.hijo, backgroundColor: color.hijoSuave, padding: espacio.m, borderRadius: radio.s }}>
      <Text style={estilos.texto}>{texto}</Text>
    </View>
  );
}
