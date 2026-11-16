import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SeccionAlertas } from '@/components/gestion/SeccionAlertas';
import { SeccionHijos } from '@/components/gestion/SeccionHijos';
import { SeccionTareas } from '@/components/gestion/SeccionTareas';
import { Chips } from '@/components/tareas';
import { Pantalla } from '@/components/ui';
import { contarSolicitudesPendientes } from '@/data/servicios/pendientes';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';

type Vista = 'tareas' | 'hijos' | 'alertas';

/** M3 — Gestión: tareas y rutinas, hijos y alertas. */
export default function Gestion() {
  const { usuario, familia } = useUsuario();
  const params = useLocalSearchParams<{ vista?: Vista }>();
  const { datos: solicitudes } = useConsulta(() => contarSolicitudesPendientes(familia.id), familia.id);
  const [elegida, setVista] = useState<Vista | null>(null);
  // Con solicitudes pendientes, abre en Hijos (a menos que el padre ya haya elegido otra).
  const vista: Vista = elegida ?? params.vista ?? (solicitudes ? 'hijos' : 'tareas');

  return (
    <Pantalla bordesSeguros={[]}>
      <Chips<Vista>
        opciones={[
          { valor: 'tareas', etiqueta: '📝 Tareas' },
          { valor: 'hijos', etiqueta: solicitudes ? `🧒 Hijos (${solicitudes})` : '🧒 Hijos' },
          { valor: 'alertas', etiqueta: '🔔 Alertas' },
        ]}
        valor={vista}
        onCambio={setVista}
      />
      {vista === 'tareas' ? <SeccionTareas familiaId={familia.id} /> : null}
      {vista === 'hijos' ? <SeccionHijos padreId={usuario.id} familiaId={familia.id} /> : null}
      {vista === 'alertas' ? <SeccionAlertas padreId={usuario.id} familiaId={familia.id} /> : null}
    </Pantalla>
  );
}
