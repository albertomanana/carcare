# Informe frontend-react (particular y componentes comunes) · 26/10/2026

Encargo de la sesión principal del 26/10: terminar lo que quedó a medias antes de empezar nada nuevo. Cuatro bloques, en orden: tarea 28 (recuperar la contraseña), tarea 27 (origen de cada lectura de km), tarea 16 paso 2 en el particular y tarea 26.

Instancia aislada: API `:8020` y web `:5181` (26/10); API `:8060` y web `:5185` (27 y 28/10; el 28/10 contra una SQLite con la demo, ver bloque 3). Capturas y scripts en `C:\Users\Alberto\AppData\Local\Temp\fe-particular\`.

**Estado al cerrar (28/10):** los 4 bloques hechos y probados. Typecheck, lint (0 errores), test (71/71) y build en verde. Queda del plan 5.2: el alto del Resumen a 1280 y el gráfico de km en el Historial (ver Limitaciones).

---

## Bloque 1 · Tarea 28, recuperar la contraseña

**Estado: hecho y probado contra la API real** (petición 7 del tablero).

### Qué hice
- **`/recuperar`** (`features/auth/ForgotPasswordPage.tsx`): pide el email, normaliza (minúsculas y sin espacios), llama a `ensureCsrfCookie()` y a `POST /auth/forgot-password`. Con 204 muestra **siempre** el texto del contrato: "Si hay una cuenta con ese email, te hemos enviado un enlace…". Debajo, "pídelo otra vez" (vuelve al formulario) y el aviso de que solo vale el último enlace. Acepta `?email=` para rellenar el campo (lo usa "Pedir un enlace nuevo").
- **`/restablecer?token=…&email=…`** (`ResetPasswordPage.tsx`): cuenta (solo lectura, `autocomplete="username"` para los gestores de contraseñas), contraseña nueva y su confirmación (8–255, iguales; validación con Zod). Con 204 navega a `/entrar` con el aviso "Contraseña cambiada. Entra con la nueva; hemos cerrado las sesiones abiertas." (`location.state`, no se guarda nada).
  - Sin `token` o sin `email`: no hay formulario; explica que el enlace está incompleto y ofrece "Pedir un enlace nuevo".
  - 422 en `errors.token` o `errors.email`: el mensaje de la API con el enlace "Pedir un enlace nuevo" (lleva el email).
  - 422 en `errors.password`: en su campo.
- **429** en las dos pantallas (y en entrar): mensaje de la API y botón bloqueado con la cuenta atrás. Los segundos salen de la cabecera **`Retry-After`**, que ahora lee el cliente HTTP (`ApiError.retryAfter`); si no llega, 60 s. La cuenta atrás está en `features/auth/useLockout.ts`, compartida con entrar.
- **Rutas** `GuestOnly` en `app/router.tsx` (con sesión redirigen a la app), cada una en su propio *chunk*.
- **Entrar:** enlace "¿Has olvidado tu contraseña?" junto a la etiqueta del campo de contraseña (`labelAside`), y el aviso de éxito con `role="status"`.
- **De paso, 5.5 "Entrar / Registro"** (son los mismos archivos): `AuthLayout` pasa a una columna centrada; se quitan el panel de marca (retícula, mancha de luz `blur-[120px]`, lema en mayúsculas, 4 baldosas con icono) y "Tu garaje y tu taller te esperan". En el registro, el tipo de cuenta ya no lleva baldosa de icono ni relleno de acento (una sola acción primaria: "Crear cuenta"). Las cuentas demo se quedan (solo en desarrollo) sin iconos.
- El token no se guarda en `localStorage` ni se escribe en la consola.

### Evidencias (instancia :8020/:5181, script `fe-particular/b1.mjs`)
Para no cerrar las sesiones de nadie (restablecer cierra **todas** las de la cuenta y la BD es compartida), la prueba no usa `demo@`: crea una cuenta propia con el registro y la borra al final.

```
registro ok http://localhost:5181/app/6
entrar 1280 {"sw":1280,"vw":1280}         recuperar 1280 {"sw":1280,"vw":1280}
entrar 360  {"sw":360,"vw":360}           recuperar 360  {"sw":360,"vw":360}
vacío: Escribe tu email.
mismo aviso con y sin cuenta: true | Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 60 minutos.
enlaces en el log para la cuenta: 6 restablecer?token=fa40bdd5f5dd8800faa5f7…   (laravel.log; texto y HTML del mismo correo)
asunto: Subject: Crea una =?utf-8?Q?contrase=C3=B1a?= nueva para CarCare
sin token: El enlace está incompleto
no coinciden: Las dos contraseñas no coinciden.
token malo: El enlace para cambiar la contraseña no es válido o ha caducado. Pide uno nuevo. Pedir un enlace nuevo
restablecer 360 {"sw":360,"vw":360}
aviso en entrar: Contraseña cambiada. Entra con la nueva; hemos cerrado las sesiones abiertas.
entra con la nueva: http://localhost:5181/app/6
token reutilizado: 422
cuenta de prueba borrada: 204
429 en la petición 6 : Demasiados intentos. Espera un momento e inténtalo de nuevo. | Podrás volver a intentarlo en 29 s.
botón: Espera 29 s
```

- El enlace se copió de `backend/storage/logs/laravel.log` y se abrió en `:5181` (el correo apunta a `FRONTEND_URL`, que por defecto es `:5173`).
- Capturas: `b1-entrar-{1280,360}.png`, `b1-recuperar-{1280,360}.png`, `b1-recuperar-enviado-1280.png`, `b1-restablecer-360.png`, `b1-restablecer-incompleto-360.png`, `b1-restablecer-token-malo-360.png`, `b1-entrar-aviso-360.png`, `b1-recuperar-429-360.png`, `b1-registro-1280.png`.
- `npm run typecheck` sin errores; `npm run lint` sale con 0 (72 avisos previos; ninguno nuevo en `features/auth`, salvo el `watch` de RHF que ya estaba).

### Archivos (bloque 1)
`api/client.ts` (`retryAfter`), `api/hooks/auth.ts` (`useForgotPassword`, `useResetPassword`), `app/router.tsx`, `features/auth/{AuthLayout,LoginPage,RegisterPage,ForgotPasswordPage,ResetPasswordPage,useLockout}.tsx|ts`.

---

## Bloque 2 · Tarea 27, origen de cada lectura de km

**Estado: hecho y probado contra la API real** (petición 6 del tablero).

### Qué hice
- `lib/mileage.ts` → `mileageSourceLink(log, vehicleBase, wsBase)`: enlaza solo si `source_id` no es null y el origen es `maintenance`, `expense`, `reminder` o `work_order` (regla 5 del §3.4.1). Con `manual`, `vehicle_created` o `source_id = null` (gastos para el mecánico) devuelve null y el origen se muestra como texto. 3 tests en `lib/mileage.test.ts`.

| Origen | Destino |
|--------|---------|
| Intervención | `historial?ver=intervenciones#intervencion-{id}`. Si no está en la lista cargada se piden más páginas; si tampoco está (archivada o fuera de los filtros) se pide sola (`GET /maintenance/{id}`) y se muestra encima: "La intervención enlazada está archivada" |
| Gasto | `gastos?periodo={año de la lectura}#gasto-{id}`. La pestaña Gastos acepta ahora un año en `periodo` (este año y el pasado usan sus opciones; otro año añade "Año 2023" al selector) |
| Recordatorio | `recordatorios?estado=done#recordatorio-{id}` |
| Orden | `/app/{ws}/ordenes/{id}` |

