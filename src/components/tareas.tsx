import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ETIQUETA_ESTADO } from '@/data/estados';
import { formatoHora, inicialDia } from '@/data/fechas';
import type { OcurrenciaVista } from '@/data/servicios/tareas';
import type { Categoria, EstadoOcurrencia } from '@/data/tipos';
import { color, espacio, radio } from '@/theme';

import { Avatar, estilos, Insignia, type TipoInsignia } from './ui';

export const ICONO_CATEGORIA: Record<Categoria, string> = { domestica: '🏠', escolar: '📚' };
export const NOMBRE_CATEGORIA: Record<Categoria, string> = { domestica: 'Doméstica', escolar: 'Escolar' };

const TIPO_ESTADO: Record<EstadoOcurrencia, TipoInsignia> = {
  propuesta: 'info',
  programada: 'neutro',
  iniciada: 'info',
  finalizada: 'aviso',
  aprobada: 'exito',
  atrasada: 'peligro',
  rechazada: 'peligro',
  justificada: 'aviso',
};

export function InsigniaEstado({ estado }: { estado: EstadoOcurrencia }) {
  return <Insignia texto={ETIQUETA_ESTADO[estado]} tipo={TIPO_ESTADO[estado]} />;
}

/** Fila de una ocurrencia: icono de categoría, título, horario y estado. */
export function FilaOcurrencia({
  oc,
  conHijo,
  onPress,
}: {
  oc: OcurrenciaVista;
  conHijo?: boolean;
  onPress?: () => void;
}) {
  const contenido = (
    <View style={[estilos.fila, { paddingVertical: espacio.s }]}>
      {conHijo ? <Avatar emoji={oc.hijo.avatar} tamano={36} /> : <Text style={{ fontSize: 22 }}>{ICONO_CATEGORIA[oc.tarea.categoria]}</Text>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto }} numberOfLines={1}>
          {oc.tarea.titulo}
        </Text>
        <Text style={{ fontSize: 13, color: color.textoSuave }}>
          {conHijo ? `${oc.hijo.nombre} · ` : ''}
          {formatoHora(oc.inicioProgramado)} – {formatoHora(oc.limiteProgramado)}
          {oc.calificacion ? ` · ${'★'.repeat(oc.calificacion)}` : ''}
        </Text>
      </View>
      <InsigniaEstado estado={oc.estado} />
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {contenido}
    </Pressable>
  ) : (
    contenido
  );
}

export function Estrellas({ valor, onCambio, tamano = 36 }: { valor: number; onCambio?: (n: number) => void; tamano?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: espacio.xs, justifyContent: 'center' }} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: valor }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!onCambio}
          onPress={() => onCambio?.(n)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}>
          <Text style={{ fontSize: tamano, color: n <= valor ? '#F5A524' : color.deshabilitado }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BarraProgreso({ valor, total, colorBarra = color.primario }: { valor: number; total: number; colorBarra?: string }) {
  const pct = total ? Math.min(1, valor / total) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: color.borde, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: colorBarra }} />
    </View>
  );
}

/** Selector de una opción (chips). */
export function Chips<T extends string | null>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            onPress={() => onCambio(o.valor)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radio.completo,
              borderWidth: 1,
              borderColor: activo ? color.primario : color.borde,
              backgroundColor: activo ? color.primarioSuave : color.superficie,
            }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: activo ? color.primario : color.textoSuave }}>
              {o.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Número grande con etiqueta (stat tile). */
export function Indicador({
  valor,
  etiqueta,
  detalle,
  mitad,
}: {
  valor: string;
  etiqueta: string;
  detalle?: string;
  /** En rejilla de 2 columnas. */
  mitad?: boolean;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: mitad ? '46%' : 0,
        backgroundColor: color.fondo,
        borderRadius: radio.m,
        padding: espacio.m,
        gap: 2,
      }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: color.texto }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: color.textoSuave }}>{etiqueta}</Text>
      {detalle ? <Text style={{ fontSize: 11, color: color.textoSuave }}>{detalle}</Text> : null}
    </View>
  );
}

/**
 * Barras de cumplimiento por día (una sola serie). Tocar una barra muestra su valor.
 * Días sin tareas o futuros se dibujan como guion.
 */
export function GraficaDias({ dias }: { dias: { dia: string; total: number; completadas: number }[] }) {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const ALTO = 110;
  return (
    <View style={{ gap: espacio.s }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: ALTO + 22, gap: 6 }}>
        {dias.map((d) => {
          const pct = d.total ? d.completadas / d.total : 0;
          const activo = seleccion === d.dia;
          return (
            <Pressable
              key={d.dia}
              accessibilityLabel={`${inicialDia(d.dia)}: ${d.total ? `${d.completadas} de ${d.total}` : 'sin tareas'}`}
              onPress={() => setSeleccion(activo ? null : d.dia)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Text style={{ fontSize: 11, color: color.texto, fontWeight: '600', opacity: activo ? 1 : 0, marginBottom: 2 }}>
                {d.total ? `${d.completadas}/${d.total}` : '—'}
              </Text>
              {d.total ? (
                <View
                  style={{
                    width: '70%',
                    height: Math.max(4, pct * ALTO),
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    backgroundColor: activo ? '#2B44B0' : color.primario,
                  }}
                />
              ) : (
                <View style={{ width: '70%', height: 2, backgroundColor: color.borde }} />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 1, backgroundColor: color.borde, marginTop: -espacio.s }} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {dias.map((d) => (
          <Text key={d.dia} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: color.textoSuave }}>
            {inicialDia(d.dia)}
          </Text>
        ))}
      </View>
    </View>
  );
}
