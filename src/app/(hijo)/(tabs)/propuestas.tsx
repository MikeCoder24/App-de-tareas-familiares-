import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { avisar, elegir } from '@/components/dialogos';
import { Etiqueta, hora12, Opciones, SelectorFecha, SelectorHora, sumarMinutos } from '@/components/formulario';
import { Chips, ICONO_CATEGORIA, InsigniaEstado } from '@/components/tareas';
import { Aviso, Boton, Campo, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { capitalizar, formatoDia, formatoHora, hoy } from '@/data/fechas';
import { elegirFoto, type OrigenFoto } from '@/data/fotos';
import {
  type FormularioPropuesta,
  justificaciones,
  justificar,
  misPropuestas,
  type MotivoJustificacion,
  motivoDe,
  proponerTarea,
} from '@/data/servicios/propuestas';
import type { OcurrenciaVista } from '@/data/servicios/tareas';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio, radio } from '@/theme';

type Vista = 'proponer' | 'justificar';

/** M6 — Proponer tareas y justificar lo que no se aprobó. */
export default function Propuestas() {
  const { usuario } = useUsuario();
  const params = useLocalSearchParams<{ vista?: Vista }>();
  const { datos: j } = useConsulta(() => justificaciones(usuario), usuario.id);
  const [elegida, setVista] = useState<Vista | null>(null);
  const vista: Vista = elegida ?? params.vista ?? (j?.pendientes.length ? 'justificar' : 'proponer');

  return (
    <Pantalla bordesSeguros={[]}>
      <Chips<Vista>
        opciones={[
          { valor: 'proponer', etiqueta: '💡 Proponer' },
          { valor: 'justificar', etiqueta: j?.pendientes.length ? `💬 Explicar (${j.pendientes.length})` : '💬 Explicar' },
        ]}
        valor={vista}
        onCambio={setVista}
      />
      {vista === 'proponer' ? <Proponer /> : <Justificar />}
    </Pantalla>
  );
}

// ---------- Proponer ----------

function horaSugerida() {
  const d = new Date(Date.now() + 60 * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function Proponer() {
  const { usuario } = useUsuario();
  const vacio: FormularioPropuesta = { titulo: '', categoria: 'domestica', fecha: hoy(), hora: horaSugerida(), duracionMin: 30, motivo: '' };
  const [f, setF] = useState(vacio);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { datos: propuestas } = useConsulta(() => misPropuestas(usuario), usuario.id);
  const cambiar = (c: Partial<FormularioPropuesta>) => setF((v) => ({ ...v, ...c }));

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      await proponerTarea(usuario.id, f);
      setF({ ...vacio, hora: horaSugerida() });
      avisar('¡Propuesta enviada!', 'Tus papás la van a revisar. Te avisaremos qué decidieron.');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Texto suave>¿Quieres ayudar en algo o tienes una idea? Propónselo a tus papás.</Texto>
      <Tarjeta>
        <Campo etiqueta="¿Qué quieres hacer?" value={f.titulo} onChangeText={(titulo) => cambiar({ titulo })} placeholder="Ej. Ordenar mi cuarto" maxLength={40} />
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Tipo</Etiqueta>
          <Opciones
            opciones={[
              { valor: 'domestica', etiqueta: `${ICONO_CATEGORIA.domestica} De la casa` },
              { valor: 'escolar', etiqueta: `${ICONO_CATEGORIA.escolar} De la escuela` },
            ]}
            valor={f.categoria}
            onCambio={(categoria) => cambiar({ categoria })}
          />
        </View>
        <View style={{ gap: espacio.s }}>
          <Etiqueta>¿Qué día?</Etiqueta>
          <SelectorFecha valor={f.fecha} onCambio={(fecha) => cambiar({ fecha })} />
        </View>
        <View style={{ gap: espacio.s }}>
          <Etiqueta>¿A qué hora?</Etiqueta>
          <SelectorHora valor={f.hora} onCambio={(hora) => cambiar({ hora })} />
          <Opciones
            opciones={[15, 30, 60].map((m) => ({ valor: m, etiqueta: m < 60 ? `${m} min` : '1 hora' }))}
            valor={f.duracionMin}
            onCambio={(duracionMin) => cambiar({ duracionMin })}
          />
          <Text style={{ textAlign: 'center', fontWeight: '600', color: color.texto }}>
            {hora12(f.hora)} – {hora12(sumarMinutos(f.hora, f.duracionMin))}
          </Text>
        </View>
        <Campo
          etiqueta="¿Por qué?"
          value={f.motivo}
          onChangeText={(motivo) => cambiar({ motivo })}
          placeholder="Ej. Quiero tener mi cuarto listo para el fin de semana"
          multiline
          maxLength={200}
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />
        <Aviso>{error}</Aviso>
        <Boton titulo="Enviar a mis papás" icono="📨" variante="hijo" cargando={enviando} onPress={enviar} />
      </Tarjeta>

      {propuestas && propuestas.length > 0 ? (
        <Seccion titulo="Mis propuestas">
          {propuestas.map((p) => (
            <Tarjeta key={p.id} estilo={{ gap: espacio.xs, paddingVertical: espacio.m }}>
              <View style={estilos.filaEntre}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto, flex: 1 }}>
                  {ICONO_CATEGORIA[p.tarea.categoria]} {p.tarea.titulo}
                </Text>
                <Insignia {...estadoPropuesta(p)} />
              </View>
              <Text style={{ fontSize: 13, color: color.textoSuave }}>
                {capitalizar(formatoDia(p.fecha))} · {formatoHora(p.inicioProgramado)}
              </Text>
              {p.estado === 'rechazada' && p.motivoRechazo && !p.iniciadaEn ? (
                <Text style={{ fontSize: 14, color: color.texto }}>💬 “{p.motivoRechazo}”</Text>
              ) : null}
            </Tarjeta>
          ))}
        </Seccion>
      ) : null}
    </>
  );
}

