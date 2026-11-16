import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirmar } from '@/components/dialogos';
import { FotoFamilia } from '@/components/FotoFamilia';
import { Chips, Estrellas, GraficaDias, ICONO_CATEGORIA, Indicador, InsigniaEstado } from '@/components/tareas';
import { TarjetaTareaHijo } from '@/components/TarjetaTareaHijo';
import { Avatar, Boton, estilos, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { capitalizar, formatoDia, hoy, inicioSemana, sumarDias } from '@/data/fechas';
import { type GrupoHoy, grupoDe, progresoDelHijo, tareasDeHoy } from '@/data/servicios/hijo';
import type { OcurrenciaVista } from '@/data/servicios/tareas';
import { useConsulta } from '@/data/useConsulta';
import { useAhora } from '@/hooks/useAhora';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

type Vista = 'hoy' | 'progreso';

/** M5 — Mis tareas y progreso. */
export default function MisTareas() {
  const { usuario, familia, salir } = useUsuario();
  const [vista, setVista] = useState<Vista>('hoy');

  return (
    <Pantalla bordesSeguros={[]}>
      <View style={[estilos.fila, { gap: espacio.m }]}>
        <Avatar emoji={usuario.avatar} tamano={56} />
        <View style={{ flex: 1 }}>
          <Text style={estilos.titulo}>¡Hola, {usuario.nombre}!</Text>
          <View style={[estilos.fila, { gap: espacio.xs }]}>
            <FotoFamilia familia={familia} tamano={20} />
            <Texto suave>{familia.nombre}</Texto>
          </View>
        </View>
      </View>

      <Chips<Vista>
        opciones={[
          { valor: 'hoy', etiqueta: '✅ Hoy' },
          { valor: 'progreso', etiqueta: '📈 Mi progreso' },
        ]}
        valor={vista}
        onCambio={setVista}
      />

      {vista === 'hoy' ? <Hoy /> : <Progreso />}

      <View style={{ flex: 1 }} />
      <Boton
        titulo="Salir"
        variante="enlace"
        onPress={async () => {
          if (await confirmar('Salir', 'Para volver a entrar necesitarás tu PIN.', 'Salir')) salir();
        }}
      />
    </Pantalla>
  );
}

const TITULOS: Record<GrupoHoy, string> = {
  ahora: '⏰ Ahora',
  atrasadas: '⚠️ Atrasadas',
  mas_tarde: '🕒 Más tarde',
  hechas: '🎉 Hechas hoy',
};
const ORDEN: GrupoHoy[] = ['ahora', 'atrasadas', 'mas_tarde', 'hechas'];

function Hoy() {
  const { usuario } = useUsuario();
  const ahora = useAhora();
  // El minuto actual en la clave hace que la lista se vuelva a pedir (y se marquen atrasadas) con el tiempo.
  const { datos: tareas } = useConsulta(() => tareasDeHoy(usuario), `${usuario.id}|${ahora.getMinutes()}`);
  if (!tareas) return null;

  if (tareas.length === 0) {
    return (
      <Tarjeta estilo={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 48 }}>🌈</Text>
        <Texto centrado>No tienes tareas para hoy. ¡Disfruta tu día!</Texto>
        <Texto suave centrado>
          ¿Quieres ayudar en algo? Propónselo a tus papás en la pestaña Propuestas.
        </Texto>
      </Tarjeta>
    );
  }

  const grupos = new Map<GrupoHoy, OcurrenciaVista[]>();
  for (const oc of tareas) grupos.set(grupoDe(oc, ahora), [...(grupos.get(grupoDe(oc, ahora)) ?? []), oc]);
  const hechas = tareas.filter((o) => grupoDe(o, ahora) === 'hechas').length;

  return (
    <>
      <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 32 }}>{hechas === tareas.length ? '🏆' : '💪'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={estilos.seccion}>
            {hechas} de {tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'} hechas
          </Text>
          <Texto suave>{hechas === tareas.length ? '¡Terminaste todo por hoy!' : '¡Tú puedes!'}</Texto>
        </View>
      </Tarjeta>
      {ORDEN.filter((g) => grupos.get(g)?.length).map((g) => (
        <Seccion key={g} titulo={TITULOS[g]}>
          {grupos.get(g)!.map((oc) =>
            g === 'hechas' ? <FilaHecha key={oc.id} oc={oc} /> : <TarjetaTareaHijo key={oc.id} oc={oc} hijoId={usuario.id} ahora={ahora} />,
          )}
        </Seccion>
      ))}
    </>
  );
}

