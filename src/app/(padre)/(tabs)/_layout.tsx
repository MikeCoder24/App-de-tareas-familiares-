import { Tabs } from 'expo-router/js-tabs';

import { Campana } from '@/components/Campana';
import { TabIcono } from '@/components/TabIcono';
import { contarPorRevisar, contarSolicitudesPendientes } from '@/data/servicios/pendientes';
import { useConsulta } from '@/data/useConsulta';
import { useSesion } from '@/session/SesionProvider';
import { color } from '@/theme';

/** Barra inferior del padre: Inicio (M2) · Gestión (M3) · Familia (M4). */
export default function PadreTabsLayout() {
  const { familia } = useSesion();
  const familiaId = familia?.id ?? '';
  const { datos: pendientes } = useConsulta(() => contarSolicitudesPendientes(familiaId), familiaId);
  const { datos: porRevisar } = useConsulta(() => contarPorRevisar(familiaId), familiaId);
  if (!familia) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.primario,
        tabBarInactiveTintColor: color.textoSuave,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.fondo },
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: color.fondo },
        headerRight: () => <Campana />,
      }}>
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcono emoji="🏠" activo={focused} />,
          tabBarBadge: porRevisar ? porRevisar : undefined,
        }}
      />
      <Tabs.Screen
        name="gestion"
        options={{
          title: 'Gestión',
          tabBarIcon: ({ focused }) => <TabIcono emoji="📋" activo={focused} />,
          tabBarBadge: pendientes ? pendientes : undefined,
        }}
      />
      <Tabs.Screen
        name="familia"
        options={{ title: 'Familia', tabBarIcon: ({ focused }) => <TabIcono emoji="👨‍👩‍👧" activo={focused} /> }}
      />
    </Tabs>
  );
}
