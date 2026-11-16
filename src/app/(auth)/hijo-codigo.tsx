import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Aviso, Boton, Pantalla, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { revisarCodigo } from '@/data/servicios/invitaciones';
import { color, espacio, radio } from '@/theme';

/** M1 flujo 3 — Paso 1: capturar el código de 6 dígitos (también llega por enlace). */
export default function CodigoHijo() {
  const params = useLocalSearchParams<{ codigo?: string }>();
  const [codigo, setCodigo] = useState((params.codigo ?? '').replace(/\D/g, '').slice(0, 6));
  const [error, setError] = useState('');
  const [revisando, setRevisando] = useState(false);

  async function continuar() {
    setError('');
    setRevisando(true);
    try {
      const inv = await revisarCodigo(codigo, 'hijo');
      router.push({ pathname: '/hijo-registro', params: { codigo: inv.codigo } });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setRevisando(false);
    }
  }

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <View style={{ alignItems: 'center', gap: espacio.s, marginTop: espacio.l }}>
        <Text style={{ fontSize: 56 }}>🔑</Text>
        <Texto suave centrado>
          Pídele a tu papá o mamá el código de 6 números que aparece en su app, en Gestión › Invitar.
        </Texto>
      </View>

      <TextInput
        value={codigo}
        onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!params.codigo}
        placeholder="000000"
        placeholderTextColor={color.deshabilitado}
        accessibilityLabel="Código de invitación"
        style={{
          backgroundColor: color.superficie,
          borderWidth: 2,
          borderColor: codigo.length === 6 ? color.hijo : color.borde,
          borderRadius: radio.l,
          fontSize: 36,
          letterSpacing: 10,
          textAlign: 'center',
          paddingVertical: espacio.l,
          color: color.texto,
          fontWeight: '700',
        }}
      />
      <Aviso>{error}</Aviso>
      <Boton titulo="Continuar" variante="hijo" onPress={continuar} cargando={revisando} deshabilitado={codigo.length !== 6} />
    </Pantalla>
  );
}