function FilaHecha({ oc }: { oc: OcurrenciaVista }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: oc.id } })}>
      <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', paddingVertical: espacio.m }}>
        <Text style={{ fontSize: 22 }}>{ICONO_CATEGORIA[oc.tarea.categoria]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto }}>{oc.tarea.titulo}</Text>
          {oc.calificacion ? <Text style={{ color: '#F5A524' }}>{'★'.repeat(oc.calificacion)}</Text> : null}
        </View>
        <InsigniaEstado estado={oc.estado} />
      </Tarjeta>
    </Pressable>
  );
}

function Progreso() {
  const { usuario } = useUsuario();
  const [dia, setDia] = useState(hoy());
  const { datos: p } = useConsulta(() => progresoDelHijo(usuario, dia), `${usuario.id}|${dia}`);
  if (!p) return null;
  const estaSemana = inicioSemana(dia) === inicioSemana(hoy());
  const titulo = estaSemana ? 'Esta semana' : `Semana del ${formatoDia(p.desde, { day: 'numeric', month: 'short' })}`;

  return (
    <>
      <View style={estilos.filaEntre}>
        <Boton titulo="‹" variante="secundario" estilo={{ minHeight: 36, width: 44 }} onPress={() => setDia(sumarDias(dia, -7))} />
        <Text style={estilos.seccion}>{capitalizar(titulo)}</Text>
        <Boton titulo="›" variante="secundario" estilo={{ minHeight: 36, width: 44 }} deshabilitado={estaSemana} onPress={() => setDia(sumarDias(dia, 7))} />
      </View>

      <Seccion titulo="Lo que piensan tus papás">
        <Tarjeta estilo={{ alignItems: 'center' }}>
          {p.promedioEstrellas ? (
            <>
              <Text style={{ fontSize: 40, fontWeight: '800', color: color.texto }}>{p.promedioEstrellas.toFixed(1)}</Text>
              <Estrellas valor={Math.round(p.promedioEstrellas)} tamano={28} />
              <Texto suave centrado>
                Promedio de {p.calificadasSemana} {p.calificadasSemana === 1 ? 'tarea calificada' : 'tareas calificadas'}
              </Texto>
            </>
          ) : (
            <Texto suave centrado>
              Aún no te han calificado esta semana.
            </Texto>
          )}
        </Tarjeta>
        {p.ultimas.length ? <Texto suave>Últimas revisiones (toca para ver el detalle):</Texto> : null}
        {p.ultimas.map((oc) => (
          <Pressable key={oc.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: oc.id } })}>
            <Tarjeta estilo={{ gap: espacio.xs, paddingVertical: espacio.m }}>
              <View style={estilos.filaEntre}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto, flex: 1 }} numberOfLines={1}>
                  {oc.tarea.titulo}
                </Text>
                {oc.estado === 'aprobada' && oc.calificacion ? (
                  <Text style={{ color: '#F5A524', fontSize: 16 }}>{'★'.repeat(oc.calificacion)}</Text>
                ) : (
                  <InsigniaEstado estado={oc.estado} />
                )}
              </View>
              {oc.comentario || oc.motivoRechazo ? (
                <Text style={{ fontSize: 14, color: color.texto }}>💬 “{oc.comentario ?? oc.motivoRechazo}”</Text>
              ) : null}
              <Text style={{ fontSize: 12, color: color.textoSuave }}>{capitalizar(formatoDia(oc.fecha))}</Text>
            </Tarjeta>
          </Pressable>
        ))}
      </Seccion>

      <Seccion titulo="Tus tareas completadas">
        <Tarjeta>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
            <Indicador valor={`🔥 ${p.racha}`} etiqueta={p.racha === 1 ? 'día de racha' : 'días de racha'} mitad />
            <Indicador valor={`⭐ ${p.puntosTotales}`} etiqueta="puntos acumulados" detalle={`+${p.puntosSemana} esta semana`} mitad />
            <Indicador valor={`${p.completadasSemana}/${p.totalSemana}`} etiqueta="hechas en la semana" mitad />
            <Indicador valor={p.porcentajeATiempo === null ? '—' : `${p.porcentajeATiempo}%`} etiqueta="a tiempo" mitad />
          </View>
          <Texto suave>Tareas hechas por día (toca una barra)</Texto>
          <GraficaDias dias={p.porDia} />
        </Tarjeta>
      </Seccion>
    </>
  );
}
