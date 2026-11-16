import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chips, ICONO_CATEGORIA, InsigniaEstado } from '@/components/tareas';
import { Avatar, Boton, estilos, Seccion, Tarjeta, Texto } from '@/components/ui';
import { capitalizar, claveDia, formatoDia, formatoHora, hoy, sumarDias } from '@/data/fechas';
import { describirRepeticion, type TareaVista, tareasVigentes } from '@/data/servicios/tareas';
import { useConsulta } from '@/data/useConsulta';
import { color, espacio } from '@/theme';

/** M3 — Agregar tareas y rutinas: lista de lo vigente y acceso al formulario. */
export function SeccionTareas({ familiaId }: { familiaId: string }) {
  const { datos: tareas } = useConsulta(() => tareasVigentes(familiaId), familiaId);
  const [hijoId, setHijoId] = useState<string | null>(null);

  const hijos = [...new Map((tareas ?? []).map((t) => [t.hijo.id, t.hijo])).values()];
  const visibles = (tareas ?? []).filter((t) => !hijoId || t.asignadoA === hijoId);
  const rutinas = visibles.filter((t) => t.repeticion);
  const unaVez = visibles.filter((t) => !t.repeticion);

  return (
    <>
      <Boton titulo="Nueva tarea o rutina" icono="➕" onPress={() => router.push({ pathname: '/editar/[id]', params: { id: 'nueva' } })} />

      {hijos.length > 1 ? (
        <Chips
          opciones={[{ valor: null, etiqueta: 'Todos' }, ...hijos.map((h) => ({ valor: h.id, etiqueta: `${h.avatar} ${h.nombre}` }))]}
          valor={hijoId}
          onCambio={setHijoId}
        />
      ) : null}

      {tareas && tareas.length === 0 ? (
        <Tarjeta>
          <Texto>Aún no hay tareas. Crea la primera: por ejemplo “Tender la cama”, diaria a las 7:30 a.m.</Texto>
        </Tarjeta>
      ) : null}

      {rutinas.length > 0 ? (
        <Seccion titulo={`Rutinas (${rutinas.length})`}>
          <Lista tareas={rutinas} />
        </Seccion>
      ) : null}
      {unaVez.length > 0 ? (
        <Seccion titulo={`Tareas de una vez (${unaVez.length})`}>
          <Lista tareas={unaVez} />
        </Seccion>
      ) : null}
    </>
  );
}

function Lista({ tareas }: { tareas: TareaVista[] }) {
  return (
    <Tarjeta estilo={{ gap: 0, paddingVertical: espacio.xs }}>
      {tareas.map((t, i) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          accessibilityHint="Editar o cancelar"
          onPress={() => router.push({ pathname: '/editar/[id]', params: { id: t.id } })}
          style={({ pressed }) => [
            estilos.fila,
            { paddingVertical: espacio.m },
            i > 0 && { borderTopWidth: 1, borderTopColor: color.borde },
            pressed && { opacity: 0.6 },
          ]}>
          <Text style={{ fontSize: 22 }}>{ICONO_CATEGORIA[t.categoria]}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto }} numberOfLines={1}>
              {t.titulo}
            </Text>
            <Text style={{ fontSize: 13, color: color.textoSuave }}>{cuando(t)}</Text>
            <View style={[estilos.fila, { gap: espacio.s, flexWrap: 'wrap' }]}>
              {t.puntos ? <Text style={{ fontSize: 12, color: color.textoSuave }}>⭐ {t.puntos} pts</Text> : null}
              {t.requiereFoto ? <Text style={{ fontSize: 12, color: color.textoSuave }}>📷 Con foto</Text> : null}
              <Text style={{ fontSize: 12, color: color.textoSuave }}>🔔 {t.recordatorioMin} min antes</Text>
            </View>
          </View>
          {!t.repeticion && t.estadoActual && t.estadoActual !== 'programada' ? <InsigniaEstado estado={t.estadoActual} /> : null}
          <Avatar emoji={t.hijo.avatar} tamano={32} />
        </Pressable>
      ))}
    </Tarjeta>
  );
}

function cuando(t: TareaVista) {
  const rango = `${formatoHora(t.horaInicio)} – ${formatoHora(t.horaLimite)}`;
  const rep = describirRepeticion(t.repeticion);
  if (rep) {
    const empieza = claveDia(new Date(t.horaInicio));
    return empieza > hoy() ? `${rep} · ${rango} · desde ${formatoDia(empieza, { day: 'numeric', month: 'short' })}` : `${rep} · ${rango}`;
  }
  const dia = claveDia(new Date(t.horaInicio));
  const nombre = dia === hoy() ? 'Hoy' : dia === sumarDias(hoy(), 1) ? 'Mañana' : capitalizar(formatoDia(dia, { weekday: 'short', day: 'numeric', month: 'short' }));
  return `${nombre} · ${rango}`;
}
