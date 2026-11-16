import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Avisos } from '@/notifications/Avisos';
import { destinoDe, SesionProvider, useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = { anchor: 'index' };

function Navegacion() {
  const { cargando, usuario } = useSesion();
  const destino = destinoDe(usuario);

  useEffect(() => {
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

  if (cargando) return null;

  return (
    <>
      <Avisos />
      <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.fondo },
        headerTintColor: color.texto,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="privacidad" options={{ headerShown: true, title: 'Aviso de privacidad' }} />
      <Stack.Protected guard={destino === 'padre' || destino === 'hijo'}>
        <Stack.Screen name="avisos" options={{ headerShown: true, title: 'Avisos' }} />
      </Stack.Protected>
      <Stack.Protected guard={destino === 'acceso'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={destino === 'espera'}>
        <Stack.Screen name="espera" />
      </Stack.Protected>
      <Stack.Protected guard={destino === 'padre'}>
        <Stack.Screen name="(padre)" />
      </Stack.Protected>
      <Stack.Protected guard={destino === 'hijo'}>
        <Stack.Screen name="(hijo)" />
      </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SesionProvider>
      <StatusBar style="dark" />
      <Navegacion />
    </SesionProvider>
  );
}
