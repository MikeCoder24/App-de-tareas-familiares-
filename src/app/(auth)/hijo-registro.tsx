import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Boton, Campo, CampoPin, Pantalla, Seccion, SelectorAvatar, Texto } from '@/components/ui';
import { ErrorApp, mensajeDeError } from '@/data/errores';
import { registrarHijo } from '@/data/servicios/auth';
import { useSesion } from '@/session/SesionProvider';
import { AVATARES } from '@/theme';

/** M1 flujo 3 — Paso 2: nombre o apodo, avatar y PIN. Queda Pendiente. */
export default function RegistroHijo() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { refrescar } = useSesion();
  const [nombre, setNombre] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARES[0]);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function crear() {
    setError('');
    setEnviando(true);
    try {
      if (pin !== pin2) throw new ErrorApp('Los dos PIN no coinciden.');
      await registrarHijo({ codigo: codigo ?? '', nombre, avatar, pin });
      await refrescar();
      router.replace('/');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Campo
        etiqueta="Tu nombre o apodo"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej. Ana"
        autoCapitalize="words"
        maxLength={40}
      />
      <Seccion titulo="Elige tu avatar">
        <SelectorAvatar valor={avatar} onCambio={setAvatar} />
      </Seccion>
      <CampoPin etiqueta="Crea un PIN de 4 números" valor={pin} onCambio={setPin} />
      <CampoPin etiqueta="Repite tu PIN" valor={pin2} onCambio={setPin2} />
      <Texto suave>No le digas tu PIN a nadie. Lo usarás para entrar a la app.</Texto>
      <Aviso>{error}</Aviso>
      <Boton
        titulo="Enviar a mi papá o mamá"
        variante="hijo"
        onPress={crear}
        cargando={enviando}
        deshabilitado={!nombre.trim() || pin.length !== 4 || pin2.length !== 4}
      />
    </Pantalla>
  );
}
