import { useState } from 'react';
import { View } from 'react-native';

import { Etiqueta, FilaInterruptor, hora12, Opciones, SelectorHora } from '@/components/formulario';
import { Aviso, Boton, Seccion, Tarjeta, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { guardarAlertas, leerAlertas, OPCIONES_RECORDATORIO } from '@/data/servicios/alertas';
import { miembros } from '@/data/servicios/familia';
import type { ConfigAlertas } from '@/data/tipos';
import { useConsulta } from '@/data/useConsulta';
import { espacio } from '@/theme';

/** M3 — Programar alertas. Cada cambio se guarda al instante; M7 las aplica. */
export function SeccionAlertas({ padreId, familiaId }: { padreId: string; familiaId: string }) {
  const { datos: a } = useConsulta(() => leerAlertas(familiaId), familiaId);
  const { datos: lista } = useConsulta(() => miembros(familiaId), familiaId);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<'desde' | 'hasta' | 'resumen' | null>(null);
  if (!a) return null;
  const hijos = (lista ?? []).filter((m) => m.rol === 'hijo' && m.estado === 'activo');

  const guardar = async (cambios: Partial<ConfigAlertas>) => {
    setError('');
    try {
      await guardarAlertas(padreId, cambios);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  };

  return (
    <>
      <Texto suave>Los cambios se guardan solos. Los avisos empiezan a sonar con el Módulo 7.</Texto>
      <Aviso>{error}</Aviso>

      <Seccion titulo="Recordatorio al hijo">
        <Tarjeta>
          <Etiqueta ayuda="Valor para las tareas nuevas; cada tarea puede tener el suyo.">Antes de iniciar</Etiqueta>
          <Opciones
            opciones={OPCIONES_RECORDATORIO.map((m) => ({ valor: m, etiqueta: `${m} min` }))}
            valor={a.recordatorioMin}
            onCambio={(recordatorioMin) => guardar({ recordatorioMin })}
          />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Avisos para ti">
        <Tarjeta>
          <FilaInterruptor
            titulo="Si no se inició a tiempo"
            detalle={`Te avisamos ${a.avisoNoIniciado.minutos} min después de la hora de inicio.`}
            valor={a.avisoNoIniciado.activo}
            onCambio={(activo) => guardar({ avisoNoIniciado: { ...a.avisoNoIniciado, activo } })}
          />
          {a.avisoNoIniciado.activo ? (
            <Opciones
              opciones={[5, 10, 15, 30].map((m) => ({ valor: m, etiqueta: `${m} min` }))}
              valor={a.avisoNoIniciado.minutos}
              onCambio={(minutos) => guardar({ avisoNoIniciado: { ...a.avisoNoIniciado, minutos } })}
            />
          ) : null}
        </Tarjeta>
        <Tarjeta>
          <Etiqueta ayuda="Por hijo.">Cuando inicia y cuando termina</Etiqueta>
          {hijos.length === 0 ? <Texto suave>Aún no hay hijos.</Texto> : null}
          {hijos.map((h) => (
            <FilaInterruptor
              key={h.id}
              titulo={`${h.avatar} ${h.nombre}`}
              valor={!a.sinAvisoInicioFin.includes(h.id)}
              onCambio={(activo) =>
                guardar({
                  sinAvisoInicioFin: activo ? a.sinAvisoInicioFin.filter((id) => id !== h.id) : [...a.sinAvisoInicioFin, h.id],
                })
              }
            />
          ))}
        </Tarjeta>
        <Tarjeta>
          <FilaInterruptor
            titulo="Resumen diario"
            detalle={a.resumenDiario ? `Cada día a las ${hora12(a.resumenDiario)}.` : 'Apagado.'}
            valor={a.resumenDiario !== null}
            onCambio={(activo) => guardar({ resumenDiario: activo ? '20:00' : null })}
          />
          {a.resumenDiario ? (
            editando === 'resumen' ? (
              <SelectorHora valor={a.resumenDiario} onCambio={(resumenDiario) => guardar({ resumenDiario })} />
            ) : (
              <Boton titulo="Cambiar hora" variante="enlace" onPress={() => setEditando('resumen')} />
            )
          ) : null}
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Horario silencioso">
        <Tarjeta>
          <FilaInterruptor
            titulo="No enviar avisos de noche"
            detalle={a.silencio.activo ? `De ${hora12(a.silencio.desde)} a ${hora12(a.silencio.hasta)}.` : 'Apagado.'}
            valor={a.silencio.activo}
            onCambio={(activo) => guardar({ silencio: { ...a.silencio, activo } })}
          />
          {a.silencio.activo ? (
            <View style={{ gap: espacio.s }}>
              <View style={{ flexDirection: 'row', gap: espacio.s }}>
                {(['desde', 'hasta'] as const).map((k) => (
                  <Boton
                    key={k}
                    titulo={`${k === 'desde' ? 'Desde' : 'Hasta'} ${hora12(a.silencio[k])}`}
                    variante={editando === k ? 'primario' : 'secundario'}
                    estilo={{ flex: 1 }}
                    onPress={() => setEditando(editando === k ? null : k)}
                  />
                ))}
              </View>
              {editando === 'desde' || editando === 'hasta' ? (
                <SelectorHora
                  valor={a.silencio[editando]}
                  onCambio={(h) => guardar({ silencio: { ...a.silencio, [editando]: h } })}
                />
              ) : null}
            </View>
          ) : null}
        </Tarjeta>
      </Seccion>
    </>
  );
}
