import { Stack } from 'expo-router';

import { useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

/** Stack del hijo: pestañas + detalle de una tarea (destino de los avisos de M7). */
export default function HijoLayout() {
  const { usuario } = useSesion();
  if (!usuario) return null;

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
      <Stack.Screen name="tarea/[id]" options={{ title: 'Tarea' }} />
    </Stack>
  );
}
