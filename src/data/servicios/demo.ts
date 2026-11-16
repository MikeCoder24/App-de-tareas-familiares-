// SOLO DESARROLLO: llena la familia con hijos, rutinas e historial para probar
// dashboards y "Por revisar" antes de que existan M3 (crear tareas) y M5 (hijo).
import { crearSecreto, nuevoId } from '../cripto';
import { modificar } from '../db';
import { ErrorApp } from '../errores';
import { aplicar } from '../estados';
import { claveDia, sumarDias } from '../fechas';
import type { Ocurrencia, Usuario } from '../tipos';
import { exigirPadreActivo } from './permisos';
import { insertarTarea, sincronizar } from './tareas';

export const PIN_DEMO = '1234';

function aleatorio(semilla: number) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

const minutos = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const iso = (d: Date) => d.toISOString();

function aLas(diasAtras: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function cargarDatosDemo(padreId: string): Promise<void> {
  const secreto = await crearSecreto(PIN_DEMO);

  await modificar((db) => {
    const padre = exigirPadreActivo(db, padreId);
    const familiaId = padre.familiaId;
    if (db.tareas.some((t) => t.familiaId === familiaId)) {
      throw new ErrorApp('Tu familia ya tiene tareas. Borra los datos primero si quieres volver a cargar la demo.');
    }

    // Hijos: usa los activos o crea dos de prueba.
    let hijos = db.usuarios.filter((u) => u.familiaId === familiaId && u.rol === 'hijo' && u.estado === 'activo');
    if (hijos.length === 0) {
      hijos = (
        [
          ['Ana', '🦄'],
          ['Leo', '🐯'],
        ] as const
      ).map(([nombre, avatar], i) => {
        const h: Usuario = {
          id: nuevoId(),
          familiaId,
          rol: 'hijo',
          nombre,
          avatar,
          estado: 'activo',
          identificador: null,
          ...secreto,
          pushToken: null,
          sesionVersion: 1,
          creadoEn: new Date(Date.now() + i).toISOString(),
        };
        db.usuarios.push(h);
        db.dispositivo.hijosVinculados.push(h.id);
        return h;
      });
    }

    // Rutinas con 14 días de historia para cada hijo.
    const rutinas = [
      { titulo: 'Tender la cama', categoria: 'domestica', h: 7, m: 30, dur: 30, regla: 'FREQ=DAILY', puntos: 5 },
      { titulo: 'Tarea de matemáticas', categoria: 'escolar', h: 17, m: 0, dur: 60, regla: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', puntos: 10 },
      { titulo: 'Lavar trastes', categoria: 'domestica', h: 19, m: 0, dur: 30, regla: 'FREQ=WEEKLY;BYDAY=MO,WE,FR', puntos: 8 },
      { titulo: 'Leer 20 minutos', categoria: 'escolar', h: 20, m: 0, dur: 30, regla: 'FREQ=WEEKLY;BYDAY=TU,TH,SA', puntos: 5 },
    ] as const;
    for (const hijo of hijos) {
      for (const r of rutinas) {
        insertarTarea(db, familiaId, padre.id, {
          titulo: r.titulo,
          categoria: r.categoria,
          asignadoA: hijo.id,
          horaInicio: aLas(14, r.h, r.m),
          horaLimite: minutos(aLas(14, r.h, r.m), r.dur),
          repeticion: r.regla,
          puntos: r.puntos,
        });
      }
    }
    sincronizar(db, familiaId);

    // Historial: la mayoría aprobadas a tiempo, algunas tarde, rechazadas o sin hacer.
    const azar = aleatorio(42);
    const diaHoy = claveDia(new Date());
    const comentarios = ['¡Muy bien!', 'Excelente trabajo', 'Bien, pero puedes mejorar', null, null];
    const pasadas = db.ocurrencias.filter((o) => o.fecha < diaHoy);
    for (const o of pasadas) {
      const r = azar();
      const inicio = new Date(o.inicioProgramado);
      const limite = new Date(o.limiteProgramado);
      if (r < 0.7) {
        cerrar(o, inicio, minutos(limite, -5), 4 + Math.round(azar()), comentarios[Math.floor(azar() * 5)]);
      } else if (r < 0.82) {
        cerrar(o, minutos(inicio, 20), minutos(limite, 25), 3, 'La próxima vez a tiempo');
      } else if (r < 0.9) {
        if (o.estado === 'atrasada') aplicar(o, 'iniciar', 'hijo');
        o.iniciadaEn = iso(inicio);
        aplicar(o, 'finalizar', 'hijo');
        o.finalizadaEn = iso(minutos(limite, -2));
        aplicar(o, 'rechazar', 'padre');
        o.motivoRechazo = 'Quedó a medias, revisa de nuevo';
        o.revisadaEn = o.actualizadaEn = iso(minutos(limite, 60));
      }
      // El resto se queda "atrasada" (no se hizo).
    }

    // Una justificación de ayer esperando al padre.
    const ayer = sumarDias(diaHoy, -1);
    const paraJustificar =
      db.ocurrencias.find((o) => o.fecha === ayer && o.estado === 'atrasada') ??
      db.ocurrencias.find((o) => o.fecha < diaHoy && o.estado === 'atrasada');
    if (paraJustificar) {
      aplicar(paraJustificar, 'justificar', 'hijo');
      paraJustificar.justificacion = 'Ese día tuve ensayo de la escuela y llegué tarde a casa.';
    }

    // Hoy: una por revisar, una en curso y una más tarde (relativas a la hora actual).
    const ahora = new Date();
    const [ana, leo] = [hijos[0], hijos[1] ?? hijos[0]];
    const recoger = insertarTarea(db, familiaId, padre.id, {
      titulo: 'Recoger la ropa',
      categoria: 'domestica',
      asignadoA: ana.id,
      horaInicio: minutos(ahora, -50),
      horaLimite: minutos(ahora, 20),
      repeticion: null,
      puntos: 5,
    });
    const estudiar = insertarTarea(db, familiaId, padre.id, {
      titulo: 'Estudiar para el examen',
      categoria: 'escolar',
      asignadoA: leo.id,
      horaInicio: minutos(ahora, -15),
      horaLimite: minutos(ahora, 45),
      repeticion: null,
      puntos: 15,
    });
    insertarTarea(db, familiaId, padre.id, {
      titulo: 'Doblar la ropa limpia',
      categoria: 'domestica',
      asignadoA: ana.id,
      horaInicio: minutos(ahora, 5),
      horaLimite: minutos(ahora, 35),
      repeticion: null,
      puntos: 6,
      requiereFoto: true,
      notas: 'Guárdala en tu cajón cuando termines.',
    });
    insertarTarea(db, familiaId, padre.id, {
      titulo: 'Sacar la basura',
      categoria: 'domestica',
      asignadoA: ana.id,
      horaInicio: minutos(ahora, 120),
      horaLimite: minutos(ahora, 150),
      repeticion: null,
      puntos: 3,
    });
    const propuesta = insertarTarea(db, familiaId, ana.id, {
      titulo: 'Ordenar el cuarto',
      categoria: 'domestica',
      asignadoA: ana.id,
      horaInicio: aLas(-1, 16),
      horaLimite: aLas(-1, 17),
      repeticion: null,
      origen: 'propuesta',
    });
    sincronizar(db, familiaId);

    const oc = (tareaId: string) => db.ocurrencias.find((o) => o.tareaId === tareaId)!;
    const r1 = oc(recoger.id);
    aplicar(r1, 'iniciar', 'hijo');
    r1.iniciadaEn = iso(minutos(ahora, -45));
    aplicar(r1, 'finalizar', 'hijo');
    r1.finalizadaEn = iso(minutos(ahora, -5));
    const e1 = oc(estudiar.id);
    aplicar(e1, 'iniciar', 'hijo');
    e1.iniciadaEn = iso(minutos(ahora, -10));
    oc(propuesta.id).motivoPropuesta = 'Quiero tener mi cuarto listo para el fin de semana.';
  });
}

function cerrar(o: Ocurrencia, inicio: Date, fin: Date, estrellas: number, comentario: string | null) {
  if (o.estado === 'atrasada' || o.estado === 'programada') aplicar(o, 'iniciar', 'hijo');
  o.iniciadaEn = iso(inicio);
  aplicar(o, 'finalizar', 'hijo');
  o.finalizadaEn = iso(fin);
  aplicar(o, 'aprobar', 'padre');
  o.calificacion = Math.min(5, estrellas);
  o.comentario = comentario;
  // Revisada una hora después de terminar (para que el historial tenga un orden realista).
  o.revisadaEn = o.actualizadaEn = iso(minutos(fin, 60));
}
