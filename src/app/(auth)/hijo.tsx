import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Aviso, Avatar, Boton, CampoPin, estilos, Pantalla, Tarjeta, Texto, Titulo } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { hijosDelDispositivo, iniciarSesionHijo } from '@/data/servicios/auth';
import type { Usuario } from '@/data/tipos';
import { useConsulta } from '@/data/useConsulta';
import { useSesion } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

/** M1 — Hijo: entrar con usuario + PIN (teléfono ya vinculado) o con código la primera vez. */
export default function AccesoHijo() {
  const { refrescar } = useSesion();
  const { datos: hijos } = useConsulta(hijosDelDispositivo);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(pinCompleto: string) {
    if (!elegido) return;
    setError('');
    setEnviando(true);
    try {
      await iniciarSesionHijo(elegido.id, pinCompleto);
      await refrescar();
      router.replace('/');
    } catch (e) {
      setError(mensajeDeError(e));
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  const hayHijos = (hijos?.length ?? 0) > 0;

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Titulo sub={hayHijos ? 'Toca tu nombre y escribe tu PIN.' : 'Para entrar la primera vez necesitas un código.'}>
        ¡Hola! 👋
      </Titulo>

      {hayHijos ? (
        <View style={{ gap: espacio.s }}>
          {hijos!.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              onPress={() => (setElegido(h), setPin(''), setError(''))}>
              <Tarjeta
                estilo={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderColor: elegido?.id === h.id ? color.hijo : color.borde,
                  borderWidth: elegido?.id === h.id ? 2 : 1,
                }}>
                <Avatar emoji={h.avatar} />
                <Text style={[estilos.seccion, { flex: 1 }]}>{h.nombre}</Text>
                {h.estado === 'pendiente' ? <Texto suave>Pendiente</Texto> : null}
              </Tarjeta>
            </Pressable>
          ))}
        </View>
      ) : null}

      {elegido ? (
        <View style={{ gap: espacio.m }}>
          <CampoPin
            etiqueta={`PIN de ${elegido.nombre}`}
            valor={pin}
            autoFocus
            onCambio={(v) => {
              setPin(v);
              if (v.length === 4) entrar(v);
            }}
          />
          <Aviso>{error}</Aviso>
          <Boton titulo="Entrar" variante="hijo" onPress={() => entrar(pin)} cargando={enviando} deshabilitado={pin.length !== 4} />
          <Texto suave centrado>
            ¿Olvidaste tu PIN? Pídele a tu papá o mamá que lo cambie.
          </Texto>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <Boton
        titulo={hayHijos ? 'Soy nuevo: tengo un código' : 'Tengo un código de invitación'}
        variante={hayHijos ? 'secundario' : 'hijo'}
        onPress={() => router.push('/hijo-codigo')}
      />
    </Pantalla>
  );
}