- Cada enlace tiene un nombre accesible que empieza por el texto visible y dice a dónde va ("Gasto: ver en gastos", "Orden de trabajo: ver la orden"…), cumpliendo WCAG 2.5.3.
- `hooks/useHashTarget.ts`: lee `#prefijo-id`, pide páginas hasta encontrarlo, se desplaza hasta él y **le pasa el foco** (`tabIndex=-1`), para quien navega con teclado. El destino se resalta con un borde.
- En el móvil el origen va debajo de la fecha, también como enlace.

### Evidencias (scripts `fe-particular/b2.mjs` y `b2b.mjs`)
Con las cuentas demo (solo lectura):
```
[particular] vehículo 2 Kia Sportage: orígenes manual:null, expense, maintenance
  enlaces visibles: 6  (Gasto → gastos?periodo=2026#gasto-92 …, Intervención → historial?ver=intervenciones#intervencion-16)
  orígenes como texto: Lectura manual
  → gasto:        {"exists":true,"focused":true,"inView":true}
  → intervención: {"exists":true,"focused":true,"inView":true}
[taller]   vehículo 22 Kia Ceed: orígenes work_order, vehicle_created → 1 enlace a /app/3/ordenes/16 (abre "Revisión oficial"); "Alta del vehículo" como texto
[mecánico] igual que el taller (la orden sí la puede ver)
360: {"sw":360,"vw":360}
```
La demo no tiene lecturas de recordatorios, ni intervenciones archivadas con km, ni gastos de otro año. Para probarlos, `b2b.mjs` crea una cuenta propia, un vehículo y los tres datos por la API, sigue los enlaces y **borra la cuenta** al final:
```
lecturas: 2026-10-26 9500 reminder#21 | 2026-02-01 8000 maintenance#44 | 2025-03-01 5000 expense#217
  → Recordatorio completado: {"exists":true,"focused":true}
  → Intervención: {"exists":true,"focused":true,"pinned":"La intervención enlazada está archivada"}
  → Gasto: {"exists":true,"focused":true,"periodo":"Año pasado"}
cuenta borrada: 204
```
- No he podido probar el caso del mecánico con una lectura de gasto (`source_id = null`): la demo del taller no tiene lecturas `expense`. Lo cubre el test unitario.
- Capturas: `b2-lecturas-{particular,taller,mecánico}-1280.png`, `b2-lecturas-particular-360.png`, `b2-destino-*.png`.

