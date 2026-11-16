import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { avisar, confirmar } from '@/components/dialogos';
import { Aviso, Boton, estilos, Insignia, Pantalla, Seccion, Tarjeta, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { formatoDia } from '@/data/fechas';
import { BENEFICIOS, PRECIOS } from '@/data/planes';
import {
  cancelarRenovacion,
  comprarPremium,
  obtenerSuscripcion,
  type Periodo,
  reactivarRenovacion,
  restaurarCompras,
  simularVencimiento,
} from '@/data/servicios/suscripciones';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { color, espacio, radio } from '@/theme';

const fechaLarga = (iso: string) => formatoDia(iso.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' });

/** M4 — Suscripciones: plan actual, beneficios, renovación, cambiar/cancelar, restaurar compras. */
export default function Suscripcion() {
  const { usuario, familia } = useUsuario();
  const { datos: s } = useConsulta(() => obtenerSuscripcion(familia.id), familia.id);
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!s) return null;
  const premium = s.plan === 'premium';

  async function ejecutar(accion: () => Promise<unknown>, exito?: [string, string]) {
    setError('');
    setOcupado(true);
    try {
      await accion();
      if (exito) avisar(...exito);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Tarjeta estilo={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 48 }}>{premium ? '👑' : '🌱'}</Text>
        <Text style={estilos.titulo}>{premium ? 'Premium' : 'Plan Gratis'}</Text>
        {premium && s.vence ? (
          <Texto suave centrado>
            {s.renovacionAutomatica
              ? `Se renueva el ${fechaLarga(s.vence)} (${s.periodo === 'anual' ? PRECIOS.anual.etiqueta : PRECIOS.mensual.etiqueta}).`
              : `Cancelaste la renovación. Sigues en Premium hasta el ${fechaLarga(s.vence)} y luego pasas a Gratis.`}
          </Texto>
        ) : (
          <Texto suave centrado>
            Estás usando el plan gratuito.
          </Texto>
        )}
        {s.simulada ? <Insignia texto="Compra de prueba (sin cobro)" tipo="aviso" /> : null}
      </Tarjeta>

      <Aviso>{error}</Aviso>

      <Seccion titulo="Planes">
        <Plan titulo="Gratis" precio="$0" beneficios={BENEFICIOS.gratis} actual={!premium} />
        <Plan
          titulo="Premium"
          precio={periodo === 'anual' ? PRECIOS.anual.etiqueta : PRECIOS.mensual.etiqueta}
          beneficios={BENEFICIOS.premium}
          actual={premium}
          destacado
        />
      </Seccion>

      {!premium || !s.renovacionAutomatica ? (
        <Seccion titulo={premium ? 'Reactivar' : 'Cambiar a Premium'}>
          {!premium ? (
            <View style={{ flexDirection: 'row', gap: espacio.s }}>
              {(['mensual', 'anual'] as const).map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: periodo === p }}
                  onPress={() => setPeriodo(p)}
                  style={{
                    flex: 1,
                    padding: espacio.m,
                    borderRadius: radio.m,
                    borderWidth: 2,
                    borderColor: periodo === p ? color.primario : color.borde,
                    backgroundColor: periodo === p ? color.primarioSuave : color.superficie,
                    gap: 2,
                  }}>
                  <Text style={{ fontWeight: '700', color: color.texto }}>{p === 'anual' ? 'Anual' : 'Mensual'}</Text>
                  <Text style={{ fontSize: 13, color: color.textoSuave }}>{PRECIOS[p].etiqueta}</Text>
                  {p === 'anual' ? <Text style={{ fontSize: 12, color: '#067647', fontWeight: '600' }}>{PRECIOS.anual.ahorro}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Boton
            titulo={premium ? 'Reactivar renovación' : `Suscribirme · ${PRECIOS[periodo].etiqueta}`}
            cargando={ocupado}
            onPress={() =>
              ejecutar(
                () => (premium ? reactivarRenovacion(usuario.id) : comprarPremium(usuario.id, periodo)),
                premium ? ['Listo', 'Tu suscripción se renovará automáticamente.'] : ['¡Bienvenido a Premium!', 'Ya tienes hijos y rutinas ilimitados.'],
              )
            }
          />
          <Texto suave>
            El cobro se hace con tu cuenta de Google Play o App Store y puedes cancelar cuando quieras. En esta versión de prueba no se
            cobra nada.
          </Texto>
        </Seccion>
      ) : (
        <Boton
          titulo="Cancelar suscripción"
          variante="peligro"
          onPress={async () => {
            const ok = await confirmar(
              'Cancelar suscripción',
              `Seguirás en Premium hasta el ${fechaLarga(s.vence ?? new Date().toISOString())}. Después tu familia pasa al plan Gratis.`,
              'Cancelar suscripción',
            );
            if (ok) ejecutar(() => cancelarRenovacion(usuario.id), ['Suscripción cancelada', 'No se te volverá a cobrar.']);
          }}
        />
      )}

      <Boton
        titulo="Restaurar compras"
        variante="enlace"
        onPress={() =>
          ejecutar(
            () => restaurarCompras(usuario.id),
            ['Compras revisadas', premium ? 'Tu suscripción Premium está activa.' : 'No encontramos compras anteriores.'],
          )
        }
      />

      {__DEV__ && premium ? (
        <Boton
          titulo="🛠 Simular fin del periodo"
          variante="secundario"
          onPress={() => ejecutar(() => simularVencimiento(usuario.id), ['Periodo terminado', s.renovacionAutomatica ? 'Se renovó automáticamente.' : 'La familia volvió a Gratis.'])}
        />
      ) : null}
    </Pantalla>
  );
}

function Plan({
  titulo,
  precio,
  beneficios,
  actual,
  destacado,
}: {
  titulo: string;
  precio: string;
  beneficios: string[];
  actual: boolean;
  destacado?: boolean;
}) {
  return (
    <Tarjeta estilo={destacado ? { borderColor: color.primario, borderWidth: 2 } : undefined}>
      <View style={estilos.filaEntre}>
        <Text style={estilos.seccion}>
          {destacado ? '👑 ' : ''}
          {titulo}
        </Text>
        {actual ? <Insignia texto="Tu plan" tipo="exito" /> : <Text style={{ color: color.textoSuave }}>{precio}</Text>}
      </View>
      {beneficios.map((b) => (
        <Text key={b} style={estilos.texto}>
          ✓ {b}
        </Text>
      ))}
    </Tarjeta>
  );
}
