import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  BarraProgreso,
  Chips,
  GraficaDias,
  ICONO_CATEGORIA,
  Indicador,
  NOMBRE_CATEGORIA,
} from '@/components/tareas';
import { Avatar, Boton, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto, Titulo } from '@/components/ui';
import { capitalizar, formatoDia, hoy, inicioSemana, sumarDias } from '@/data/fechas';
import { dashboard, type FiltroDashboard, type ResumenHijo, resumenHijos } from '@/data/servicios/estadisticas';
import { miembros } from '@/data/servicios/familia';
import { porRevisar } from '@/data/servicios/tareas';
import type { Categoria } from '@/data/tipos';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

/** M2 — Inicio del padre: por revisar, hijos y dashboard de tareas completadas. */
export default function InicioPadre() {
  const { usuario, familia } = useUsuario();
  const { datos: lista } = useConsulta(() => miembros(familia.id), familia.id);
  const { datos: resumen } = useConsulta(() => resumenHijos(familia.id), familia.id);
  const { datos: revisar } = useConsulta(() => porRevisar(familia.id), familia.id);
  const solicitudes = (lista ?? []).filter((m) => m.estado === 'pendiente');

  return (
    <Pantalla bordesSeguros={[]}>
      <Titulo sub={familia.nombre}>¡Hola, {usuario.nombre.split(' ')[0]}!</Titulo>

      {solicitudes.length > 0 ? (
        <Tarjeta>
          <Text style={estilos.seccion}>
            🔔 {solicitudes.length === 1 ? '1 solicitud para unirse' : `${solicitudes.length} solicitudes para unirse`}
          </Text>
          <Texto suave>{solicitudes.map((p) => p.nombre).join(', ')} quiere unirse a la familia.</Texto>
          <Boton titulo="Revisar solicitudes" onPress={() => router.navigate('/gestion')} />
        </Tarjeta>
      ) : null}

      <PorRevisar items={revisar} />

      <Seccion titulo="Hijos">
        {resumen && resumen.length === 0 ? (
          <Tarjeta>
            <Texto>Aún no hay hijos en tu familia.</Texto>
            <Boton titulo="Invitar a un hijo" onPress={() => router.navigate({ pathname: '/gestion', params: { vista: 'hijos' } })} />
          </Tarjeta>
        ) : null}
        {(resumen ?? []).map((r) => (
          <TarjetaHijo key={r.hijo.id} r={r} />
        ))}
      </Seccion>

      {resumen && resumen.length > 0 ? <Dashboard familiaId={familia.id} hijos={resumen.map((r) => r.hijo)} /> : null}
    </Pantalla>
  );
}

function PorRevisar({ items }: { items: Awaited<ReturnType<typeof porRevisar>> | undefined }) {
  const [verTodas, setVerTodas] = useState(false);
  if (!items) return null;
  const visibles = verTodas ? items : items.slice(0, 4);
  const tipo = (estado: string) =>
    estado === 'propuesta' ? 'Propuesta' : estado === 'justificada' ? 'Justificación' : 'Terminó';

  return (
    <Seccion titulo={`Por revisar${items.length ? ` (${items.length})` : ''}`}>
      <Tarjeta estilo={{ gap: 0, paddingVertical: espacio.s }}>
        {items.length === 0 ? (
          <Texto suave>Nada pendiente. Aquí aparecerán las tareas terminadas, propuestas y justificaciones.</Texto>
        ) : null}
        {visibles.map((oc, i) => (
          <View key={oc.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: color.borde } : undefined}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/revisar/[id]', params: { id: oc.id } })}
              style={({ pressed }) => [estilos.fila, { paddingVertical: espacio.m }, pressed && { opacity: 0.6 }]}>
              <Avatar emoji={oc.hijo.avatar} tamano={38} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto }} numberOfLines={1}>
                  {oc.tarea.titulo}
                </Text>
                <Text style={{ fontSize: 13, color: color.textoSuave }}>
                  {oc.hijo.nombre} · {formatoDia(oc.fecha)}
                </Text>
              </View>
              <Insignia texto={tipo(oc.estado)} tipo={oc.estado === 'finalizada' ? 'aviso' : 'info'} />
            </Pressable>
          </View>
        ))}
        {items.length > 4 ? (
          <Boton
            titulo={verTodas ? 'Ver menos' : `Ver las ${items.length}`}
            variante="enlace"
            onPress={() => setVerTodas((v) => !v)}
          />
        ) : null}
      </Tarjeta>
    </Seccion>
  );
}