### Archivos (bloque 2)
`lib/mileage.ts` y su test, `hooks/useHashTarget.ts`, `features/vehicle/tabs/{JournalTab,HistoryTab,ExpensesTab,RemindersTab}.tsx`, `components/vehicles/ReminderItem.tsx` (`id` y `highlighted`).

---

## Bloque 3 · Tarea 16, paso 2, en el modo particular

Retomado el 27/10 a las 17:45 (ejecución del piloto, instancia API `:8060` + web `:5185`). Las ejecuciones del 26/10 (14:22) y del 27/10 (10:55‑11:09) dejaron hecho en disco, sin informe:

- **Componentes comunes:** `Button`/`ButtonLink` reclaman la acción primaria (`ui/primary-action.ts`, R1); `Plate` como texto (R6); `StatCard` sin caja, icono ni mayúsculas; `CardHeader` sin icono; `PageHeader` sin `eyebrow` en mayúsculas; botón primario plano (R8); etiquetas de menú y paleta sin mayúsculas.
- **Navegación (5.6):** particular con barra superior y contenido a 1.100 px; taller con barra lateral de 220 px; móvil con 3 secciones + "Registrar" + "Más"; "Registrar" del móvil deja de ser primario si la pantalla ya tiene uno (R1); tema fuera de la barra; selector de espacio como texto.
- **Inicio (5.1):** global, una petición, sin 3D ni tarjetas de cifras; "Pendiente" (máx. 5), "Vehículos" en lista, "Gasto" con `Sparkbars` (HTML, sin Recharts) y "Último registrado" (3 filas).
- **Ficha (5.2):** cabecera corta sin miniatura, "Registrar ▾" + "⋯" (con "Informe imprimible"), 5 pestañas (6 en el taller, con "Más ▾" en el móvil); Resumen con Pendiente · Zonas · Kilometraje · Desde el último; `diario` y `documentos` redirigen a `historial` y `datos` (`LegacyTabRedirect.tsx`).
- **Petición 19:** `ZoneMap` abre en "Lista" por debajo de 640 px si no hay preferencia guardada.
- **Petición 10:** I2, I3 y C4 están en el commit `fa8f289`; M1 y M2 (`JournalTab`), M3 (`status.ts`: "Sin recordatorio"), M4 (`colors.ts`, `vehicleColorName`) y M6 (`brands.ts`, `COMMON_BRANDS`) ya estaban en disco.

**Lo que quedó roto al cortarse:** las rutas `diario` y `documentos` ya redirigían, pero `HistoryTab` no entendía `?ver=` (no enseñaba ni el día a día ni las lecturas de km) y `DataTab` no tenía los documentos. Es lo primero que arreglo.

Estado a las 17:55: inventario hecho; empiezo por Historial y Datos.

### Historial (Diario + Historial) y Datos (Documentos + Datos)
- **`tabs/HistoryTab.tsx`** pasa a ser el contenedor con el filtro `?ver=` **Todo · Intervenciones · Gastos · Kilometraje · Documentos** (control segmentado desde 768 px; selector nativo en el móvil para no esconder opciones en un scroll lateral, I4). "Gastos" solo sale a quien puede verlos. Al cambiar de vista se limpian los filtros de la anterior. Un enlace `#intervencion-12` sin `ver` abre las intervenciones.
  - **Todo / Gastos / Documentos** (`vehicle/history/JournalView.tsx`): el antiguo día a día, con periodo (30 días · 90 días · 12 meses, en `?periodo=`). Sin las 3 tarjetas de cifras (una línea: "4 días con actividad · 120 km recorridos · 85,40 € gastados"), sin mapa de calor, sin caja por día, sin píldoras ni baldosas de icono. Días con la primera letra en mayúscula (M1) y como `h2` (o `h3` bajo el año cuando la lista cruza de año, M2). Cada registro enlaza a su sitio (intervención, gasto con su año, documento, recordatorio hecho). Vacío con "Ver los últimos 12 meses" y "Anotar km".
  - **Intervenciones** (`history/RecordsView.tsx`): **encabezado por año** (tarea 26 c, E3‑3) y una fila por intervención: fecha · título · tipo · zona · km · taller · importe. El detalle se despliega al pulsar la fila (patrón acordeón: `h3 > button[aria-expanded]`); "Editar" y "Archivar/Restaurar" van en el menú "⋯" de la fila. Fuera las 3‑4 píldoras por tarjeta, el icono en círculo, la línea de tiempo y "Cuenta como gasto" ×N (pasa al detalle, enlazado al gasto).
  - **Kilometraje** (`history/MileageView.tsx`): la tabla de lecturas con su origen enlazado (bloque 2), sin caja.
