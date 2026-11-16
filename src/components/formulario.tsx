import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { capitalizar, formatoDia, hoy, sumarDias } from '@/data/fechas';
import type { Usuario } from '@/data/tipos';
import { color, espacio, radio } from '@/theme';

import { estilos } from './ui';

export function Etiqueta({ children, ayuda }: { children: string; ayuda?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={estilos.etiqueta}>{children}</Text>
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

function Pastilla({ texto, activo, onPress, ancho }: { texto: string; activo: boolean; onPress: () => void; ancho?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      style={{
        minWidth: ancho,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radio.m,
        borderWidth: 1.5,
        alignItems: 'center',
        borderColor: activo ? color.primario : color.borde,
        backgroundColor: activo ? color.primarioSuave : color.superficie,
      }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: activo ? color.primario : color.texto }}>{texto}</Text>
    </Pressable>
  );
}

/** Próximos 14 días en una fila desplazable. */
export function SelectorFecha({ valor, onCambio }: { valor: string; onCambio: (clave: string) => void }) {
  const base = hoy();
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(base, i));
  const nombre = (d: string, i: number) =>
    i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : capitalizar(formatoDia(d, { weekday: 'short', day: 'numeric' }));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
      {valor < base ? (
        <Pastilla texto={`Desde ${formatoDia(valor, { day: 'numeric', month: 'short' })}`} activo onPress={() => onCambio(valor)} />
      ) : null}
      {dias.map((d, i) => (
        <Pastilla key={d} texto={nombre(d, i)} activo={valor === d} onPress={() => onCambio(d)} />
      ))}
    </ScrollView>
  );
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Hora `HH:MM` con botones − / + (hora de 1 en 1, minutos de 5 en 5). Funciona igual en Android, iOS y web. */
export function SelectorHora({ valor, onCambio }: { valor: string; onCambio: (hhmm: string) => void }) {
  const [h, m] = valor.split(':').map(Number);
  const cambiar = (dh: number, dm: number) => {
    let total = (h * 60 + m + dh * 60 + dm + 1440) % 1440;
    total = Math.round(total / 5) * 5 % 1440;
    onCambio(`${dos(Math.floor(total / 60))}:${dos(total % 60)}`);
  };
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return (
    <View style={[estilos.fila, { justifyContent: 'center', gap: espacio.l }]}>
      <Rueda etiqueta="hora" texto={String(h12)} onMenos={() => cambiar(-1, 0)} onMas={() => cambiar(1, 0)} />
      <Text style={{ fontSize: 30, fontWeight: '700', color: color.texto }}>:</Text>
      <Rueda etiqueta="minutos" texto={dos(m)} onMenos={() => cambiar(0, -5)} onMas={() => cambiar(0, 5)} />
      <View style={{ gap: espacio.xs }}>
        <Pastilla texto="a.m." activo={h < 12} onPress={() => h >= 12 && cambiar(-12, 0)} ancho={64} />
        <Pastilla texto="p.m." activo={h >= 12} onPress={() => h < 12 && cambiar(12, 0)} ancho={64} />
      </View>
    </View>
  );
}

function Rueda({ etiqueta, texto, onMenos, onMas }: { etiqueta: string; texto: string; onMenos: () => void; onMas: () => void }) {
  const boton = (signo: string, fn: () => void, nombre: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nombre}
      onPress={fn}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 52,
        height: 36,
        borderRadius: radio.s,
        backgroundColor: pressed ? color.borde : color.fondo,
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <Text style={{ fontSize: 20, color: color.primario, fontWeight: '700' }}>{signo}</Text>
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center', gap: espacio.xs }}>
      {boton('+', onMas, `Subir ${etiqueta}`)}
      <Text style={{ fontSize: 34, fontWeight: '800', color: color.texto, minWidth: 52, textAlign: 'center' }}>{texto}</Text>
      {boton('−', onMenos, `Bajar ${etiqueta}`)}
    </View>
  );
}

/** Varias opciones fijas en una fila (una sola elegida). */
export function Opciones<T extends string | number>({
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
      {opciones.map((o) => (
        <Pastilla key={String(o.valor)} texto={o.etiqueta} activo={o.valor === valor} onPress={() => onCambio(o.valor)} />
      ))}
    </View>
  );
}

/** Varias opciones (multi-selección). */
export function OpcionesMultiples<T extends string>({
  opciones,
  valores,
  onCambio,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valores: T[];
  onCambio: (v: T[]) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
      {opciones.map((o) => {
        const activo = valores.includes(o.valor);
        return (
          <Pastilla
            key={o.valor}
            texto={o.etiqueta}
            activo={activo}
            ancho={44}
            onPress={() => onCambio(activo ? valores.filter((v) => v !== o.valor) : [...valores, o.valor])}
          />
        );
      })}
    </View>
  );
}

export function SelectorHijos({
  hijos,
  valores,
  onCambio,
  bloqueado,
}: {
  hijos: Usuario[];
  valores: string[];
  onCambio: (ids: string[]) => void;
  bloqueado?: boolean;
}) {
  return (
    <OpcionesMultiples
      opciones={hijos.map((h) => ({ valor: h.id, etiqueta: `${h.avatar} ${h.nombre}` }))}
      valores={valores}
      onCambio={bloqueado ? () => undefined : onCambio}
    />
  );
}

export function FilaInterruptor({
  titulo,
  detalle,
  valor,
  onCambio,
}: {
  titulo: string;
  detalle?: string;
  valor: boolean;
  onCambio: (v: boolean) => void;
}) {
  return (
    <View style={[estilos.filaEntre, { paddingVertical: espacio.xs }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.texto}>{titulo}</Text>
        {detalle ? <Text style={estilos.ayuda}>{detalle}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambio}
        trackColor={{ true: color.primario, false: color.deshabilitado }}
        thumbColor="#fff"
        accessibilityLabel={titulo}
      />
    </View>
  );
}

/** "5:30 p.m." a partir de `HH:MM`. */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${dos(m)} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

export function sumarMinutos(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + minutos) % 1440;
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}
