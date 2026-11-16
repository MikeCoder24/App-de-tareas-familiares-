import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { avisar, confirmar } from '@/components/dialogos';
import {
  Etiqueta,
  FilaInterruptor,
  hora12,
  Opciones,
  OpcionesMultiples,
  SelectorFecha,
  SelectorHijos,
  SelectorHora,
  sumarMinutos,
} from '@/components/formulario';
import { ICONO_CATEGORIA } from '@/components/tareas';
import { Aviso, Boton, Campo, Pantalla, Tarjeta, Texto } from '@/components/ui';
import { mensajeDeError } from '@/data/errores';
import { type CodigoDia, CODIGOS_DIA, deClave, hoy } from '@/data/fechas';
import { leerAlertas, OPCIONES_RECORDATORIO } from '@/data/servicios/alertas';
import { miembros } from '@/data/servicios/familia';
import {
  cancelarTarea,
  crearTareas,
  diasDeRegla,
  editarTarea,
  type FormularioTarea,
  formularioDe,
  LETRA_DIA,
  obtenerTarea,
  ORDEN_DIAS,
  reglaDeDias,
} from '@/data/servicios/tareas';
import type { Usuario } from '@/data/tipos';
import { useConsulta } from '@/data/useConsulta';
import { useUsuario } from '@/session/SesionProvider';
import { espacio } from '@/theme';

const DURACIONES = [15, 30, 45, 60, 90, 120] as const;

/** M3 — Agregar o editar una tarea o rutina. `id` = "nueva" o el id de la tarea. */
export default function PantallaTarea() {
  const { id, hijo } = useLocalSearchParams<{ id: string; hijo?: string }>();
  const { familia } = useUsuario();
  const esNueva = id === 'nueva';
  const { datos: lista } = useConsulta(() => miembros(familia.id), familia.id);
  const { datos: tarea } = useConsulta(() => (esNueva ? Promise.resolve(null) : obtenerTarea(familia.id, id)), id);
  const { datos: alertas } = useConsulta(() => leerAlertas(familia.id), familia.id);

  const hijos = (lista ?? []).filter((m) => m.rol === 'hijo' && m.estado === 'activo');
  if (!lista || tarea === undefined || !alertas) return null;

  if (!esNueva && !tarea) {
    return (
      <Pantalla bordesSeguros={['bottom']}>
        <Aviso>Esta tarea ya no existe.</Aviso>
      </Pantalla>
    );
  }
  if (hijos.length === 0) {
    return (
      <Pantalla bordesSeguros={['bottom']}>
        <Stack.Screen options={{ title: 'Nueva tarea' }} />
        <Aviso tipo="info">Primero invita y aprueba a un hijo desde Gestión › Hijos.</Aviso>
      </Pantalla>
    );
  }

  const inicial: FormularioTarea = tarea
    ? formularioDe(tarea)
    : {
        titulo: '',
        categoria: 'domestica',
        asignados: hijo && hijos.some((h) => h.id === hijo) ? [hijo] : hijos.length === 1 ? [hijos[0].id] : [],
        fecha: hoy(),
        hora: proximaMediaHora(),
        duracionMin: 30,
        repeticion: null,
        recordatorioMin: alertas.recordatorioMin,
        requiereFoto: false,
        puntos: null,
        notas: '',
      };

  return <Formulario key={id} tareaId={esNueva ? null : id} inicial={inicial} hijos={hijos} />;
}