- **`tabs/DataTab.tsx`**: 4 secciones con título y separador (sin las 4 cajas ni el texto "Datos tal como los guardaste…"), "Editar datos" como enlace y "Ver lecturas" → `historial?ver=km`. Debajo, **`vehicle/DocumentsSection.tsx`** (`#documentos`): lista nombre · tipo · fecha · tamaño, "Descargar" y menú "⋯" (Ver, Descargar, Eliminar con confirmación); píldora solo si caduca pronto o caducó (R5). Se quitan las miniaturas, que descargaban cada imagen (R12). Siguen `?tipo=`, `?intervencion=`, `?subir=1` y soltar un archivo encima.
- `tabs/JournalTab.tsx` y `tabs/DocumentsTab.tsx` **se borran**: su código pasó a los archivos anteriores (las rutas `diario` y `documentos` ya redirigían).
- Enlaces actualizados: el formulario de intervención ("Subir documentos" → `datos?subir=1&intervencion=…#documentos`) y el gasto vinculado (→ `historial?ver=intervenciones#…`).
- `api/hooks/records.ts`: `useMaintenanceList` acepta `enabled` (opcional, compatible): Datos solo pide los títulos de las intervenciones si algún documento está vinculado.
- `lib/history.ts` + `lib/history.test.ts` (8 tests): vista desde `?ver=`, filtro del diario, `groupByYear` y totales.

Estado a las 23:30: Historial y Datos hechos; `npm run typecheck` sin errores, Vitest de `src/lib` 38/38. Sigo con Resumen/Inicio (tarea 26) y Gastos/Recordatorios.

**Retomado el 28/10 a las 15:40** (piloto, instancia API `:8060` + web `:5185`). La ejecución de las 09:17 trabajó de 09:24 a ~09:59 y dejó en disco, sin commit ni informe:
- `lib/tabs.ts` + `tabs.test.ts`: `fitTabs` calcula cuántas pestañas caben y pasa el resto a "Más ▾" (I4).
- `VehicleDetailPage.tsx`: las pestañas miden su ancho real (fila invisible + `ResizeObserver`) y las que no caben van a "Más ▾", también en escritorio; el botón lleva el nombre de la pestaña activa si está escondida.
- `ui/Disclosure.tsx` (nuevo): bloque plegable con `aria-expanded`/`aria-controls` y un resumen gris de lo que hay dentro mientras está cerrado.
- `ui/Field.tsx`: `Fieldset` con la `<legend>` como primer hijo del `<fieldset>` (antes iba dentro de un `div` y el grupo se quedaba sin nombre accesible). Misma API, compatible con el taller.
- `MaintenanceFormPage.tsx` (5.5 "Nueva intervención"): sin cajas ni columna de resumen; secciones con título y separador: ¿Qué se hizo? (6 chips sin icono + título; tipo, zona y servicio en "Más detalles", que cerrado dice lo que rellenó el chip) · Cuándo y dónde (fecha, km con "Usar 54.000 km", taller con sugerencias) · Coste (solo "Total"; líneas, piezas y mano de obra en "Desglosar…", abierto si ya hay datos o un error dentro) · Notas · [Guardar intervención].

Comprobado al retomar: `npm run typecheck` sin errores. Un test de `fitTabs` estaba mal planteado (esperaba 4 con 355 px cuando las 5 suman 350 y caben); corregido el test, la función estaba bien.

**Inventario contra el plan (15:45).** Ya cumplen el plan en disco: Inicio (5.1), Resumen de la ficha (5.2, con "Primeros pasos" y "Kilometraje"), Historial, Datos, formulario de intervención (5.5), agenda, garaje, formulario de vehículo, ajustes y entrar/registro (5.5, commit 6f55463). Faltaban **Gastos** (seguía con la caja de "Por categoría", el filtro de categoría arriba aunque solo filtra la lista, sin el gráfico por mes que salió del Resumen y sin acción cuando falta un dato) y **Recordatorios** (lista plana y filtro de estado con scroll lateral a 360 px).

### Gastos y Recordatorios
- **`tabs/ExpensesTab.tsx`**: periodo arriba (afecta a todo) · 3 cifras sin caja (Total del periodo, Coste por km, Consumo medio; R2) · "Por mes" (las barras de 12 meses que estaban en el Resumen, 5.2) y "Por categoría", las dos sin caja (R3) y diciendo su ámbito ("12 meses hasta octubre de 2026, todas las categorías" / "En el periodo elegido", C3) · "Movimientos" con el filtro de categoría **junto a la lista**, que es lo único que filtra. Si la API dice `available: false`, la cifra muestra su `reason` y la acción que lo resuelve: "Anotar km" (coste por km) o "Añadir repostaje" (consumo). Esqueletos en forma de fila, vacío compacto con "Añadir gasto".
- **`tabs/RemindersTab.tsx`**: los pendientes van por grupos de urgencia como en la agenda: Vencidos · Próximos · En plazo ▸ · Sin datos ▸ (los dos últimos plegados, con `aria-expanded`; si un enlace `#recordatorio-{id}` apunta a uno plegado, empieza abierto). Filtro de estado: selector nativo en el móvil y control segmentado desde 640 px (antes, scroll lateral escondido, I4). El aviso "Según tus intervalos, no medido" sale una vez (R9).

