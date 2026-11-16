import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AVATARES, color, espacio, radio } from '@/theme';

export function Pantalla({
  children,
  sinScroll,
  bordesSeguros = ['top', 'bottom'],
}: {
  children: ReactNode;
  sinScroll?: boolean;
  bordesSeguros?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={bordesSeguros}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {sinScroll ? (
          <View style={estilos.contenido}>{children}</View>
        ) : (
          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ gap: espacio.xs, marginBottom: espacio.s }}>
      <Text style={estilos.titulo}>{children}</Text>
      {sub ? <Text style={estilos.textoSuave}>{sub}</Text> : null}
    </View>
  );
}

export function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <View style={{ gap: espacio.s }}>
      <View style={estilos.filaEntre}>
        <Text style={estilos.seccion}>{titulo}</Text>
        {accion}
      </View>
      {children}
    </View>
  );
}

export function Texto({ children, suave, centrado }: { children: ReactNode; suave?: boolean; centrado?: boolean }) {
  return (
    <Text style={[suave ? estilos.textoSuave : estilos.texto, centrado && { textAlign: 'center' }]}>{children}</Text>
  );
}

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'enlace' | 'hijo';

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando,
  deshabilitado,
  icono,
  estilo,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  cargando?: boolean;
  deshabilitado?: boolean;
  icono?: string;
  estilo?: ViewStyle;
}) {
  const inactivo = deshabilitado || cargando;
  const v = variantes[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo }}
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: v.fondo, borderColor: v.borde },
        variante === 'enlace' && estilos.botonEnlace,
        inactivo && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        estilo,
      ]}>
      {cargando ? (
        <ActivityIndicator color={v.texto} />
      ) : (
        <Text style={[estilos.botonTexto, { color: v.texto }]}>
          {icono ? `${icono}  ` : ''}
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

const variantes: Record<VarianteBoton, { fondo: string; borde: string; texto: string }> = {
  primario: { fondo: color.primario, borde: color.primario, texto: '#fff' },
  hijo: { fondo: color.hijo, borde: color.hijo, texto: '#fff' },
  secundario: { fondo: color.superficie, borde: color.borde, texto: color.texto },
  peligro: { fondo: color.peligroSuave, borde: color.peligroSuave, texto: color.peligro },
  enlace: { fondo: 'transparent', borde: 'transparent', texto: color.primario },
};

export function Campo({ etiqueta, ayuda, style, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={{ gap: espacio.xs }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={color.textoSuave} style={[estilos.campo, style]} {...props} />
      {ayuda ? <Text style={estilos.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function CampoPin({
  etiqueta,
  valor,
  onCambio,
  autoFocus,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <Campo
      etiqueta={etiqueta}
      value={valor}
      onChangeText={(t) => onCambio(t.replace(/\D/g, '').slice(0, 4))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={4}
      autoFocus={autoFocus}
      placeholder="••••"
      style={[estilos.campo, estilos.campoPin]}
    />
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'info' | 'exito'; children: ReactNode }) {
  if (!children) return null;
  const c =
    tipo === 'error'
      ? { fondo: color.peligroSuave, texto: color.peligro }
      : tipo === 'exito'
        ? { fondo: color.exitoSuave, texto: '#067647' }
        : { fondo: color.primarioSuave, texto: color.primario };
  return (
    <View style={[estilos.aviso, { backgroundColor: c.fondo }]}>
      <Text style={{ color: c.texto, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Avatar({ emoji, tamano = 44 }: { emoji: string; tamano?: number }) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: color.hijoSuave,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: tamano * 0.55 }}>{emoji}</Text>
    </View>
  );
}

export function SelectorAvatar({ valor, onCambio }: { valor: string; onCambio: (a: string) => void }) {
  return (
    <View style={estilos.rejillaAvatares}>
      {AVATARES.map((a) => (
        <Pressable
          key={a}
          accessibilityRole="button"
          accessibilityLabel={`Avatar ${a}`}
          accessibilityState={{ selected: a === valor }}
          onPress={() => onCambio(a)}
          style={[estilos.opcionAvatar, a === valor && estilos.opcionAvatarActiva]}>
          <Text style={{ fontSize: 30 }}>{a}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export type TipoInsignia = 'info' | 'aviso' | 'exito' | 'peligro' | 'neutro';

const COLORES_INSIGNIA: Record<TipoInsignia, { fondo: string; texto: string }> = {
  info: { fondo: color.primarioSuave, texto: color.primario },
  aviso: { fondo: color.avisoSuave, texto: '#B54708' },
  exito: { fondo: color.exitoSuave, texto: '#067647' },
  peligro: { fondo: color.peligroSuave, texto: color.peligro },
  neutro: { fondo: color.borde, texto: color.textoSuave },
};

export function Insignia({ texto, tipo = 'info' }: { texto: string; tipo?: TipoInsignia }) {
  const c = COLORES_INSIGNIA[tipo];
  return (
    <View style={{ backgroundColor: c.fondo, borderRadius: radio.completo, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: c.texto, fontSize: 12, fontWeight: '600' }}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  contenido: { padding: espacio.xl, gap: espacio.l, flexGrow: 1 },
  titulo: { fontSize: 26, fontWeight: '700', color: color.texto },
  seccion: { fontSize: 17, fontWeight: '700', color: color.texto },
  texto: { fontSize: 15, color: color.texto, lineHeight: 22 },
  textoSuave: { fontSize: 15, color: color.textoSuave, lineHeight: 22 },
  etiqueta: { fontSize: 14, fontWeight: '600', color: color.texto },
  ayuda: { fontSize: 13, color: color.textoSuave },
  campo: {
    backgroundColor: color.superficie,
    borderWidth: 1,
    borderColor: color.borde,
    borderRadius: radio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: 12,
    fontSize: 16,
    color: color.texto,
  },
  campoPin: { fontSize: 26, letterSpacing: 12, textAlign: 'center' },
  boton: {
    minHeight: 50,
    borderRadius: radio.m,
    borderWidth: 1,
    paddingHorizontal: espacio.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonEnlace: { minHeight: 40 },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  tarjeta: {
    backgroundColor: color.superficie,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: color.borde,
    padding: espacio.l,
    gap: espacio.m,
  },
  aviso: { borderRadius: radio.m, padding: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  rejillaAvatares: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  opcionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.superficie,
    borderWidth: 2,
    borderColor: color.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcionAvatarActiva: { borderColor: color.hijo, backgroundColor: color.hijoSuave },
});
