import { Stack } from 'expo-router';

import { color } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: color.texto,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
        contentStyle: { backgroundColor: color.fondo },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="bienvenida" options={{ headerShown: false }} />
      <Stack.Screen name="padre" options={{ title: '' }} />
      <Stack.Screen name="olvide" options={{ title: 'Recuperar acceso' }} />
      <Stack.Screen name="hijo" options={{ title: '' }} />
      <Stack.Screen name="hijo-codigo" options={{ title: 'Código de invitación' }} />
      <Stack.Screen name="hijo-registro" options={{ title: 'Crea tu perfil' }} />
    </Stack>
  );
}