Estado a las 15:55: Gastos y Recordatorios hechos; `npm run typecheck` sin errores. Sigo con la prueba de humo en el navegador.

**Incidencia (15:58): MySQL colgado.** El `mysqld` que arrancó el piloto a las 15:31 acepta la conexión TCP en el 3306 pero nunca manda el saludo (`mysql -e "SELECT 1"` → `ERROR 2013 … handshake: reading initial communication packet` tras 95 s; proceso inactivo, 0,1 s de CPU). La API se quedaba esperando en `/api/v1/me`. No lo reinicié (es compartido y no me corresponde). Por indicación de la sesión que dirige el piloto, **la prueba de humo de esta tanda se hizo contra una SQLite propia con la demo recién sembrada** (`migrate --seed` con el `DemoSeeder` completo, `Temp/carcare-sqlite/demo-8060.sqlite`), **no contra la BD `carcare` de Alberto**. API `:8060` relanzada con `DB_CONNECTION=sqlite`.

**Arreglos tras la primera pasada de humo (~16:00):**
- **Pestañas a 360 px:** las 5 sumaban 356 px para 328 disponibles, así que "Recordatorios" y "Datos" iban a "Más ▾". Con 13 px de letra y 4 px de margen lateral (solo por debajo de 640 px) suman 314 y **caben las 5**, como pide 5.2; "Más ▾" queda de respaldo para la letra grande y para las 6 del taller.
- **Formulario de intervención:** el separador estaba en el propio `<fieldset>` y el navegador pinta la `<legend>` encima de la línea ("Coste ———") con un hueco debajo. Ahora el separador va en un contenedor por encima del título. `Fieldset` no cambia (ninguna otra pantalla le pone borde).
- **"Por categoría" (Gastos):** los nombres se cortaban ("Mantenimient…") en la media columna. Fuera el icono de la leyenda (R7; el punto de color ya identifica la categoría) y el nombre puede ir en dos líneas (`components/charts/Charts.tsx`, `CategoryBreakdown`, que solo usa Gastos).

Estado a las ~16:05: arreglos hechos; typecheck sin errores. Vuelvo a pasar la prueba de humo completa.

**Más arreglos encontrados en las capturas (~16:10):**
- **`ui/inputs.tsx` → `Select` (componente común, compatible):** el `className` iba al `<select>`, pero la flecha vive en el contenedor. Con `md:hidden` (Historial) el `<select>` se ocultaba y **la flecha se quedaba sola** a la derecha del filtro en escritorio; lo mismo habría pasado en Recordatorios. Ahora las clases de visibilidad y colocación (`hidden`/`block` con cualquier prefijo, `col-span`, `row-start`, márgenes, `self`, `order`) van al contenedor; el ancho y lo demás siguen en el `<select>`. Ningún `Select` del taller usa esas clases (comprobado con `grep`), así que para él no cambia nada.
- **Filtros recortados:** "Todos los años" no cabía a 1280 (97 px de texto en 94) y a 360 se cortaban "Todos los tipos", "Todas las zonas", "Todos los años" y "Todas las categorías". La opción "todos" pasa a "Tipo: todos", "Zona: todas", "Año: todos" y "Categoría: todas" (el `aria-label` de cada selector ya dice qué filtra).
- **"Anotar km" dos veces en Gastos** (cabecera de la ficha y coste por km): R14 admite el atajo contextual, pero el de la cifra se llama ahora "Anotar km para calcular el coste por km" (y "Añadir repostaje para calcular el consumo"), con el texto visible al principio (WCAG 2.5.3).

Estado a las 16:14: sin flechas sueltas ni textos recortados en Historial, Gastos y Recordatorios a 360 y 1280 (`stray.mjs`). Paso typecheck, lint, test y build.

---

### Evidencias (bloque 3, 28/10, contra la SQLite de la demo)
Script `fe-particular/smoke.mjs` (`demo@carcare.test`, solo lectura) a 1280×800 y 360×740, segunda pasada tras los arreglos. "Desbordes" = elementos de `main` fuera de la ventana; "primarias" = botones o enlaces con relleno de acento en la primera pantalla ("Saltar al contenido" es el enlace de salto, invisible hasta que recibe el foco).

