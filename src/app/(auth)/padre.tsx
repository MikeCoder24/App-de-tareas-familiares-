import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Aviso, Boton, Campo, estilos, Pantalla, Texto, Titulo } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { iniciarSesionPadre, registrarPadre } from '@/data/servicios/auth';
import { useSesion } from '@/session/SesionProvider';
import { color, espacio, radio } from '@/theme';

type Modo = 'entrar' | 'crear';

/** M1 — Formulario del padre: iniciar sesión o crear cuenta (y familia). */
export default function AccesoPadre() {
  const { refrescar } = useSesion();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [conCodigo, setConCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      if (modo === 'entrar') {
        await iniciarSesionPadre(identificador, contrasena);
      } else {
        await registrarPadre({
          nombre,
          identificador,
          contrasena,
          codigoInvitacion: conCodigo ? codigo : undefined,
        });
      }
      // La sesión cambió: el índice redirige según rol y estado.
      await refrescar();
      router.replace('/');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const proveedorPendiente = (p: string) =>
    Alert.alert(`Continuar con ${p}`, 'Estará disponible cuando la app se conecte al servidor (Supabase).');

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Titulo sub={modo === 'entrar' ? 'Qué bueno verte de nuevo.' : 'Al terminar se crea tu familia.'}>
        {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
      </Titulo>

      <Selector modo={modo} onCambio={(m) => (setModo(m), setError(''))} />

      {modo === 'crear' ? (
        <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Laura Pérez" autoComplete="name" />
      ) : null}
      <Campo
        etiqueta="Correo o teléfono"
        value={identificador}
        onChangeText={setIdentificador}
        placeholder="tucorreo@ejemplo.com o 55 1234 5678"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
      />
      <View style={{ gap: espacio.xs }}>
        <Campo
          etiqueta="Contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry={!verContrasena}
          placeholder={modo === 'crear' ? 'Mínimo 8 caracteres' : ''}
          autoCapitalize="none"
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
        />
        <Pressable onPress={() => setVerContrasena((v) => !v)} hitSlop={8}>
          <Text style={{ color: color.primario, fontSize: 13 }}>
            {verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          </Text>
        </Pressable>
      </View>

      {modo === 'crear' ? (
        conCodigo ? (
          <Campo
            etiqueta="Código de invitación de tu familia"
            ayuda="Te lo da el otro padre o madre desde Gestión › Invitar."
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="123456"
          />
        ) : (
          <Pressable onPress={() => setConCodigo(true)} hitSlop={8}>
            <Text style={{ color: color.primario, fontSize: 14 }}>¿Otro padre o madre te invitó? Usa su código</Text>
          </Pressable>
        )
      ) : null}

      <Aviso>{error}</Aviso>

      <Boton titulo={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'} onPress={enviar} cargando={enviando} />

      {modo === 'entrar' ? (
        <Link href="/olvide" style={{ color: color.primario, textAlign: 'center', fontSize: 14 }}>
          Olvidé mi contraseña
        </Link>
      ) : null}

      <View style={[estilos.fila, { marginVertical: espacio.s }]}>
        <View style={{ flex: 1, height: 1, backgroundColor: color.borde }} />
        <Texto suave>o</Texto>
        <View style={{ flex: 1, height: 1, backgroundColor: color.borde }} />
      </View>
      <Boton titulo="Continuar con Google" variante="secundario" icono="G" onPress={() => proveedorPendiente('Google')} />
      <Boton titulo="Continuar con Apple" variante="secundario" onPress={() => proveedorPendiente('Apple')} />

      <Link href="/privacidad" style={{ color: color.textoSuave, textAlign: 'center', fontSize: 13, marginTop: espacio.s }}>
        Al continuar aceptas el aviso de privacidad
      </Link>
    </Pantalla>
  );
}

function Selector({ modo, onCambio }: { modo: Modo; onCambio: (m: Modo) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: color.borde, borderRadius: radio.m, padding: 3 }}>
      {(['entrar', 'crear'] as const).map((m) => (
        <Pressable
          key={m}
          accessibilityRole="tab"
          accessibilityState={{ selected: modo === m }}
          onPress={() => onCambio(m)}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: radio.s + 2,
            alignItems: 'center',
            backgroundColor: modo === m ? color.superficie : 'transparent',
          }}>
          <Text style={{ fontWeight: '600', color: modo === m ? color.texto : color.textoSuave }}>
            {m === 'entrar' ? 'Ya tengo cuenta' : 'Soy nuevo'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
