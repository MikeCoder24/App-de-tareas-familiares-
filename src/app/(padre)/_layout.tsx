import { Stack } from 'expo-router';

import { useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

/** Stack del padre: pestañas + pantallas que se abren encima (detalle del hijo, revisar). */
export default function PadreLayout() {
  const { familia } = useSesion();
  if (!familia) return null;

  return (
    <Stack
      screenOptions={{
        headerTintColor: color.texto,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
        contentStyle: { backgroundColor: color.fondo },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="hijo/[id]" options={{ title: '' }} />
      <Stack.Screen name="revisar/[id]" options={{ title: 'Revisar', presentation: 'modal' }} />
      <Stack.Screen name="editar/[id]" options={{ title: 'Tarea' }} />
      <Stack.Screen name="suscripcion" options={{ title: 'Suscripción' }} />
    </Stack>
  );
}
