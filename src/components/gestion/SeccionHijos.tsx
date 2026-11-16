import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { avisar, confirmar } from '@/components/dialogos';
import {
  Aviso,
  Avatar,
  Boton,
  Campo,
  CampoPin,
  estilos,
  Insignia,
  Seccion,
  SelectorAvatar,
  Tarjeta,
  Texto,
} from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { formatoHora } from '@/data/fechas';
import {
  aprobarMiembro,
  cerrarSesionRemota,
  desvincularHijo,
  editarHijo,
  miembros,
  rechazarMiembro,
  restablecerPin,
} from '@/data/servicios/familia';
import { cancelarInvitacion, generarInvitacion, invitacionesVigentes } from '@/data/servicios/invitaciones';
import type { Invitacion, Rol, Usuario } from '@/data/tipos';
import { useConsulta } from '@/data/useConsulta';
import { color, espacio, radio } from '@/theme';

type Ejecutar = (accion: () => Promise<unknown>) => Promise<boolean>;

/** M3 — Agregar hijos: invitar (código, enlace o QR), aprobar/rechazar, editar, PIN, desvincular. */
export function SeccionHijos({ padreId, familiaId }: { padreId: string; familiaId: string }) {
  const { datos: lista } = useConsulta(() => miembros(familiaId), familiaId);
  const { datos: invitaciones } = useConsulta(() => invitacionesVigentes(familiaId), familiaId);
  const [error, setError] = useState('');

  const pendientes = (lista ?? []).filter((m) => m.estado === 'pendiente');
  const hijos = (lista ?? []).filter((m) => m.rol === 'hijo' && m.estado === 'activo');

  const ejecutar: Ejecutar = async (accion) => {
    setError('');
    try {
      await accion();
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    }
  };

  return (
    <>
      <Aviso>{error}</Aviso>

      {pendientes.length > 0 ? (
        <Seccion titulo="Solicitudes por aprobar">
          {pendientes.map((p) => (
            <Tarjeta key={p.id}>
              <View style={estilos.fila}>
                <Avatar emoji={p.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={estilos.seccion}>{p.nombre}</Text>
                  <Texto suave>
                    {p.rol === 'hijo' ? 'Hijo/a' : `Padre/madre · ${p.identificador}`} · se registró el{' '}
                    {new Date(p.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </Texto>
                </View>
              </View>
              <View style={estilos.fila}>
                <Boton
                  titulo="Rechazar"
                  variante="peligro"
                  estilo={{ flex: 1 }}
                  onPress={async () => {
                    if (await confirmar('Rechazar solicitud', `${p.nombre} no podrá entrar a la familia.`, 'Rechazar')) {
                      ejecutar(() => rechazarMiembro(padreId, p.id));
                    }
                  }}
                />
                <Boton titulo="Aprobar" estilo={{ flex: 1 }} onPress={() => ejecutar(() => aprobarMiembro(padreId, p.id))} />
              </View>
            </Tarjeta>
          ))}
        </Seccion>
      ) : null}

      <Invitar padreId={padreId} invitaciones={invitaciones ?? []} ejecutar={ejecutar} />

      <Seccion titulo="Hijos">
        {hijos.length === 0 ? <Texto suave>Todavía no hay hijos aprobados.</Texto> : null}
        {hijos.map((h) => (
          <FilaHijo key={h.id} hijo={h} padreId={padreId} ejecutar={ejecutar} />
        ))}
      </Seccion>
    </>
  );
}

function Invitar({ padreId, invitaciones, ejecutar }: { padreId: string; invitaciones: Invitacion[]; ejecutar: Ejecutar }) {
  const [generando, setGenerando] = useState<Rol | null>(null);

  async function generar(rol: Rol) {
    setGenerando(rol);
    await ejecutar(() => generarInvitacion(padreId, rol));
    setGenerando(null);
  }

  return (
    <Seccion titulo="Invitar">
      <View style={estilos.fila}>
        <Boton titulo="Hijo/a" estilo={{ flex: 1 }} onPress={() => generar('hijo')} cargando={generando === 'hijo'} />
        <Boton
          titulo="Padre/madre"
          variante="secundario"
          estilo={{ flex: 1 }}
          onPress={() => generar('padre')}
          cargando={generando === 'padre'}
        />
      </View>
      {invitaciones.length > 0 ? <Texto suave>Invitaciones vigentes (duran 48 horas y sirven una sola vez):</Texto> : null}
      {invitaciones.map((inv) => (
        <TarjetaInvitacion key={inv.codigo} inv={inv} padreId={padreId} />
      ))}
    </Seccion>
  );
}

export function TarjetaInvitacion({ inv, padreId }: { inv: Invitacion; padreId: string }) {
  const [verQR, setVerQR] = useState(false);
  const expira = new Date(inv.expira);
  const paraHijo = inv.rol === 'hijo';
  const enlace = Linking.createURL('/hijo-codigo', { queryParams: { codigo: inv.codigo } });

  async function compartir() {
    const instrucciones = paraHijo
      ? `Abre Tareas en Familia, elige "Soy hijo/a" y escribe el código ${inv.codigo}.`
      : `Descarga Tareas en Familia, elige "Soy padre/madre › Soy nuevo" y usa el código ${inv.codigo}.`;
    await Share.share({ message: paraHijo ? `${instrucciones}\n\nO abre este enlace: ${enlace}` : instrucciones });
  }

  return (
    <Tarjeta>
      <View style={estilos.filaEntre}>
        <Insignia texto={paraHijo ? 'Para hijo/a' : 'Para padre/madre'} tipo={paraHijo ? 'aviso' : 'info'} />
        <Texto suave>
          Vence {expira.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}{' '}
          {formatoHora(inv.expira)}
        </Texto>
      </View>
      <Text
        selectable
        accessibilityLabel={`Código ${inv.codigo.split('').join(' ')}`}
        style={{
          fontSize: 40,
          fontWeight: '800',
          letterSpacing: 8,
          textAlign: 'center',
          color: color.texto,
          backgroundColor: color.fondo,
          borderRadius: radio.m,
          paddingVertical: espacio.m,
        }}>
        {inv.codigo}
      </Text>
      {verQR && paraHijo ? (
        <View style={{ alignItems: 'center', gap: espacio.s, paddingVertical: espacio.s }}>
          <QRCode value={enlace} size={200} />
          <Texto suave centrado>
            Tu hijo lo escanea con la cámara del teléfono para abrir la app con el código ya puesto.
          </Texto>
        </View>
      ) : null}
      <View style={estilos.fila}>
        <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1 }} onPress={() => cancelarInvitacion(padreId, inv.codigo)} />
        {paraHijo ? (
          <Boton titulo={verQR ? 'Ocultar' : 'QR'} variante="secundario" estilo={{ flex: 1 }} onPress={() => setVerQR((v) => !v)} />
        ) : null}
        <Boton titulo="Compartir" estilo={{ flex: 1 }} onPress={compartir} />
      </View>
    </Tarjeta>
  );
}

type Modo = 'cerrado' | 'menu' | 'pin' | 'editar';

function FilaHijo({ hijo, padreId, ejecutar }: { hijo: Usuario; padreId: string; ejecutar: Ejecutar }) {
  const [modo, setModo] = useState<Modo>('cerrado');
  const [pin, setPin] = useState('');
  const [nombre, setNombre] = useState(hijo.nombre);
  const [avatar, setAvatar] = useState(hijo.avatar);

  return (
    <Tarjeta>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: modo !== 'cerrado' }}
        onPress={() => setModo((m) => (m === 'cerrado' ? 'menu' : 'cerrado'))}
        style={estilos.fila}>
        <Avatar emoji={hijo.avatar} />
        <Text style={[estilos.seccion, { flex: 1 }]}>{hijo.nombre}</Text>
        <Text style={{ fontSize: 18, color: color.textoSuave }}>{modo === 'cerrado' ? '▾' : '▴'}</Text>
      </Pressable>

      {modo === 'menu' ? (
        <View style={{ gap: espacio.s }}>
          <Boton
            titulo="Editar nombre y avatar"
            variante="secundario"
            onPress={() => (setNombre(hijo.nombre), setAvatar(hijo.avatar), setModo('editar'))}
          />
          <Boton titulo="Restablecer PIN" variante="secundario" onPress={() => (setPin(''), setModo('pin'))} />
          <Boton
            titulo="Cerrar su sesión"
            variante="secundario"
            onPress={async () => {
              if (await confirmar('Cerrar sesión a distancia', `${hijo.nombre} tendrá que volver a escribir su PIN para entrar.`, 'Cerrar sesión')) {
                if (await ejecutar(() => cerrarSesionRemota(padreId, hijo.id))) avisar('Listo', `Se cerró la sesión de ${hijo.nombre}.`);
              }
            }}
          />
          <Boton
            titulo="Desvincular de la familia"
            variante="peligro"
            onPress={async () => {
              const ok = await confirmar(
                `Desvincular a ${hijo.nombre}`,
                'Se cerrará su sesión y se cancelarán sus tareas pendientes. Su historial se conserva. Para volver necesitará una invitación nueva.',
                'Desvincular',
              );
              if (ok) await ejecutar(() => desvincularHijo(padreId, hijo.id));
            }}
          />
        </View>
      ) : null}

      {modo === 'pin' ? (
        <View style={{ gap: espacio.s }}>
          <CampoPin etiqueta={`Nuevo PIN para ${hijo.nombre}`} valor={pin} onCambio={setPin} autoFocus />
          <View style={estilos.fila}>
            <Boton titulo="Volver" variante="secundario" estilo={{ flex: 1 }} onPress={() => setModo('menu')} />
            <Boton
              titulo="Guardar"
              estilo={{ flex: 1 }}
              deshabilitado={pin.length !== 4}
              onPress={async () => {
                if (await ejecutar(() => restablecerPin(padreId, hijo.id, pin))) {
                  setModo('cerrado');
                  avisar('PIN actualizado', `Díselo a ${hijo.nombre} para que pueda entrar.`);
                }
              }}
            />
          </View>
        </View>
      ) : null}

      {modo === 'editar' ? (
        <View style={{ gap: espacio.m }}>
          <Campo etiqueta="Nombre o apodo" value={nombre} onChangeText={setNombre} maxLength={40} />
          <SelectorAvatar valor={avatar} onCambio={setAvatar} />
          <View style={estilos.fila}>
            <Boton titulo="Volver" variante="secundario" estilo={{ flex: 1 }} onPress={() => setModo('menu')} />
            <Boton
              titulo="Guardar"
              estilo={{ flex: 1 }}
              onPress={async () => {
                if (await ejecutar(() => editarHijo(padreId, hijo.id, { nombre, avatar }))) setModo('cerrado');
              }}
            />
          </View>
        </View>
      ) : null}
    </Tarjeta>
  );
}
