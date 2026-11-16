import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { elegir } from '@/components/dialogos';
import { ICONO_CATEGORIA, InsigniaEstado } from '@/components/tareas';
import { Aviso, Boton, estilos, Tarjeta } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { formatoHora } from '@/data/fechas';
import { elegirFoto, type OrigenFoto } from '@/data/fotos';
import { finalizarTarea, guardarEvidencia, iniciarTarea, MINUTOS_ANTES_PARA_INICIAR, puedeIniciarYa } from '@/data/servicios/hijo';
import type { OcurrenciaVista } from '@/data/servicios/tareas';
import { color, espacio, radio } from '@/theme';

/**
 * M5 — Una tarea del hijo con un solo botón que pasa de Iniciar a Finalizar.
 * Si pide evidencia, Finalizar no se activa sin foto.
 */
export function TarjetaTareaHijo({ oc, hijoId, ahora }: { oc: OcurrenciaVista; hijoId: string; ahora: Date }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const ejecutar = async (accion: () => Promise<void>) => {
    setError('');
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  async function tomarFoto() {
    const origen = await elegir<OrigenFoto>('Foto de evidencia', [
      { valor: 'camara', texto: 'Tomar foto' },
      { valor: 'galeria', texto: 'Elegir de la galería' },
    ]);
    if (!origen) return;
    await ejecutar(async () => {
      const uri = await elegirFoto(origen);
      if (uri) await guardarEvidencia(hijoId, oc.id, uri);
    });
  }

  const enCurso = oc.estado === 'iniciada';
  const porIniciar = oc.estado === 'programada' || oc.estado === 'atrasada';
  const disponible = oc.estado === 'atrasada' || puedeIniciarYa(oc, ahora);
  const faltaFoto = oc.tarea.requiereFoto && !oc.evidenciaUrl;
  const horaDisponible = formatoHora(new Date(new Date(oc.inicioProgramado).getTime() - MINUTOS_ANTES_PARA_INICIAR * 60_000).toISOString());

  return (
    <Tarjeta
      estilo={{
        borderColor: enCurso ? color.hijo : oc.estado === 'atrasada' ? color.peligro : color.borde,
        borderWidth: enCurso || oc.estado === 'atrasada' ? 2 : 1,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Ver detalle de la tarea"
        onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: oc.id } })}
        style={estilos.fila}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radio.m,
            backgroundColor: oc.tarea.categoria === 'escolar' ? color.primarioSuave : color.hijoSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 26 }}>{ICONO_CATEGORIA[oc.tarea.categoria]}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: color.texto }}>{oc.tarea.titulo}</Text>
          <Text style={{ fontSize: 14, color: color.textoSuave }}>
            {formatoHora(oc.inicioProgramado)} – {formatoHora(oc.limiteProgramado)}
            {oc.tarea.puntos ? ` · ⭐ ${oc.tarea.puntos}` : ''}
            {oc.tarea.requiereFoto ? ' · 📷' : ''}
          </Text>
        </View>
        {!porIniciar && !enCurso ? <InsigniaEstado estado={oc.estado} /> : null}
      </Pressable>

      {oc.tarea.notas && (porIniciar || enCurso) ? (
        <Text style={{ fontSize: 14, color: color.texto, backgroundColor: color.fondo, padding: espacio.s, borderRadius: radio.s }}>
          📝 {oc.tarea.notas}
        </Text>
      ) : null}

      {enCurso && oc.tarea.requiereFoto ? (
        oc.evidenciaUrl ? (
          <Pressable onPress={tomarFoto} accessibilityLabel="Cambiar la foto de evidencia">
            <Image source={{ uri: oc.evidenciaUrl }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radio.m }} contentFit="cover" />
            <Text style={{ fontSize: 12, color: color.textoSuave, textAlign: 'center', marginTop: 4 }}>Toca la foto para cambiarla</Text>
          </Pressable>
        ) : (
          <Boton titulo="Agregar foto de evidencia" icono="📷" variante="secundario" onPress={tomarFoto} cargando={ocupado} />
        )
      ) : null}

      <Aviso>{error}</Aviso>

      {porIniciar ? (
        <Boton
          titulo={disponible ? (oc.estado === 'atrasada' ? 'Iniciar tarde' : 'Iniciar') : `Disponible a las ${horaDisponible}`}
          icono={disponible ? '▶' : undefined}
          variante="hijo"
          deshabilitado={!disponible}
          cargando={ocupado}
          onPress={() => ejecutar(() => iniciarTarea(hijoId, oc.id))}
        />
      ) : null}
      {enCurso ? (
        <Boton
          titulo={faltaFoto ? 'Agrega la foto para finalizar' : 'Finalizar'}
          icono={faltaFoto ? undefined : '✓'}
          deshabilitado={faltaFoto}
          cargando={ocupado}
          onPress={() => ejecutar(() => finalizarTarea(hijoId, oc.id))}
        />
      ) : null}
    </Tarjeta>
  );
}
