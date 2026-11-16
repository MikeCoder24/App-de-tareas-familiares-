import { Tabs } from 'expo-router/js-tabs';

import { Campana } from '@/components/Campana';
import { TabIcono } from '@/components/TabIcono';
import { contarPorJustificar } from '@/data/servicios/propuestas';
import { useConsulta } from '@/data/useConsulta';
import { useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

/** Barra inferior del hijo: Mis tareas (M5) · Propuestas (M6). */
export default function HijoTabsLayout() {
  const { usuario } = useSesion();
  const { datos: porExplicar } = useConsulta(
    () => (usuario ? contarPorJustificar(usuario) : Promise.resolve(0)),
    usuario?.id ?? '',
  );
  if (!usuario) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.hijo,
        tabBarInactiveTintColor: color.textoSuave,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: color.fondo },
        headerRight: () => <Campana />,
      }}>
      <Tabs.Screen
        name="tareas"
        options={{ title: 'Mis tareas', tabBarIcon: ({ focused }) => <TabIcono emoji="✅" activo={focused} /> }}
      />
      <Tabs.Screen
        name="propuestas"
        options={{
          title: 'Propuestas',
          tabBarIcon: ({ focused }) => <TabIcono emoji="💡" activo={focused} />,
          tabBarBadge: porExplicar ? porExplicar : undefined,
        }}
      />
    </Tabs>
  );
}
