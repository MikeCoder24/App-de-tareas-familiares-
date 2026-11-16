import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { Familia } from '@/data/tipos';
import { color } from '@/theme';

/** Foto de la familia (o 🏡 si no tiene). La ven todos los miembros. */
export function FotoFamilia({ familia, tamano = 88 }: { familia: Pick<Familia, 'foto' | 'nombre'>; tamano?: number }) {
  return (
    <View
      accessibilityLabel={`Foto de ${familia.nombre}`}
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        overflow: 'hidden',
        backgroundColor: color.primarioSuave,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {familia.foto ? (
        <Image source={{ uri: familia.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text style={{ fontSize: tamano * 0.5 }}>🏡</Text>
      )}
    </View>
  );
}