| Pantalla | 1280: `scrollWidth` · alto · primarias | 360: `scrollWidth` · alto · primarias |
|---|---|---|
| Inicio | 1280 · 1,23 pant. · Registrar | 360 · 1,81 · (Registrar en la barra inferior) |
| Ficha · Resumen | 1280 · **1,71** · Registrar | 360 · 2,66 · — |
| Ficha · Historial (Todo / Intervenciones / Km) | 1280 · 2,29 / 1,44 / 1,90 | 360 · 2,85 / 3,26 / 2,54 |
| Ficha · Gastos | 1280 · 3,43 | 360 · 5,41 |
| Ficha · Recordatorios | 1280 · 1,03 | 360 · 1,41 |
| Ficha · Datos | 1280 · 1,78 | 360 · 3,21 |
| Nueva intervención | 1280 · 1,72 · ninguna arriba (Guardar al final) | 360 · 2,34 |
| Agenda · Garaje | 1280 · 1,11 / 1,00 | 360 · 1,73 / 1,38 |

- **0 desbordes horizontales** en las 22 combinaciones; `scrollWidth` = ancho de la ventana en todas.
- Pestañas de la ficha: las 5 visibles a 1280 y a 360 (`probe2.mjs`: suman 314 px de 328).
- Resumen → Kilometraje: "Este año 14.093 km · Este mes 1.815 km · Media diaria (90 días) 48 km/día".
- Gastos: "Por mes", "Por categoría" y "Movimientos"; el filtro de categoría pone `?categoria=fuel` y deja 24 filas.
- Recordatorios: grupos "Vencidos (1) · Próximos (1) · En plazo (5)"; "En plazo" se abre con Enter (`aria-expanded` false → true, 7 filas) y el foco se ve (contorno sólido de 2 px). Filtro de estado: selector nativo a 360 y control segmentado a 1280.
- Nueva intervención: el `fieldset` "¿Qué se hizo?" tiene nombre accesible (`getByRole('group', { name })` = 1). El chip "Cambio de aceite" (pulsado con Enter) rellena el título "Cambio de aceite y filtro", y "Más detalles" cerrado dice "Mantenimiento · Motor · Cambio de aceite". "Desglosar…" empieza cerrado. Cancelar con cambios abre "¿Salir sin guardar?" (`probe2.mjs`).
- Teclado en Inicio: Registrar → Ver la agenda → vehículo → Marcar como hecho → Más acciones… → Añadir vehículo, todo con foco visible.
- Consola: solo el 401 de `/api/v1/me` antes de entrar (esperado).
- `stray.mjs`: 0 flechas de `Select` sueltas y 0 textos de filtro recortados en Historial, Gastos y Recordatorios a 360 y 1280.
- Capturas en `fe-particular/`: `b3-{inicio,resumen,historial,historial-intervenciones,historial-km,gastos,recordatorios,datos,intervencion-nueva,agenda,garaje}-{1280,360}.png`, `b3-filtros-historial-{1280,360}.png`, `probe2-pestanas-360.png` y `probe2-cancelar-360.png`.

---

## Bloque 4 · Tarea 26: primeros pasos, km del año e historial por año

**Estado: hecho y probado contra la API** (SQLite de la demo, ver la incidencia de MySQL en el bloque 3).

Lo que ya existía en disco (27/10, commit 6f55463), comprobado y sin rehacer:
- **(a) E5‑7 "Primeros pasos"**: `lib/firstSteps.ts` (`vehicleFirstSteps`, `dashboardFirstSteps`; 7 tests) y `components/vehicles/FirstSteps.tsx`. En el Resumen y en Inicio sale **una sola** sección en lugar de varios vacíos, con 3 acciones reales: "Anotar km", "Añadir repostaje" (solo si el rol ve gastos) y "Nueva intervención" / "Nuevo recordatorio". Cada paso desaparece al hacerlo y la guía se va con la primera intervención.
- **(b) E7‑5 km del año**: sección "Kilometraje" del Resumen con este año, este mes y la media diaria (90 días). Si el dato es `null`, dice "Faltan lecturas para calcularlo" y enlaza a "Ver lecturas". Mientras se ve la guía, solo sale si ya hay alguna cifra (para no repetir vacíos).
- **(c) E3‑3 historial por año**: encabezado `h2` por año en Historial → Intervenciones (`history/RecordsView.tsx`, `groupByYear`).

Esta tanda solo añade la prueba de punta a punta y, en Gastos, la acción que resuelve cada cifra que falta (bloque 3).

