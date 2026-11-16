@AGENTS.md

# App de Tareas Familiares — Especificación para Claude

Fuente: *App de Tareas Familiares — Documento funcional por módulos* (16 nov 2026, @SheffMike).
Este archivo es la referencia de producto y técnica. Si el código y este documento no coinciden, pregunta antes de cambiar cualquiera de los dos.

## Resumen

La app conecta a padres e hijos dentro de una familia: los padres asignan tareas y rutinas, los hijos las inician y finalizan, y cada cambio de estado notifica a la otra parte. Un login común lleva a dos experiencias separadas por rol (Padre / Hijo).

| Bloque del boceto | Rol | Módulo | Ruta (Expo Router) |
|---|---|---|---|
| Pantalla 1 | Ambos | M1 Acceso y registro | `src/app/(auth)/` |
| Fila superior, pantalla 2 | Padre | M2 Inicio: hijos y tareas completadas | `src/app/(padre)/(tabs)/inicio`, `(padre)/hijo/[id]`, `(padre)/revisar/[id]` |
| Fila superior, pantalla 3 | Padre | M3 Tareas, hijos y alertas | `src/app/(padre)/(tabs)/gestion`, `(padre)/editar/[id]` |
| Fila superior, pantalla 4 | Padre | M4 Familia y suscripción | `src/app/(padre)/(tabs)/familia` |
| Fila inferior, pantalla 1 | Hijo | M5 Mis tareas y progreso | `src/app/(hijo)/(tabs)/tareas`, `(hijo)/tarea/[id]` |
| Fila inferior, pantalla 2 | Hijo | M6 Propuestas y justificaciones | `src/app/(hijo)/(tabs)/propuestas` |
| Sin pantalla propia | Ambos | M7 Notificaciones y recordatorios | `src/notifications/`, `src/app/avisos` (bandeja 🔔) |

## Forma de trabajo

