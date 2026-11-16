import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { contarNoLeidos } from '@/data/servicios/avisos';
import { useConsulta } from '@/data/useConsulta';
import { useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

/** Botón 🔔 del encabezado con el número de avisos sin leer. Abre la bandeja de avisos. */
export function Campana() {
  const { usuario } = useSesion();
  const { datos: n } = useConsulta(() => (usuario ? contarNoLeidos(usuario.id) : Promise.resolve(0)), usuario?.id ?? '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={n ? `Avisos, ${n} sin leer` : 'Avisos'}
      onPress={() => router.push('/avisos')}
      hitSlop={10}
      style={{ marginRight: 16, padding: 4 }}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
      {n ? (
        <View
          style={{
            position: 'absolute',
            right: -4,
            top: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: color.peligro,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{n > 9 ? '9+' : n}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