### Evidencias (`fe-particular/b4.mjs`: crea una cuenta propia en la SQLite de :8060 y la borra al final)
```
registro: 201 · vehículo: 201 (sin km)
inicio, primeros pasos: ["Anota los kilómetros de hoy","Registra el primer repostaje","Registra la última intervención o crea un recordatorio"] | título: Primeros pasos con Prueba
resumen, primeros pasos: (los mismos 3) | sección Kilometraje: 0 | sección Pendiente: 0
resumen 360 sw: 360/360
gastos, motivos: ["Necesitas al menos dos lecturas de kilometraje separadas 30 días y 500 km en este periodo.",
                  "Necesitas al menos dos repostajes con el depósito lleno y el kilometraje anotado en este periodo."]
"Anotar km" abre: Actualizar kilometraje · "Añadir repostaje" abre: Añadir gasto | categoría marcada: fuel
lectura: 201 → resumen tras km: ["Registra el primer repostaje","Registra la última intervención o crea un recordatorio"]
intervención: 201 · API km_this_year: null km_this_month: null
resumen tras intervención: guía= 0 | kilometraje: Este año Faltan lecturas para calcularlo · Este mes Faltan lecturas… · Media diaria Faltan lecturas…
inicio tras intervención: guía= 0 | secciones: ["Pendiente","Vehículos","Gasto","Último registrado"]
cuenta de prueba borrada: 204
```
- Con `demo@`: "Este año 14.093 km" (dato de la API) y encabezados "2026" y "2025" en Historial → Intervenciones a 360 y 1280; la fila se despliega con Enter (`cleanup-years.mjs`, `b4-historial-anios-{1280,360}.png`).
- El primer intento de `b4.mjs` registró la cuenta pero no inició sesión (las peticiones de Playwright no llevaban `Origin` y Sanctum no las trató como de la SPA). Esa cuenta se quedó solo en la SQLite temporal y la borré después por la API (`DELETE /me` → 204; quedan 0 cuentas `fe-b4-%`).
- Capturas: `b4-inicio-vacio-1280.png`, `b4-resumen-vacio-{1280,360}.png`, `b4-gastos-vacio-1280.png`, `b4-resumen-con-datos-1280.png`.

---

## Verificación final (desde `frontend/`, 28/10)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores (exit 0) |
| `npm run lint` | Exit 0: **0 errores**, 73 avisos (los mismos que al empezar; en mis archivos solo `Date` en el render y un falso positivo de `refs` en `handleSubmit`, que ya estaban) |
| `npm run test` | **10 archivos, 71 tests en verde** (`lib/tabs.test.ts` incluido, con el test corregido) |
| `npm run build` | El primer intento falló por `src/features/workshop/components/OrderList.tsx(5,1): TS6133 'Plate' is declared but its value is never read`, un archivo del agente del taller que estaba a medio editar en paralelo (no lo toqué). Repetido al rato: **exit 0, `✓ built in 2.02s`**. Chunks: `RemindersTab` 5,3 kB, `ExpensesTab` 11,8 kB, `MaintenanceFormPage` 17,2 kB; `charts` (Recharts) sigue aparte |

Procesos: cerré mi API de :8060 (la primera, colgada esperando a MySQL, y la de SQLite) y mi Vite de :5185. No toqué :8000, :5173 ni MySQL.

---

## Archivos tocados

Todos en `frontend/src/` (mi zona), salvo este informe. No he tocado `api/types.ts`, `three/`, `features/workshop/`, `features/landing/`, `WorkshopDashboard.tsx`, `nav.ts`, el tablero ni el backend.

**Bloques 1 y 2** (en el commit 6f55463): ver "Archivos" de cada bloque.

**Bloque 3, ejecuciones del 26 y 27/10** (en el commit 6f55463): `components/ui/{Button,primary-action,Badge,StatCard,Card,PageHeader,variants,DropdownMenu}`, `components/layout/{AppShell,MobileNav,UserMenu,WorkspaceSwitcher,CommandPalette}`, `components/charts/{Charts,Sparkbars}`, `components/vehicles/{ReminderItem,VehicleCard,ZoneMap,FirstSteps}`, `features/dashboard/PersonalDashboard`, `features/vehicle/{VehicleDetailPage,VehicleFormPage,LegacyTabRedirect,DocumentsSection}`, `features/vehicle/history/{JournalView,RecordsView,MileageView}`, `features/vehicle/tabs/{OverviewTab,HistoryTab,DataTab,ExpensesTab,RemindersTab}`, `features/agenda/*`, `features/garage/GaragePage`, `features/settings/*`, `features/report/ReportPage`, `api/hooks/records.ts`, `lib/{history,firstSteps}.ts` y sus tests. Borrados: `tabs/JournalTab.tsx` y `tabs/DocumentsTab.tsx` (su código pasó a `history/` y `DocumentsSection`).

