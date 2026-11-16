import { Text, View } from 'react-native';

import { Aviso, Avatar, Boton, Pantalla, Texto, Titulo } from '@/components/ui';
import { olvidarHijoEnDispositivo } from '@/data/servicios/auth';
import { useSesion } from '@/session/SesionProvider';
import { espacio } from '@/theme';

/** Hijo (o segundo padre) registrado que espera la aprobación de un padre. */
export default function Espera() {
  const { usuario, familia, salir } = useSesion();
  if (!usuario) return null;
  const rechazado = usuario.estado === 'rechazado';
  const esHijo = usuario.rol === 'hijo';
  const quienAprueba = esHijo ? 'tu papá o mamá' : 'el otro padre o madre de la familia';

  return (
    <Pantalla>
      <View style={{ alignItems: 'center', gap: espacio.l, marginTop: espacio.xxl }}>
        <Avatar emoji={usuario.avatar} tamano={96} />
        <Titulo>{rechazado ? 'Solicitud rechazada' : `¡Hola, ${usuario.nombre}!`}</Titulo>
      </View>

      {rechazado ? (
        <Aviso>
          {quienAprueba[0].toUpperCase() + quienAprueba.slice(1)} no aprobó la solicitud para unirte a{' '}
          {familia?.nombre}. Pide un código nuevo si fue un error.
        </Aviso>
      ) : (
        <>
          <Aviso tipo="info">
            Tu solicitud para unirte a {familia?.nombre} está pendiente. En cuanto {quienAprueba} la apruebe podrás
            entrar.
          </Aviso>
          <Text style={{ fontSize: 48, textAlign: 'center' }}>⏳</Text>
          <Texto suave centrado>
            Esta pantalla se actualiza sola cuando te aprueban.
          </Texto>
        </>
      )}

      <View style={{ flex: 1 }} />
      {rechazado && esHijo ? (
        <Boton titulo="Usar otro código" variante="hijo" onPress={() => olvidarHijoEnDispositivo(usuario.id)} />
      ) : null}
      <Boton titulo="Salir" variante="secundario" onPress={salir} />
    </Pantalla>
  );
}
