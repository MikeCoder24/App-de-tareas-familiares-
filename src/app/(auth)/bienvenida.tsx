import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Pantalla, Texto } from '@/components/ui';
import { color, espacio, radio } from '@/theme';

/** M1 — Selector de rol. */
export default function Bienvenida() {
  return (
    <Pantalla>
      <View style={{ alignItems: 'center', gap: espacio.s, marginTop: espacio.xxl, marginBottom: espacio.xl }}>
        <Text style={{ fontSize: 64 }}>🏡</Text>
        <Text style={s.marca}>Tareas en Familia</Text>
        <Texto suave centrado>
          Los papás asignan, los hijos inician y terminan, y todos se enteran.
        </Texto>
      </View>

      <Text style={s.pregunta}>¿Quién eres?</Text>

      <OpcionRol
        emoji="👩‍👧"
        titulo="Soy padre / madre"
        detalle="Crea tu familia o inicia sesión"
        fondo={color.primarioSuave}
        acento={color.primario}
        onPress={() => router.push('/padre')}
      />
      <OpcionRol
        emoji="🧒"
        titulo="Soy hijo / hija"
        detalle="Entra con tu código o tu PIN"
        fondo={color.hijoSuave}
        acento={color.hijo}
        onPress={() => router.push('/hijo')}
      />

      <View style={{ flex: 1 }} />
      <Link href="/privacidad" style={s.enlace}>
        Aviso de privacidad
      </Link>
    </Pantalla>
  );
}

function OpcionRol(p: {
  emoji: string;
  titulo: string;
  detalle: string;
  fondo: string;
  acento: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [s.opcion, { backgroundColor: p.fondo, borderColor: p.acento }, pressed && { opacity: 0.85 }]}>
      <Text style={{ fontSize: 40 }}>{p.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.opcionTitulo, { color: p.acento }]}>{p.titulo}</Text>
        <Text style={s.opcionDetalle}>{p.detalle}</Text>
      </View>
      <Text style={{ fontSize: 22, color: p.acento }}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  marca: { fontSize: 30, fontWeight: '800', color: color.texto },
  pregunta: { fontSize: 18, fontWeight: '700', color: color.texto },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.l,
    padding: espacio.l,
    borderRadius: radio.l,
    borderWidth: 1.5,
  },
  opcionTitulo: { fontSize: 18, fontWeight: '700' },
  opcionDetalle: { fontSize: 14, color: color.textoSuave, marginTop: 2 },
  enlace: { color: color.primario, textAlign: 'center', fontSize: 14, padding: espacio.s },
});
