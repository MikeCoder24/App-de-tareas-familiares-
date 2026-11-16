import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Pantalla, Tarjeta, Texto } from '@/components/ui';
import { capitalizar } from '@/data/fechas';
import { cuando, marcarLeidos, misAvisos } from '@/data/servicios/avisos';
import { useConsulta } from '@/data/useConsulta';
import { useSesion } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

/** M7 — Bandeja de avisos del usuario (incluye los que no sonaron por el horario silencioso). */
export default function Avisos() {
  const { usuario } = useSesion();
  const usuarioId = usuario?.id ?? '';
  const { datos: avisos } = useConsulta(() => misAvisos(usuarioId), usuarioId);

  // Al salir de la pantalla se marcan como leídos (así se ven resaltados mientras se revisan).
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (usuarioId) void marcarLeidos(usuarioId);
      };
    }, [usuarioId]),
  );

  if (!usuario || !avisos) return null;

  return (
    <Pantalla bordesSeguros={['bottom']}>
      {avisos.length === 0 ? (
        <Tarjeta estilo={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🔕</Text>
          <Texto centrado>Todavía no tienes avisos.</Texto>
        </Tarjeta>
      ) : null}
      {avisos.map((a) => (
        <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(a.url as Href)}>
          <Tarjeta
            estilo={{
              gap: espacio.xs,
              paddingVertical: espacio.m,
              borderColor: a.leida ? color.borde : color.primario,
              backgroundColor: a.leida ? color.superficie : color.primarioSuave,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: color.texto }}>{a.titulo}</Text>
              <Text style={{ fontSize: 12, color: color.textoSuave }}>{capitalizar(cuando(a.programadaPara))}</Text>
            </View>
            <Text style={{ fontSize: 14, color: color.texto }}>{a.cuerpo}</Text>
          </Tarjeta>
        </Pressable>
      ))}
    </Pantalla>
  );
}