function TarjetaHijo({ r }: { r: ResumenHijo }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/hijo/[id]', params: { id: r.hijo.id } })}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Tarjeta>
        <View style={estilos.fila}>
          <Avatar emoji={r.hijo.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={estilos.seccion}>{r.hijo.nombre}</Text>
            <Texto suave>
              {r.totalHoy ? `${r.hechasHoy} de ${r.totalHoy} tareas hoy` : 'Sin tareas hoy'}
            </Texto>
          </View>
          {r.racha > 0 ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>🔥</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: color.texto }}>
                {r.racha} {r.racha === 1 ? 'día' : 'días'}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 22, color: color.textoSuave }}>›</Text>
        </View>
        {r.totalHoy ? <BarraProgreso valor={r.hechasHoy} total={r.totalHoy} colorBarra={color.exito} /> : null}
        {r.enCurso || r.atrasadasHoy ? (
          <View style={[estilos.fila, { flexWrap: 'wrap', gap: espacio.s }]}>
            {r.enCurso ? <Insignia texto={`▶ En curso: ${r.enCurso.tarea.titulo}`} tipo="info" /> : null}
            {r.atrasadasHoy ? (
              <Insignia texto={`${r.atrasadasHoy} atrasada${r.atrasadasHoy > 1 ? 's' : ''}`} tipo="peligro" />
            ) : null}
          </View>
        ) : null}
      </Tarjeta>
    </Pressable>
  );
}

function Dashboard({ familiaId, hijos }: { familiaId: string; hijos: ResumenHijo['hijo'][] }) {
  const [f, setF] = useState<FiltroDashboard>({ periodo: 'semana', dia: hoy(), hijoId: null, categoria: null });
  const { datos: d } = useConsulta(() => dashboard(familiaId, f), `${familiaId}|${JSON.stringify(f)}`);

  const paso = f.periodo === 'dia' ? 1 : 7;
  const hayFuturo = f.periodo === 'dia' ? f.dia >= hoy() : inicioSemana(f.dia) >= inicioSemana(hoy());
  const titulo =
    f.periodo === 'dia'
      ? f.dia === hoy()
        ? 'Hoy'
        : formatoDia(f.dia, { weekday: 'long', day: 'numeric', month: 'short' })
      : inicioSemana(f.dia) === inicioSemana(hoy())
        ? 'Esta semana'
        : `Semana del ${formatoDia(inicioSemana(f.dia), { day: 'numeric', month: 'short' })}`;
  const pct = d && d.total ? Math.round((d.completadas / d.total) * 100) : null;

  return (
    <Seccion titulo="Tareas completadas">
      <Tarjeta>
        <Chips
          opciones={[
            { valor: 'dia', etiqueta: 'Día' },
            { valor: 'semana', etiqueta: 'Semana' },
          ]}
          valor={f.periodo}
          onCambio={(periodo) => setF({ ...f, periodo, dia: hoy() })}
        />
        <View style={estilos.filaEntre}>
          <Boton titulo="‹" variante="secundario" estilo={{ minHeight: 36, width: 44 }} onPress={() => setF({ ...f, dia: sumarDias(f.dia, -paso) })} />
          <Text style={estilos.seccion}>{capitalizar(titulo)}</Text>
          <Boton
            titulo="›"
            variante="secundario"
            estilo={{ minHeight: 36, width: 44 }}
            deshabilitado={hayFuturo}
            onPress={() => setF({ ...f, dia: sumarDias(f.dia, paso) })}
          />
        </View>

        {hijos.length > 1 ? (
          <Chips
            opciones={[{ valor: null, etiqueta: 'Todos' }, ...hijos.map((h) => ({ valor: h.id, etiqueta: `${h.avatar} ${h.nombre}` }))]}
            valor={f.hijoId}
            onCambio={(hijoId) => setF({ ...f, hijoId })}
          />
        ) : null}
        <Chips<Categoria | null>
          opciones={[
            { valor: null, etiqueta: 'Todas' },
            { valor: 'domestica', etiqueta: `${ICONO_CATEGORIA.domestica} Doméstica` },
            { valor: 'escolar', etiqueta: `${ICONO_CATEGORIA.escolar} Escolar` },
          ]}
          valor={f.categoria}
          onCambio={(categoria) => setF({ ...f, categoria })}
        />

        {d ? (
          d.total === 0 ? (
            <Texto suave centrado>
              No hubo tareas en este periodo.
            </Texto>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' }}>
                <Indicador valor={`${pct}%`} etiqueta="Cumplimiento" mitad detalle={`${d.completadas} de ${d.total}`} />
                <Indicador valor={String(d.aTiempo)} etiqueta="A tiempo" mitad />
                <Indicador valor={String(d.tarde)} etiqueta="Tarde" mitad />
                <Indicador valor={String(d.pendientes)} etiqueta="Pendientes" mitad />
              </View>
              {f.periodo === 'semana' ? (
                <View style={{ gap: espacio.xs }}>
                  <Texto suave>Cumplimiento por día (toca una barra)</Texto>
                  <GraficaDias dias={d.porDia} />
                </View>
              ) : null}
              {!f.categoria ? (
                <View style={{ gap: espacio.s }}>
                  {(['domestica', 'escolar'] as const).map((c) => {
                    const v = d.porCategoria[c];
                    return (
                      <View key={c} style={{ gap: 4 }}>
                        <View style={estilos.filaEntre}>
                          <Text style={{ fontSize: 14, color: color.texto }}>
                            {ICONO_CATEGORIA[c]} {NOMBRE_CATEGORIA[c]}
                          </Text>
                          <Text style={{ fontSize: 14, color: color.textoSuave }}>
                            {v.completadas} de {v.total}
                          </Text>
                        </View>
                        <BarraProgreso valor={v.completadas} total={v.total} />
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </>
          )
        ) : null}
      </Tarjeta>
    </Seccion>
  );
}