- Se construye **un módulo a la vez**. Al terminar un módulo: typecheck + lint, se prueba en Android (Expo Go) y se pide confirmación al usuario antes de pasar al siguiente.
- Marca el avance en la sección [Estado de implementación](#estado-de-implementación) al cerrar cada módulo.
- Todo el texto visible de la app va en **español (México)**. Nombres de dominio en código también en español (`tarea`, `ocurrencia`, `familia`) para que coincidan con este documento.

## Stack

- **App:** React Native con Expo (SDK 58), TypeScript estricto, Expo Router (rutas en `src/app/`), Expo Notifications.
- **Datos (fase actual):** almacenamiento local en el teléfono (`@react-native-async-storage/async-storage`) detrás de una capa de servicios en `src/data/`. Las pantallas **nunca** leen AsyncStorage directo: llaman a los servicios, para poder cambiar a Supabase sin tocar la UI.
- **Backend (destino):** Supabase (Postgres, Auth, RLS por `familia_id`, Edge Functions y cron para recordatorios). Alternativa: Firebase.
- **Archivos:** storage del backend para avatares y fotos de evidencia.
- **Pagos:** compras integradas de App Store y Google Play con RevenueCat (requiere development build, no Expo Go).
- **Hash de PIN / contraseña local:** `expo-crypto` (SHA-256 con sal). En Supabase la contraseña del padre la maneja Auth.

### Estructura de carpetas

```
src/
  app/                 rutas (solo pantallas y layouts)
    (auth)/            M1
    (padre)/           stack del padre
      (tabs)/          pestañas: inicio (M2), gestion (M3), familia (M4)
      hijo/[id]        detalle del hijo (M2)
      revisar/[id]     aprobar / rechazar / calificar (M2, modal)
      editar/[id]      nueva (`id=nueva`, `?hijo=`) o editar / cancelar tarea (M3)
      suscripcion      planes, suscribirse, cancelar, restaurar (M4)
    (hijo)/            stack del hijo
      (tabs)/          pestañas: tareas (M5), propuestas (M6)
      tarea/[id]       detalle de una ocurrencia con Iniciar / Finalizar (M5; destino del deep link de M7)
  components/          UI reutilizable (Boton, Campo, Tarjeta, Avatar…)
    formulario.tsx     selectores de fecha, hora (− / +), días, interruptores
    gestion/           secciones de la pestaña Gestión: Tareas, Hijos, Alertas
  data/
    tipos.ts           entidades del modelo de datos
    db.ts              persistencia local (AsyncStorage): leer / modificar / ajustar / suscribir
    estados.ts         máquina de estados de la ocurrencia (único lugar que cambia `estado`)
    fechas.ts          días locales `YYYY-MM-DD`, semanas, formato es-MX
    useConsulta.ts     hook: consulta + recarga al cambiar datos o al enfocar
    planes.ts          límites, precios y beneficios de Gratis / Premium (provisionales)
    fotos.ts           elegir foto (galería / cámara) y guardarla en documentos de la app
    servicios/         auth, familia, invitaciones, tareas, estadisticas, alertas, suscripciones, hijo, propuestas, avisos, demo (solo dev)
  hooks/               useAhora (reloj que re-renderiza)
  session/             contexto de sesión y redirección por rol
  notifications/       M7: entrega.ts (avisos y recordatorios locales), Avisos.tsx (montado en la raíz)
  theme/               colores, espaciado, tipografía
```

### Comandos

```bash
npm install
npx expo start            # escanear el QR con Expo Go en Android
npx tsc --noEmit
npx expo lint
```

## Modelo de datos

| Entidad | Campos clave |
|---|---|
| Familia | id, nombre, foto, plan, alertas (config de M3) |
| Usuario | id, familia_id, rol (`padre` / `hijo`), nombre, avatar, pin_hash, push_token, estado (`pendiente` / `activo` / `rechazado` / `desvinculado`) |
| Invitación | código, familia_id, rol, expira, usada |
| Tarea | id, familia_id, título, categoría, asignado_a, hora_inicio, hora_límite, repetición (regla tipo RRULE), recordatorio_min, requiere_foto, puntos, notas, origen (`padre` / `propuesta`), creada_por, creada_en, cancelada |
| Ocurrencia | tarea_id, fecha, dia_origen (si se reprogramó), inicio_programado, limite_programado, estado, iniciada_en, finalizada_en, calificación, comentario, motivo_rechazo, motivo_propuesta, justificación, justificacion_foto_url, evidencia_url, revisada_en, actualizada_en |
| Notificación | usuario_id, tipo, ocurrencia_id, titulo, cuerpo, url (deep link), programada_para, enviada_en, leída |
| Suscripción | familia_id, plan, tienda, vence, periodo (`mensual` / `anual`), renovacion_automatica, simulada |

- Una **rutina** es una sola Tarea con repetición; cada día genera una **Ocurrencia** con su propio estado. Historial y dashboards salen de la tabla de ocurrencias.
- Al asignar una tarea a varios hijos se guarda **una Tarea por hijo**.
- Del hijo (menor) se guardan los datos mínimos: sin correo ni teléfono.
- Las ocurrencias se generan de forma perezosa (`sincronizar` en `servicios/tareas.ts`): al consultar se crean las que falten hasta hoy y las `programada` cuya hora límite ya pasó pasan a `atrasada`. En Supabase esto lo hará un cron.
- La ocurrencia guarda su propio `inicio_programado` / `limite_programado` para que reprogramar un día no cambie la rutina.

## Estados de una tarea (ocurrencia)

Una tarea solo se cierra cuando el padre la aprueba. Cada transición dispara una notificación de M7.

```
Propuesta ──padre aprueba──▶ Programada ──hijo inicia──▶ Iniciada ──hijo finaliza──▶ Finalizada ──padre aprueba──▶ Aprobada (1–5 ★)
                                 │                          ▲                            │                            ▲
                             pasa la hora              inicia tarde                padre rechaza               padre acepta
                                 ▼                          │                            ▼                            │
                              Atrasada ─────────────────────┘                        Rechazada                   Justificada
                                 │                                                       │                            ▲
                                 └──────────────────────── hijo justifica ──────────────┴────────────────────────────┘
```

Estados (8): `propuesta`, `programada`, `iniciada`, `finalizada`, `aprobada`, `atrasada`, `rechazada`, `justificada`.
Desde `justificada` el padre: acepta (→ `aprobada`), mantiene el rechazo (→ `rechazada`, sin nueva justificación) o reprograma (→ `programada` con nueva fecha).
La lógica de transiciones vive en un solo lugar (`src/data/estados.ts`) y valida quién puede hacer cada cambio.

---

## Módulo 1 — Acceso y registro (Login)

El padre crea la cuenta y la familia; el hijo solo entra por invitación de un padre y queda pendiente hasta que éste lo aprueba.

### Flujos
1. **Registro de padre:** nombre, correo o teléfono y contraseña (o Google / Apple). Al terminar se crea la familia.
2. **Invitación de hijo:** desde M3 el padre genera un código de 6 dígitos, enlace o QR con vigencia de 48 h.
3. **Registro supervisado del hijo:** abre la app, elige "Soy hijo/a", captura el código, escribe nombre o apodo, elige avatar y crea un PIN de 4 dígitos. Queda en estado *Pendiente*.
4. **Aprobación:** el padre recibe aviso, revisa los datos y aprueba o rechaza. Solo aprobado el hijo ve sus tareas.
5. **Inicio de sesión:** padre con correo y contraseña; hijo con usuario y PIN en un dispositivo ya vinculado. La app redirige según el rol.
6. **Recuperar acceso:** el padre por correo; el PIN del hijo lo restablece el padre desde M3.

### Pantalla
| Elemento | Detalle |
|---|---|
| Selector de rol | "Soy padre/madre" · "Soy hijo/a" |
| Formulario padre | Correo o teléfono, contraseña, botones Google / Apple, "Crear cuenta" |
| Formulario hijo | Código de invitación (primera vez) o usuario + PIN |
| Enlaces | "Olvidé mi contraseña", aviso de privacidad |

### Reglas
- Un hijo pertenece a una sola familia. Un segundo padre o madre se invita igual que un hijo, con rol *Padre* (se registra con correo y contraseña usando el código).
- Al hijo no se le piden correo ni teléfono.
- La sesión queda abierta en el dispositivo; el padre puede cerrar la sesión de un hijo a distancia (`sesion_version` en el usuario: si cambia, la sesión del hijo se invalida).
- El código de invitación es de un solo uso y expira a las 48 h.

### Notas de implementación (modo local)
- Google / Apple y la recuperación por correo se muestran pero quedan "disponibles al conectar Supabase".
- Para que M1 sea probable antes de M3, la pestaña Gestión del padre incluye desde ya: generar invitación, aprobar/rechazar pendientes, restablecer PIN y cerrar sesión de un hijo. M3 la amplía.

---

## Módulo 2 — Padre: Inicio (hijos y tareas completadas)

La pantalla de inicio del padre muestra de un vistazo qué hijo va al día y qué tareas esperan su revisión.

| Elemento | Contenido | Acciones |
|---|---|---|
| Hijos | Tarjeta por hijo: avatar, tareas del día hechas / total, tarea en curso, racha de días | Abrir el detalle del hijo |
| Dashboard de tareas completadas | Cumplimiento por día y semana, por hijo y por categoría (doméstica / escolar), a tiempo vs. tarde | Cambiar periodo y filtro |
| Por revisar | Tareas finalizadas esperando aprobación, propuestas de hijos y justificaciones nuevas | Aprobar, rechazar con motivo, calificar de 1 a 5 estrellas |
| Barra inferior | Inicio · Gestión (M3) · Familia (M4) | Navegar |

- **Detalle del hijo:** agenda del día con el estado de cada tarea, historial, calificación promedio y botón para asignarle una tarea.
- La calificación que el padre da al aprobar alimenta el dashboard de satisfacción del hijo (M5).
- **Racha:** días consecutivos con todas las ocurrencias del día aprobadas o finalizadas. Hoy cuenta solo si ya terminó todo; los días sin tareas no rompen la racha.
- **A tiempo:** `finalizada_en <= limite_programado`.
- **Hechas** = `finalizada` o `aprobada`. Las propuestas no cuentan en la agenda ni en el dashboard.
- Aprobar exige 1–5 estrellas (comentario opcional); rechazar exige motivo. Desde *Justificada*: aceptar (con estrellas) o mantener el rechazo; reprogramar llega con M6.

### Datos de prueba (solo desarrollo)
En Familia › 🛠 Solo desarrollo (visible solo con `__DEV__`): **Cargar datos de prueba** crea 2 hijos (Ana y Leo, PIN 1234) si no hay, 4 rutinas con 14 días de historial, una tarea por revisar, una en curso, una propuesta y una justificación. **Borrar todos los datos** limpia el teléfono.

---

## Módulo 3 — Padre: Tareas, hijos y alertas

Pantalla de trabajo del padre: crea tareas y rutinas, administra a los hijos y decide cuándo suenan los recordatorios.

### Agregar tareas y rutinas
| Campo | Tipo | Notas |
|---|---|---|
| Título | Texto | "Lavar trastes", "Tarea de matemáticas" |
| Categoría | Doméstica / Escolar | Filtra dashboards |
| Asignado a | Uno o varios hijos | Una tarea por hijo al guardar |
| Fecha y hora de inicio | Fecha + hora | Base del recordatorio de 10 min |
| Hora límite o duración | Hora / minutos | Después de ella la tarea queda *Atrasada* |
| Repetición | Una vez, diaria, días de la semana | Con repetición es una **rutina** |
| Requiere evidencia | Sí / No | Foto al finalizar |
| Puntos | Número (opcional) | Para recompensas |
| Notas | Texto | Instrucciones para el hijo |

Al guardar, el hijo recibe una notificación de tarea nueva (M7). Editar o cancelar una tarea también le avisa.

### Agregar hijos
- Generar invitación (código, enlace o QR) y ver invitaciones vigentes.
- Aprobar o rechazar hijos pendientes.
- Editar nombre, avatar; restablecer PIN; desvincular a un hijo.

### Reglas de implementación
- Gestión tiene tres secciones (chips): **Tareas**, **Hijos** y **Alertas**. Con solicitudes pendientes abre en Hijos.
- Hora de inicio: selector − / + (horas de 1 en 1, minutos de 5 en 5) que funciona igual en Android, iOS y web. Duración: 15 min a 2 h; la hora límite = inicio + duración.
- Una tarea "una vez" cuya hora límite ya pasó no se puede crear. Una rutina nueva cuyo horario de hoy ya terminó empieza mañana.
- Editar: cambia la tarea y regenera solo lo que no ha empezado (en rutinas se conserva el pasado y la de hoy si ya está atrasada). Una tarea "una vez" ya iniciada no se puede editar. No se cambia a quién está asignada.
- Cancelar: la tarea deja de generar ocurrencias y se quitan las pendientes; el historial se conserva.
- Desvincular a un hijo: estado `desvinculado`, se cierra su sesión, se cancelan sus tareas y se quitan sus pendientes; el historial se conserva. Para volver necesita una invitación nueva.
- QR de invitación: codifica el enlace `…/hijo-codigo?codigo=XXXXXX` (con `expo-linking`, en Expo Go es `exp://…`). Librería `react-native-qrcode-svg`.
- Límites del plan en `src/data/planes.ts` (provisional: Gratis 3 hijos y 10 rutinas). Se valida al invitar/aprobar hijos y al crear rutinas.
- Las alertas se guardan al instante en `familia.alertas`; M7 las aplica (`enSilencio()` ya existe en `servicios/alertas.ts`).

### Programar alertas
| Alerta | Valor por defecto | Configurable |
|---|---|---|
| Recordatorio al hijo antes de iniciar | 10 min antes | 5, 10, 15 o 30 min, por tarea o general |
| Aviso al padre si no se inició | 10 min después de la hora de inicio | Activar / desactivar, minutos |
| Aviso al padre al iniciar y al finalizar | Activado | Por hijo |
| Horario silencioso | 21:00 a 7:00 | Rango de horas |
| Resumen diario al padre | 20:00 | Hora o apagado |

---

## Módulo 4 — Padre: Familia y suscripción

| Sección | Contenido |
|---|---|
| Nombre de la familia | Nombre y foto que ven todos los miembros |
| Miembros | Padres e hijos con su rol; invitar a otro padre o madre |
| Suscripciones | Plan actual, beneficios, fecha de renovación, cambiar o cancelar plan, restaurar compras |
| Cuenta | Datos del padre, idioma, cerrar sesión, eliminar cuenta y familia |

- **Planes:** Gratis (número limitado de hijos y rutinas) y Premium (hijos y rutinas ilimitados, evidencia con foto, estadísticas completas).
- Cobro vía compras integradas de App Store / Google Play con RevenueCat.
- ⚠️ Pendiente de definir: límites del plan Gratis y precio de Premium. Mientras tanto viven en `src/data/planes.ts` (provisional: Gratis 3 hijos / 10 rutinas; Premium $49 MXN al mes o $449 MXN al año).

### Reglas de implementación
- **Foto de la familia:** galería o cámara (`expo-image-picker`, recorte cuadrado). En modo local se copia a `Paths.document/fotos` (`expo-file-system`); en web se guarda como data URL. Con Supabase se subirá a Storage.
- **Suscripción simulada:** Expo Go no tiene compras integradas. `servicios/suscripciones.ts` simula la tienda (marca `simulada: true` y la UI muestra "Compra de prueba (sin cobro)"). Al pasar a development build se reemplaza por RevenueCat (`purchasePackage`, `restorePurchases`) sin cambiar la UI.
- **Cancelar:** apaga la renovación; sigue en Premium hasta `vence` y después vuelve a Gratis (se revisa al leer la suscripción). Con renovación activa, al vencer se extiende un periodo.
- **Bajar a Gratis** no borra nada: si hay más hijos o rutinas que el límite, solo se bloquean las altas nuevas.
- **Eliminar cuenta:** pide escribir "ELIMINAR". Si hay otro padre activo, solo sale de la familia; si es el último padre, se borra la familia completa (hijos, tareas, ocurrencias, invitaciones, suscripción).
- **Idioma:** por ahora solo Español (México).
- En desarrollo, Suscripción tiene "🛠 Simular fin del periodo" para probar la renovación y el regreso a Gratis.

---

## Módulo 5 — Hijo: Mis tareas y progreso

El hijo ve primero lo que tiene que hacer hoy, con un solo botón por tarea que pasa de *Iniciar* a *Finalizar*.

| Elemento | Contenido | Acciones |
|---|---|---|
| Tareas por completar | Tareas del día por hora, agrupadas en Ahora, Más tarde y Atrasadas; icono de doméstica o escolar | **Iniciar** (activo desde 10 min antes), **Finalizar**, adjuntar foto si se pide |
| Dashboard de satisfacción de los padres | Promedio de estrellas de la semana, últimas calificaciones y comentarios del padre | Ver detalle por tarea |
| Dashboard de tareas completadas | Historial por día, racha, puntos acumulados, % a tiempo | Cambiar semana |

### Reglas
- Iniciar registra la hora real de inicio y avisa al padre; Finalizar registra la hora de fin y manda la tarea a *Por revisar* del padre.
- Si se pidió evidencia, Finalizar no se activa sin foto.
- El hijo no puede editar ni borrar tareas asignadas por el padre.

### Reglas de implementación
- **Hoy:** tareas del día agrupadas en ⏰ Ahora (en curso o ya se pueden iniciar), ⚠️ Atrasadas, 🕒 Más tarde y 🎉 Hechas hoy. La pantalla se refresca cada 30 s (`useAhora`) para activar botones y pasar tareas a atrasadas.
- **Iniciar** se activa `MINUTOS_ANTES_PARA_INICIAR` (10) antes de la hora; antes muestra "Disponible a las …". Una atrasada de hoy se puede "Iniciar tarde"; las de días anteriores se justifican en M6.
- **Evidencia:** si la tarea pide foto, después de Iniciar aparece "Agregar foto de evidencia" (cámara o galería); se guarda en la ocurrencia (`evidenciaUrl`) y Finalizar no se activa hasta tenerla. El padre la ve en Revisar.
- **Mi progreso (por semana):** satisfacción (promedio de estrellas, últimas revisiones con comentario o motivo) y tareas completadas (racha, puntos acumulados y de la semana, hechas/total, % a tiempo, barras por día).
- Ruta del padre para el formulario renombrada a `/editar/[id]` para dejar `/tarea/[id]` al hijo (deep link de M7).

---

## Módulo 6 — Hijo: Proponer tareas y justificaciones

El hijo puede sugerir tareas y responder cuando el padre rechaza algo; el padre siempre tiene la última palabra.

### Proponer tareas
- Formulario corto: título, categoría, fecha y hora sugeridas, motivo.
- La propuesta llega a *Por revisar* del padre (M2). Aprobada, se convierte en una tarea normal con recordatorios; rechazada, el hijo ve el motivo.

### Justificación de tareas no aprobadas
- Lista de lo que el padre no aprobó: propuestas rechazadas, tareas finalizadas que el padre rechazó y tareas que vencieron sin iniciarse.
- Cada una muestra el motivo del padre y un campo para que el hijo responda **una vez**, con texto y foto opcional.
- La justificación vuelve a *Por revisar*; el padre aprueba, mantiene el rechazo o reprograma la tarea.
- ⚠️ Pendiente de confirmar: si la "justificación" la escribe el hijo (como se plantea aquí) o el padre al rechazar. **Implementado como dice el documento: la escribe el hijo.**

### Reglas de implementación
- La pestaña Propuestas del hijo tiene dos secciones: **💡 Proponer** y **💬 Explicar (n)**; abre en Explicar si hay pendientes y la pestaña muestra una insignia con ese número.
- **Proponer:** título, tipo (casa / escuela), día (próximos 14), hora, duración (15 / 30 / 60 min) y motivo. Se guarda como Tarea `origen: propuesta` con una ocurrencia en estado `propuesta`. "Mis propuestas" muestra Esperando / Aprobada / No aprobada (con el motivo del padre).
- **Explicar:** lista lo rechazado (propuestas y tareas) y lo atrasado sin justificar. Cada uno se responde **una vez** con texto (3–300) y foto opcional → estado `justificada` (aparece en Por revisar del padre). Si la atrasada es de hoy, también ofrece "Mejor la hago ahora".
- **Padre ante una justificación** (Revisar): según el caso
  - tarea terminada y rechazada → aceptar con estrellas;
  - tarea no iniciada → "Aceptar la explicación" (queda aprobada sin estrellas);
  - propuesta rechazada → "Aceptar y programarla" (elige día y hora);
  - siempre: **Reprogramar** (nuevo día y hora, misma duración; se borra el intento anterior para que el hijo la vuelva a hacer) o **Mantener el rechazo** (con motivo; ya no se puede volver a justificar).
- Reprogramar guarda `dia_origen` para que la rutina no vuelva a generar ese día; editar la rutina respeta las ocurrencias reprogramadas.

---

## Módulo 7 — Notificaciones y recordatorios

Cada cambio de estado de una tarea avisa a la otra parte; el recordatorio de 10 minutos antes lleva al hijo a entrar y confirmar que empieza.

| Evento | Recibe | Ejemplo de mensaje | Momento |
|---|---|---|---|
| Padre crea o edita tarea | Hijo | "Nueva tarea: Lavar trastes, hoy 6:00 pm" | Al guardar |
| Faltan 10 min | Hijo | "En 10 min: Tarea de matemáticas. Entra y confírmala como iniciada" | Inicio − 10 min |
| Hijo inicia | Padre | "Ana inició Lavar trastes" | Al instante |
| No se inició a tiempo | Hijo y padre | "Lavar trastes aún no se inicia" | Inicio + 10 min |
| Hijo finaliza | Padre | "Ana terminó Lavar trastes. Revísala" | Al instante |
| Padre aprueba o rechaza | Hijo | "Tu tarea fue aprobada ★★★★" / "Revisa el motivo" | Al instante |
| Hijo propone o justifica | Padre | "Ana propuso: Ordenar el cuarto" | Al instante |

- **Implementación:** push remotas (FCM en Android, APNs en iOS) vía Expo Notifications. El recordatorio de 10 min se programa en el servidor y, como respaldo sin internet, también como notificación local en el teléfono del hijo.
- Tocar cualquier aviso abre la tarea por deep link (`tareasfamiliares://tarea/<ocurrenciaId>`), donde está el botón Iniciar o Finalizar.
- Respetar el horario silencioso de M3.
- Modo local / Expo Go: solo notificaciones **locales** (las push remotas en Android requieren development build).

### Reglas de implementación
- **Registro (lado "servidor"):** `servicios/avisos.ts` → `avisarHijo` / `avisarPadres` dejan una Notificación en cada transición: tarea nueva / editada / cancelada, inició, terminó, aprobada (con estrellas) / rechazada, propuesta aprobada, aceptaron tu explicación, reprogramada, propuso, explicó. Los de inicio y fin respetan "Aviso al padre al iniciar y al finalizar" por hijo. Con Supabase, una Edge Function los enviará como push.
- **Entrega local (`notifications/entrega.ts`):** el componente `<Avisos />` (en `app/_layout.tsx`) pide permiso al iniciar sesión, y cada vez que cambian los datos (y cada minuto):
  - muestra como notificación local los avisos pendientes de las **cuentas de este teléfono** (`dispositivo.cuentas` = quien ha iniciado sesión aquí + hijos vinculados) y los marca `enviada_en`; los de más de 2 h o en horario silencioso no suenan (quedan en la bandeja);
  - reprograma los recordatorios locales de las próximas 26 h: **faltan N min** (N = `recordatorio_min` de la tarea) al hijo, **aún no se inicia** (inicio + minutos de M3) al hijo y al padre, y **resumen diario** al padre con "Ana 3/5 · Leo 4/4". Ninguno se programa dentro del horario silencioso.
- **Deep link:** cada aviso lleva `url` (hijo: `/tarea/<ocurrencia>`; padre: `/revisar/<ocurrencia>` o `/hijo/<id>`). `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync` hacen `router.push(url)`. ⚠️ En Expo Go (Android) tocar la notificación del sistema no regresa a la app (Expo Go abre su LauncherActivity); se debe verificar en development build. Mientras tanto, la **bandeja 🔔 Avisos** (encabezado de padre e hijo) lista los avisos, marca leídos y abre el mismo `url`.
- **Canales Android:** se intentan crear `avisos` y `recordatorios`; en Expo Go falla (NPE nativo) y se usa el canal por defecto.

---

## Fases de entrega

1. **MVP:** M1 completo, M3 con tareas de una vez y alta de hijos, M5 con Iniciar / Finalizar, M7 con aviso de tarea nueva, recordatorio de 10 min y aviso de finalizada.
2. **Rutinas y revisión:** repetición, alertas configurables, aprobar / rechazar con calificación, dashboards de M2 y M5.
3. **Participación del hijo:** M6 completo y evidencia con foto.
4. **Monetización y lanzamiento:** M4 con suscripciones y publicación en tiendas.

## Pendientes de producto

- [ ] Definir límites del plan Gratis y precio de Premium.
- [ ] Confirmar si la justificación la escribe el hijo o el padre al rechazar (implementado: el hijo).

## Estado de implementación

- [x] M1 Acceso y registro — implementado (modo local). Probado en web y en emulador Android: registro padre, invitación, registro hijo pendiente, aprobación, restablecer PIN, login hijo, rutas protegidas. Google/Apple y correo de recuperación esperan a Supabase. QR de invitación llega con M3.
- [x] M2 Inicio del padre — implementado: Por revisar (aprobar con estrellas, rechazar con motivo, propuestas, justificaciones), tarjetas por hijo (hoy, en curso, atrasadas, racha), dashboard Día/Semana con filtros por hijo y categoría, detalle del hijo (agenda, historial, promedio, puntos). Probado en web y en emulador Android. "Asignar tarea" desde el detalle se conecta en M3.
- [x] M3 Tareas, hijos y alertas — implementado: crear tarea o rutina para uno o varios hijos (una por hijo), editar, cancelar; invitar con código/enlace/QR, aprobar/rechazar, editar nombre y avatar, restablecer PIN, cerrar sesión, desvincular; configuración de alertas. Probado en web y emulador Android. Las notificaciones al guardar/editar/cancelar llegan con M7.
- [x] M4 Familia y suscripción — implementado: nombre y foto de la familia, miembros e invitar a otro padre, suscripción simulada (mensual/anual, cancelar, reactivar, restaurar, vencimiento), editar cuenta, cerrar sesión, eliminar cuenta (o salir si hay otro padre). Probado en web y emulador Android. Pendiente para tiendas: RevenueCat con development build.
- [x] M5 Mis tareas y progreso (hijo) — implementado: agenda de hoy por grupos, Iniciar / Finalizar con evidencia obligatoria, detalle de tarea, progreso semanal (satisfacción y completadas). Probado en web y emulador Android de punta a punta (hijo inicia → foto → finaliza → padre aprueba 5★ → aparece en Mi progreso). Los avisos al padre al iniciar/finalizar llegan con M7.
- [x] M6 Propuestas y justificaciones — implementado: proponer tareas, mis propuestas, explicar lo no aprobado (una vez, con foto opcional), y del lado del padre aceptar / reprogramar / mantener el rechazo. Probado en web (ciclo completo) y emulador Android (pestaña y envío de explicación). Los avisos llegan con M7.
- [x] M7 Notificaciones y recordatorios — implementado en modo local: avisos de cada cambio de estado, recordatorios programados (faltan N min, no iniciada, resumen diario), horario silencioso, bandeja 🔔 con enlace a la tarea. Probado en emulador Android: avisos "Ana inició…" y "Nueva tarea…" mostrados, 39 recordatorios programados, bandeja abre el detalle. Pendiente: push remotas (Supabase + development build) y verificar el toque en la notificación del sistema fuera de Expo Go.
- [ ] Migración de la capa de datos a Supabase