**Esta tanda (28/10, sin commit):**
| Archivo | Cambio |
|---|---|
| `lib/tabs.ts` + `lib/tabs.test.ts` (nuevos, 09:24) | `fitTabs`; test corregido hoy |
| `components/ui/Disclosure.tsx` (nuevo, 09:24) | Bloque plegable accesible |
| `components/ui/Field.tsx` (09:24) | `<legend>` como primer hijo del `<fieldset>` (misma API) |
| `components/ui/inputs.tsx` | `Select`: clases de visibilidad y colocación al contenedor (misma API) |
| `components/charts/Charts.tsx` | `CategoryBreakdown`: leyenda sin icono y sin recortar |
| `features/vehicle/VehicleDetailPage.tsx` (09:24 + hoy) | Pestañas que caben + "Más ▾"; 13 px a 360 |
| `features/maintenance/MaintenanceFormPage.tsx` (09:24 + hoy) | Formulario simplificado (5.5); separadores fuera del `fieldset` |
| `features/vehicle/tabs/ExpensesTab.tsx` | Gastos según 5.2 |
| `features/vehicle/tabs/RemindersTab.tsx` | Recordatorios por grupos, filtro sin scroll lateral |
| `features/vehicle/history/RecordsView.tsx` | Anchos de los filtros y "Tipo: todos / Zona: todas / Año: todos" |
| `docs/equipo/informes/2026-10-26-frontend-react-particular.md` | Este informe |

Scripts de prueba (fuera del repo): `C:\Users\Alberto\AppData\Local\Temp\fe-particular\{smoke,probe2,b4,cleanup-years,stray}.mjs`.

**Sin dependencias nuevas.**

## Peticiones del tablero

- **Petición 10 (hallazgos de UX que el plan no cubría): resuelta.** I2, I3 y C4 en el commit `fa8f289`; M1 y M2 (días en minúscula salvo la primera letra y como `h2`/`h3`, ahora en `history/JournalView.tsx`), M3 ("Sin recordatorio" en `lib/status.ts`), M4 (nombre del color en Datos) y M6 (marcas comunes) en 6f55463. M5 depende del backend (texto de `Activity.summary`) y no es mío.
- **Petición 19 (mapa de zonas en "Lista" en el móvil): resuelta.** `ZoneMap` abre en "Lista" por debajo de 640 px si no hay preferencia guardada; comprobado hoy a 360 (silueta fija y lista, sin `<canvas>`; captura `b3-resumen-360.png`).

## Limitaciones

1. **Pruebas contra SQLite, no contra MySQL.** MySQL estaba colgado (bloque 3) y la prueba de humo de hoy se hizo con la demo recién sembrada en una SQLite propia, no contra la BD `carcare` de Alberto. Los bloques 1 y 2 sí se probaron contra MySQL.
2. **El Resumen mide 1,71 pantallas a 1280** (presupuesto R13: ≤ 1,5). Lo alarga el mapa de zonas: visor de unos 450 px con la lista de 10 zonas al lado. A 360 cumple (2,66 ≤ 3). Opciones: lista de zonas más compacta (filas de 36 px) o visor más bajo; lo dejo como siguiente paso porque toca el encaje con el visor de `experto-3d`.
3. **Gastos mide 3,4 pantallas a 1280 y 5,4 a 360** por los 25 movimientos de la primera página. No está entre las 4 pantallas con presupuesto de alto, pero se podría bajar a 10 por página con "Cargar más".
4. **El gráfico de kilometraje no se ha pasado al Historial → Kilometraje.** El plan 5.2 dice que los dos gráficos del Resumen van a Gastos y a Kilometraje: el de gasto por mes ya está en Gastos, pero Kilometraje solo tiene la tabla de lecturas. `MileageArea` está en `Charts.tsx` sin usar. Si se añade, habría que cargarlo con `lazy` para que la vista "Todo" del Historial no descargue Recharts.
5. **No he medido a 768 px** en esta tanda (sí a 360 y 1280). Tampoco he vuelto a pasar `auditoria-densidad.cjs` ni axe: son la tarea 5 de 8.2 (`qa-tester`).
6. Las etiquetas cortas de los filtros ("Tipo: todos", "Categoría: todas"…) son microtexto mío para que quepan a 360; si Alberto prefiere otra forma, se cambian en un sitio.
7. `Select` del componente común cambia de comportamiento solo con clases de visibilidad o colocación. Hoy ningún uso del taller las lleva; si el agente del taller las añade, ahora funcionarán como espera.

## Siguiente paso propuesto

1. **Commit de esta tanda** (lo hace la sesión que dirige; los archivos están arriba) y comprobar que MySQL vuelve a responder antes de la próxima prueba contra la BD real.
2. **Cerrar el presupuesto del Resumen** (limitación 2) y **mover el gráfico de km al Historial** (limitación 4): son lo último del plan 5.2 en el particular.
3. **`qa-tester` (8.2, tarea 5):** medir antes y después con `auditoria-densidad.cjs` y pasar axe por Inicio, ficha, agenda y formulario a 360, 768 y 1280.
4. Pedir al backend que la demo no tenga registros de prueba (I8) antes de enseñarla.