function proximaMediaHora() {
  const d = new Date(Date.now() + 30 * 60_000);
  const m = d.getMinutes() < 30 ? 30 : 0;
  if (m === 0) d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type TipoRepeticion = 'una' | 'diaria' | 'semana';

function Formulario({ tareaId, inicial, hijos }: { tareaId: string | null; inicial: FormularioTarea; hijos: Usuario[] }) {
  const { usuario } = useUsuario();
  const [f, setF] = useState(inicial);
  const reglaInicial = diasDeRegla(inicial.repeticion);
  const [tipo, setTipo] = useState<TipoRepeticion>(reglaInicial === null ? 'una' : reglaInicial === 'diario' ? 'diaria' : 'semana');
  const [dias, setDias] = useState<CodigoDia[]>(
    Array.isArray(reglaInicial) ? reglaInicial : [CODIGOS_DIA[deClave(inicial.fecha).getDay()]],
  );
  const [puntos, setPuntos] = useState(inicial.puntos?.toString() ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioTarea>) => setF((v) => ({ ...v, ...c }));

  const repeticion = tipo === 'una' ? null : tipo === 'diaria' ? reglaDeDias('diario') : dias.length ? reglaDeDias(dias) : 'FREQ=WEEKLY;BYDAY=';
  const esRutina = tipo !== 'una';

  async function guardar() {
    setError('');
    setGuardando(true);
    try {
      const datos: FormularioTarea = {
        ...f,
        repeticion,
        puntos: puntos.trim() === '' ? null : Number(puntos),
      };
      if (tareaId) {
        await editarTarea(usuario.id, tareaId, datos);
      } else {
        await crearTareas(usuario.id, datos);
      }
      router.back();
      const quienes = hijos.filter((h) => f.asignados.includes(h.id)).map((h) => h.nombre);
      avisar(
        tareaId ? 'Cambios guardados' : esRutina ? 'Rutina creada' : 'Tarea creada',
        tareaId ? 'Se actualizó a partir de hoy.' : `Se asignó a ${quienes.join(' y ')}.`,
      );
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function cancelar() {
    if (!tareaId) return;
    const ok = await confirmar(
      esRutina ? 'Cancelar rutina' : 'Cancelar tarea',
      esRutina ? 'Ya no se generará en los próximos días. El historial se conserva.' : 'Se quitará de la agenda de tu hijo.',
      'Cancelar tarea',
    );
    if (!ok) return;
    try {
      await cancelarTarea(usuario.id, tareaId);
      router.back();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Pantalla bordesSeguros={['bottom']}>
      <Stack.Screen options={{ title: tareaId ? 'Editar tarea' : 'Nueva tarea' }} />

      <Campo
        etiqueta="Título"
        value={f.titulo}
        onChangeText={(titulo) => cambiar({ titulo })}
        placeholder="Ej. Lavar trastes, Tarea de matemáticas"
        maxLength={60}
        autoFocus={!tareaId}
      />

      <View style={{ gap: espacio.s }}>
        <Etiqueta>Categoría</Etiqueta>
        <Opciones
          opciones={[
            { valor: 'domestica', etiqueta: `${ICONO_CATEGORIA.domestica} Doméstica` },
            { valor: 'escolar', etiqueta: `${ICONO_CATEGORIA.escolar} Escolar` },
          ]}
          valor={f.categoria}
          onCambio={(categoria) => cambiar({ categoria })}
        />
      </View>

      <View style={{ gap: espacio.s }}>
        <Etiqueta ayuda={tareaId ? 'No se puede cambiar al editar.' : 'Si eliges varios, se crea una tarea para cada uno.'}>
          Asignado a
        </Etiqueta>
        <SelectorHijos hijos={hijos} valores={f.asignados} onCambio={(asignados) => cambiar({ asignados })} bloqueado={!!tareaId} />
      </View>

      <View style={{ gap: espacio.s }}>
        <Etiqueta>Repetición</Etiqueta>
        <Opciones<TipoRepeticion>
          opciones={[
            { valor: 'una', etiqueta: 'Una vez' },
            { valor: 'diaria', etiqueta: 'Diaria' },
            { valor: 'semana', etiqueta: 'Días de la semana' },
          ]}
          valor={tipo}
          onCambio={setTipo}
        />
        {tipo === 'semana' ? (
          <OpcionesMultiples
            opciones={ORDEN_DIAS.map((d) => ({ valor: d, etiqueta: LETRA_DIA[d] }))}
            valores={dias}
            onCambio={setDias}
          />
        ) : null}
        {esRutina ? <Texto suave>Con repetición es una rutina: aparece cada día que toque.</Texto> : null}
      </View>

      <View style={{ gap: espacio.s }}>
        <Etiqueta>{esRutina ? 'Empieza el' : 'Fecha'}</Etiqueta>
        <SelectorFecha valor={f.fecha} onCambio={(fecha) => cambiar({ fecha })} />
      </View>

      <Tarjeta>
        <Etiqueta>Hora de inicio</Etiqueta>
        <SelectorHora valor={f.hora} onCambio={(hora) => cambiar({ hora })} />
        <Etiqueta ayuda="Después de la hora límite la tarea queda Atrasada.">Duración</Etiqueta>
        <Opciones
          opciones={DURACIONES.map((m) => ({ valor: m, etiqueta: m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', '½') }))}
          valor={f.duracionMin}
          onCambio={(duracionMin) => cambiar({ duracionMin })}
        />
        <Text style={{ fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
          {hora12(f.hora)} – {hora12(sumarMinutos(f.hora, f.duracionMin))}
        </Text>
      </Tarjeta>

      <View style={{ gap: espacio.s }}>
        <Etiqueta ayuda="Le llega un aviso al hijo antes de la hora de inicio.">Recordatorio</Etiqueta>
        <Opciones
          opciones={OPCIONES_RECORDATORIO.map((m) => ({ valor: m, etiqueta: `${m} min antes` }))}
          valor={f.recordatorioMin}
          onCambio={(recordatorioMin) => cambiar({ recordatorioMin })}
        />
      </View>

      <FilaInterruptor
        titulo="Requiere evidencia"
        detalle="Tu hijo tendrá que tomar una foto para poder finalizar."
        valor={f.requiereFoto}
        onCambio={(requiereFoto) => cambiar({ requiereFoto })}
      />

      <Campo
        etiqueta="Puntos (opcional)"
        ayuda="Para recompensas. Se suman cuando apruebas la tarea."
        value={puntos}
        onChangeText={(t) => setPuntos(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        placeholder="0"
      />

      <Campo
        etiqueta="Notas para tu hijo (opcional)"
        value={f.notas}
        onChangeText={(notas) => cambiar({ notas })}
        placeholder="Ej. Recuerda secar y guardar los trastes"
        multiline
        maxLength={300}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <Aviso>{error}</Aviso>
      <Boton titulo={tareaId ? 'Guardar cambios' : esRutina ? 'Crear rutina' : 'Crear tarea'} onPress={guardar} cargando={guardando} />
      {tareaId ? <Boton titulo={esRutina ? 'Cancelar rutina' : 'Cancelar tarea'} variante="peligro" onPress={cancelar} /> : null}
    </Pantalla>
  );
}