function estadoPropuesta(p: OcurrenciaVista): { texto: string; tipo: 'info' | 'exito' | 'peligro' | 'aviso' } {
  if (p.estado === 'propuesta') return { texto: 'Esperando', tipo: 'info' };
  if (p.estado === 'rechazada' && !p.iniciadaEn) return { texto: 'No aprobada', tipo: 'peligro' };
  if (p.estado === 'justificada') return { texto: 'Respondiste', tipo: 'aviso' };
  return { texto: 'Aprobada ✓', tipo: 'exito' };
}

// ---------- Justificar ----------

const ETIQUETA_MOTIVO: Record<MotivoJustificacion, string> = {
  propuesta_rechazada: 'Propuesta no aprobada',
  tarea_rechazada: 'Tus papás la rechazaron',
  no_iniciada: 'No la iniciaste a tiempo',
};

function Justificar() {
  const { usuario } = useUsuario();
  const { datos: j } = useConsulta(() => justificaciones(usuario), usuario.id);
  if (!j) return null;

  return (
    <>
      <Texto suave>
        Aquí está lo que no se aprobó. Puedes explicar qué pasó <Text style={{ fontWeight: '700' }}>una sola vez</Text>; tus papás deciden.
      </Texto>
      {j.pendientes.length === 0 && j.enviadas.length === 0 ? (
        <Tarjeta estilo={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>😎</Text>
          <Texto centrado>¡Todo en orden! No tienes nada que explicar.</Texto>
        </Tarjeta>
      ) : null}

      {j.pendientes.length > 0 ? (
        <Seccion titulo="Para explicar">
          {j.pendientes.map((oc) => (
            <TarjetaJustificar key={oc.id} oc={oc} hijoId={usuario.id} />
          ))}
        </Seccion>
      ) : null}

      {j.enviadas.length > 0 ? (
        <Seccion titulo="Enviadas">
          {j.enviadas.map((oc) => (
            <FilaResumen key={oc.id} oc={oc} />
          ))}
        </Seccion>
      ) : null}

      {j.resueltas.length > 0 ? (
        <Seccion titulo="Respuestas de tus papás">
          {j.resueltas.map((oc) => (
            <FilaResumen key={oc.id} oc={oc} />
          ))}
        </Seccion>
      ) : null}
    </>
  );
}

function TarjetaJustificar({ oc, hijoId }: { oc: OcurrenciaVista; hijoId: string }) {
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const motivo = motivoDe(oc);
  const hoyAtrasada = oc.estado === 'atrasada' && oc.fecha === hoy();

  async function agregarFoto() {
    const origen = await elegir<OrigenFoto>('Foto (opcional)', [
      { valor: 'camara', texto: 'Tomar foto' },
      { valor: 'galeria', texto: 'Elegir de la galería' },
    ]);
    if (!origen) return;
    try {
      const uri = await elegirFoto(origen);
      if (uri) setFoto(uri);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      await justificar(hijoId, oc.id, texto, foto);
      avisar('Enviado', 'Tus papás van a leer tu explicación.');
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  return (
    <Tarjeta estilo={{ borderColor: color.hijo }}>
      <View style={estilos.filaEntre}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: color.texto, flex: 1 }}>
          {ICONO_CATEGORIA[oc.tarea.categoria]} {oc.tarea.titulo}
        </Text>
        <Insignia texto={ETIQUETA_MOTIVO[motivo]} tipo={motivo === 'no_iniciada' ? 'aviso' : 'peligro'} />
      </View>
      <Text style={{ fontSize: 13, color: color.textoSuave }}>
        {capitalizar(formatoDia(oc.fecha, { weekday: 'long', day: 'numeric', month: 'short' }))} · {formatoHora(oc.inicioProgramado)}
      </Text>
      {oc.motivoRechazo ? (
        <View style={{ backgroundColor: color.peligroSuave, padding: espacio.m, borderRadius: radio.s }}>
          <Text style={{ fontSize: 14, color: color.texto }}>Tus papás: “{oc.motivoRechazo}”</Text>
        </View>
      ) : null}
      {hoyAtrasada ? (
        <Boton titulo="Mejor la hago ahora" variante="secundario" onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: oc.id } })} />
      ) : null}
      <Campo
        etiqueta="Tu explicación"
        value={texto}
        onChangeText={setTexto}
        placeholder="Ej. Tuve ensayo en la escuela y llegué tarde"
        multiline
        maxLength={300}
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />
      {foto ? (
        <Pressable onPress={() => setFoto(null)} accessibilityLabel="Quitar la foto">
          <Image source={{ uri: foto }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radio.m }} contentFit="cover" />
          <Text style={{ fontSize: 12, color: color.textoSuave, textAlign: 'center', marginTop: 4 }}>Toca la foto para quitarla</Text>
        </Pressable>
      ) : (
        <Boton titulo="Agregar foto (opcional)" icono="📷" variante="secundario" onPress={agregarFoto} />
      )}
      <Aviso>{error}</Aviso>
      <Boton titulo="Enviar explicación" variante="hijo" cargando={enviando} deshabilitado={texto.trim().length < 3} onPress={enviar} />
    </Tarjeta>
  );
}

function FilaResumen({ oc }: { oc: OcurrenciaVista }) {
  const resultado =
    oc.estado === 'justificada'
      ? 'Esperando respuesta'
      : oc.estado === 'aprobada'
        ? 'Aceptaron tu explicación ✓'
        : oc.estado === 'programada' || oc.estado === 'iniciada' || oc.estado === 'finalizada'
          ? `Reprogramada: ${capitalizar(formatoDia(oc.fecha))} ${formatoHora(oc.inicioProgramado)}`
          : 'Mantuvieron el rechazo';
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: oc.id } })}>
      <Tarjeta estilo={{ gap: espacio.xs, paddingVertical: espacio.m }}>
        <View style={estilos.filaEntre}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto, flex: 1 }}>{oc.tarea.titulo}</Text>
          <InsigniaEstado estado={oc.estado} />
        </View>
        <Text style={{ fontSize: 13, color: color.texto }}>Tú: “{oc.justificacion}”</Text>
        <Text style={{ fontSize: 13, color: color.textoSuave }}>{resultado}</Text>
      </Tarjeta>
    </Pressable>
  );
}
