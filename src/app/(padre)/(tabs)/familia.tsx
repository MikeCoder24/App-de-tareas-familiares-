import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { avisar, confirmar, elegir } from '@/components/dialogos';
import { FotoFamilia } from '@/components/FotoFamilia';
import { TarjetaInvitacion } from '@/components/gestion/SeccionHijos';
import { Aviso, Avatar, Boton, Campo, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { borrarTodo } from '@/data/db';
import { mensajeDeError } from '@/data/errores';
import { formatoDia } from '@/data/fechas';
import { elegirFoto, type OrigenFoto } from '@/data/fotos';
import { cargarDatosDemo, PIN_DEMO } from '@/data/servicios/demo';
import { editarCuenta, editarFamilia, eliminarCuenta, hayOtroPadre, miembros } from '@/data/servicios/familia';
import { generarInvitacion, invitacionesVigentes } from '@/data/servicios/invitaciones';
import { obtenerSuscripcion } from '@/data/servicios/suscripciones';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio } from '@/theme';

/** M4 — Familia y suscripción: identidad, miembros, plan y cuenta. */
export default function Familia() {
  const { usuario, familia, salir } = useUsuario();
  const { datos: lista } = useConsulta(() => miembros(familia.id), familia.id);
  const { datos: invitaciones } = useConsulta(() => invitacionesVigentes(familia.id), familia.id);
  const { datos: suscripcion } = useConsulta(() => obtenerSuscripcion(familia.id), familia.id);
  const [error, setError] = useState('');

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setError('');
    try {
      await accion();
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    }
  };

  const padres = (lista ?? []).filter((m) => m.rol === 'padre');
  const hijos = (lista ?? []).filter((m) => m.rol === 'hijo');
  const invitacionesPadre = (invitaciones ?? []).filter((i) => i.rol === 'padre');
  const premium = suscripcion?.plan === 'premium';

  return (
    <Pantalla bordesSeguros={[]}>
      <Aviso>{error}</Aviso>
      <Identidad padreId={usuario.id} nombre={familia.nombre} foto={familia.foto} ejecutar={ejecutar} />

      <Seccion titulo="Miembros">
        <Tarjeta estilo={{ gap: 0, paddingVertical: espacio.xs }}>
          {[...padres, ...hijos].map((m, i) => (
            <View
              key={m.id}
              style={[estilos.fila, { paddingVertical: espacio.m }, i > 0 && { borderTopWidth: 1, borderTopColor: color.borde }]}>
              <Avatar emoji={m.avatar} tamano={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: color.texto }}>
                  {m.nombre}
                  {m.id === usuario.id ? ' (tú)' : ''}
                </Text>
                <Texto suave>{m.rol === 'padre' ? 'Padre / madre' : 'Hijo / hija'}</Texto>
              </View>
              {m.estado === 'pendiente' ? <Insignia texto="Pendiente" tipo="aviso" /> : null}
            </View>
          ))}
        </Tarjeta>
        <Boton
          titulo="Invitar a otro padre o madre"
          variante="secundario"
          onPress={() => ejecutar(() => generarInvitacion(usuario.id, 'padre'))}
        />
        {invitacionesPadre.map((inv) => (
          <TarjetaInvitacion key={inv.codigo} inv={inv} padreId={usuario.id} />
        ))}
      </Seccion>

      <Seccion titulo="Suscripción">
        <Pressable accessibilityRole="button" onPress={() => router.push('/suscripcion')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 30 }}>{premium ? '👑' : '🌱'}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={estilos.seccion}>{premium ? 'Premium' : 'Plan Gratis'}</Text>
              <Texto suave>
                {premium && suscripcion?.vence
                  ? `${suscripcion.renovacionAutomatica ? 'Se renueva' : 'Termina'} el ${formatoDia(suscripcion.vence.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Mejora a Premium: hijos y rutinas ilimitados'}
              </Texto>
            </View>
            <Text style={{ fontSize: 22, color: color.textoSuave }}>›</Text>
          </Tarjeta>
        </Pressable>
      </Seccion>

      <Cuenta padreId={usuario.id} nombre={usuario.nombre} identificador={usuario.identificador ?? ''} ejecutar={ejecutar} salir={salir} />

      {__DEV__ ? (
        <Seccion titulo="🛠 Solo desarrollo">
          <Boton
            titulo="Cargar datos de prueba"
            variante="secundario"
            onPress={async () => {
              try {
                await cargarDatosDemo(usuario.id);
                avisar(
                  'Datos cargados',
                  `Se agregaron rutinas con 2 semanas de historial. Si no tenías hijos se crearon Ana y Leo (PIN ${PIN_DEMO}).`,
                );
              } catch (e) {
                avisar('No se pudo', mensajeDeError(e));
              }
            }}
          />
          <Boton
            titulo="Borrar todos los datos del teléfono"
            variante="peligro"
            onPress={async () => {
              if (await confirmar('Borrar todo', 'Se eliminan cuentas, familia y tareas guardadas en este teléfono.', 'Borrar')) {
                await borrarTodo();
                await salir();
              }
            }}
          />
        </Seccion>
      ) : null}
    </Pantalla>
  );
}

type Ejecutar = (accion: () => Promise<unknown>) => Promise<boolean>;

function Identidad({ padreId, nombre, foto, ejecutar }: { padreId: string; nombre: string; foto: string | null; ejecutar: Ejecutar }) {
  const [editando, setEditando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(nombre);

  async function cambiarFoto() {
    const origen = await elegir<OrigenFoto | 'quitar'>('Foto de la familia', [
      { valor: 'galeria', texto: 'Elegir de la galería' },
      { valor: 'camara', texto: 'Tomar foto' },
      ...(foto ? [{ valor: 'quitar' as const, texto: 'Quitar foto' }] : []),
    ]);
    if (!origen) return;
    await ejecutar(async () => {
      const uri = origen === 'quitar' ? null : await elegirFoto(origen, { cuadrada: true });
      if (origen !== 'quitar' && !uri) return;
      await editarFamilia(padreId, { foto: uri });
    });
  }

  return (
    <Tarjeta estilo={{ alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de la familia" onPress={cambiarFoto}>
        <FotoFamilia familia={{ nombre, foto }} tamano={96} />
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            backgroundColor: color.superficie,
            borderRadius: 14,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: color.borde,
          }}>
          <Text style={{ fontSize: 14 }}>📷</Text>
        </View>
      </Pressable>
      {editando ? (
        <View style={{ alignSelf: 'stretch', gap: espacio.s }}>
          <Campo etiqueta="Nombre de la familia" value={nuevoNombre} onChangeText={setNuevoNombre} maxLength={40} autoFocus />
          <View style={estilos.fila}>
            <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1 }} onPress={() => setEditando(false)} />
            <Boton
              titulo="Guardar"
              estilo={{ flex: 1 }}
              onPress={async () => {
                if (await ejecutar(() => editarFamilia(padreId, { nombre: nuevoNombre }))) setEditando(false);
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <Text style={[estilos.titulo, { textAlign: 'center' }]}>{nombre}</Text>
          <Texto suave centrado>
            Todos los miembros ven este nombre y esta foto.
          </Texto>
          <Boton titulo="Editar nombre" variante="enlace" onPress={() => (setNuevoNombre(nombre), setEditando(true))} />
        </>
      )}
    </Tarjeta>
  );
}

function Cuenta({
  padreId,
  nombre,
  identificador,
  ejecutar,
  salir,
}: {
  padreId: string;
  nombre: string;
  identificador: string;
  ejecutar: Ejecutar;
  salir: () => Promise<void>;
}) {
  const [modo, setModo] = useState<'ver' | 'editar' | 'eliminar'>('ver');
  const [n, setN] = useState(nombre);
  const [id, setId] = useState(identificador);
  const [confirmacion, setConfirmacion] = useState('');
  const { datos: otroPadre } = useConsulta(() => hayOtroPadre(padreId), padreId);

  return (
    <Seccion titulo="Cuenta">
      {modo === 'editar' ? (
        <Tarjeta>
          <Campo etiqueta="Tu nombre" value={n} onChangeText={setN} />
          <Campo etiqueta="Correo o teléfono" value={id} onChangeText={setId} autoCapitalize="none" keyboardType="email-address" />
          <View style={estilos.fila}>
            <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1 }} onPress={() => setModo('ver')} />
            <Boton
              titulo="Guardar"
              estilo={{ flex: 1 }}
              onPress={async () => {
                if (await ejecutar(() => editarCuenta(padreId, { nombre: n, identificador: id }))) setModo('ver');
              }}
            />
          </View>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <View style={estilos.filaEntre}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.seccion}>{nombre}</Text>
              <Texto suave>{identificador}</Texto>
            </View>
            <Boton titulo="Editar" variante="enlace" onPress={() => (setN(nombre), setId(identificador), setModo('editar'))} />
          </View>
          <View style={[estilos.filaEntre, { borderTopWidth: 1, borderTopColor: color.borde, paddingTop: espacio.m }]}>
            <Text style={estilos.texto}>Idioma</Text>
            <Texto suave>Español (México)</Texto>
          </View>
        </Tarjeta>
      )}

      <Boton
        titulo="Cerrar sesión"
        variante="secundario"
        onPress={async () => {
          if (await confirmar('Cerrar sesión', '¿Quieres salir de tu cuenta en este teléfono?', 'Salir')) salir();
        }}
      />

      {modo === 'eliminar' ? (
        <Tarjeta estilo={{ borderColor: color.peligro }}>
          <Text style={[estilos.seccion, { color: color.peligro }]}>
            {otroPadre ? 'Eliminar mi cuenta' : 'Eliminar cuenta y familia'}
          </Text>
          <Texto>
            {otroPadre
              ? 'Saldrás de la familia y se borrará tu cuenta. La familia, los hijos y las tareas siguen con el otro padre o madre.'
              : 'Se borrarán para siempre tu cuenta, la familia, los hijos, las tareas y todo el historial. No se puede deshacer.'}
          </Texto>
          <Campo
            etiqueta='Escribe "ELIMINAR" para confirmar'
            value={confirmacion}
            onChangeText={setConfirmacion}
            autoCapitalize="characters"
          />
          <View style={estilos.fila}>
            <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1 }} onPress={() => setModo('ver')} />
            <Boton
              titulo="Eliminar"
              variante="peligro"
              estilo={{ flex: 1 }}
              deshabilitado={confirmacion.trim().toUpperCase() !== 'ELIMINAR'}
              onPress={async () => {
                if (await ejecutar(() => eliminarCuenta(padreId))) await salir();
              }}
            />
          </View>
        </Tarjeta>
      ) : (
        <Boton
          titulo={otroPadre ? 'Eliminar mi cuenta' : 'Eliminar cuenta y familia'}
          variante="enlace"
          estilo={{ alignSelf: 'center' }}
          onPress={() => (setConfirmacion(''), setModo('eliminar'))}
        />
      )}
    </Seccion>
  );
}
