# Informe — frontend-react (taller) — Cerrar lo que quedó a medias: resumen imprimible, RGPD del cliente y simplificación del taller y la portada (26/10/2026)

Agente: `frontend-react` (taller y portada). Encargo de la sesión principal del 26/10. Instancia aislada: API :8025 → web :5179.

## 1. Objetivo

Terminar, en este orden y bloque a bloque:

1. **Tarea 24**: cerrar el resumen imprimible de la orden (`ordenes/:orderId/resumen`) según el criterio del mapa de huecos.
2. **Tarea 29**: RGPD del cliente del taller en `CustomerDetailPage` (exportar y anonimizar).
3. **Tarea 16, paso 2**: centro de control (5.3), tablero, detalle y nueva orden (5.4), clientes y equipo (5.5) y portada.

## 2. Bloque 1 · Tarea 24: resumen imprimible

**Resultado: cumple el criterio sin cambiar código.** La página `features/workshop/OrderSummaryPage.tsx` ya estaba hecha (sesión del 24/10) y solo faltaba comprobarla.

| Criterio (mapa de huecos, T24) | Cómo lo comprobé | Resultado |
|---|---|---|
| Se imprime en A4 sin menús | La ruta `ordenes/:orderId/resumen` cuelga de `WorkspaceRoute` **fuera** de `AppShell` (`app/router.tsx`), y la barra propia lleva `no-print`. Con Playwright: `emulateMedia({ media: 'print' })` y `page.pdf({ format: 'A4', preferCSSPageSize: true })` | PDF de **1 página** con `MediaBox [0 0 594.96 841.92]` (A4) para el owner y para el mecánico. En modo impresión no queda visible ningún `nav`, `aside` ni botón; el único `header` es el de la hoja |
| Rótulo "Resumen de la orden — no es una factura" | `h1` de la hoja (`ORDER_SUMMARY_LABEL`, con test en `orderUtils.test.ts`) | `h1 = "Resumen de la orden — no es una factura"`. El pie repite "No es una factura ni tiene validez fiscal" |
| El mecánico lo ve sin precios | `showPrices = ctx.can('manage')` | Con `mecanico@`: 0 símbolos "€" en la hoja, sin columnas Precio/u ni Total y con el aviso "Esta copia no incluye importes". Ojo: la API sí le da `unit_price` al mecánico; el ocultado es de la SPA, como pide el criterio |
| Subtotal, IVA y total iguales a los de la ficha | Comparé el texto de la hoja con `GET /work-orders/31` | OT‑2026‑0031: API `209.10 / 43.91 / 253.01` ⇒ hoja "209,10 € / IVA (21 %) 43,91 € / 253,01 €" |
| Acceso | "Imprimir resumen" está en la cabecera de `OrderDetailPage` para los tres roles | — |

Capturas y PDF en la carpeta de trabajo (`scratchpad/fe-taller/`): `b1-resumen-taller-print.png`, `b1-resumen-mecanico-print.png`, `b1-resumen-taller.pdf`, `b1-resumen-mecanico.pdf`.

## 3. Bloque 2 · Tarea 29: RGPD del cliente

### 3.1 Qué hice

- **`components/customerPrivacy.ts`** (nuevo): las dos mutaciones (`POST /customers/{c}/export` y `/anonymize`), el nombre del archivo `cliente-{id}-{AAAA-MM-DD}.json`, el guardado como Blob sin segunda petición y los mensajes de error. Tras anonimizar: `setQueryData` del cliente e invalidación de la lista de clientes, sus órdenes y sus vehículos (llevan el nombre). Un 409 o un 404 recargan la ficha. Los *hooks* viven en `features/workshop/` para no tocar `api/hooks/` (fuera de mi zona).
- **`components/CustomerPrivacySection.tsx`** (nuevo): sección "Datos personales" al final de la ficha, **solo con `can('manage')`**. Tres filas sin caja (R3): *Exportar datos*, *Anonimizar* y *Eliminar cliente*. "Eliminar" se ha movido aquí desde el menú "⋮" de la cabecera para que cada acción esté en un solo sitio (R14).
  - Con órdenes abiertas no hay botón: se explica "No se puede anonimizar mientras tenga 2 órdenes abiertas. Entrégalas o cancélalas antes." (igual para eliminar).
  - El diálogo de anonimizar (`role="alertdialog"`, foco atrapado, Escape cierra) dice **qué se borra**, **qué se conserva**, **qué no se toca** (textos libres y adjuntos), que **es irreversible** y ofrece "Exportar ahora" dentro del propio diálogo. El botón de confirmar es "Anonimizar definitivamente".
  - Ya anonimizado: la fila dice cuándo se hizo y qué se borró; solo queda "Exportar datos" (el contrato lo permite) y "Eliminar".
  - Errores: 403 ⇒ "Solo el propietario o un gerente del taller pueden hacerlo."; 404 ⇒ "Este cliente ya no existe en el taller."; 409 ⇒ el mensaje exacto de la API.
- **`CustomerDetailPage.tsx`**: con `anonymized_at`, píldora "Anonimizado" (icono + texto) junto al nombre, sin "Editar", sin "Añadir contacto" ni "Añadir vehículo" (la API daría 422). "Nueva orden" sigue si tiene coches (el contrato lo permite).
- **`CustomersPage.tsx`**: la píldora "Anonimizado" también sale en la lista (tabla y móvil).
- **`components/NewOrderVehicle.tsx`**: el buscador de cliente de "Coche nuevo" ya no ofrece clientes anonimizados, y "crear coche" desde el filtro de un cliente anonimizado no se lo asigna (la API daría 422).
- **`components/customerPrivacy.test.ts`** (nuevo): nombre del archivo y mensajes de 403/404/409.

Al hacerlo apliqué también el 5.5 a la ficha del cliente (ver bloque 3): fuera la etiqueta "CLIENTE", el avatar, la caja de contacto y las miniaturas 3D; contacto en una línea bajo el nombre; vehículos y órdenes en filas con separador.

### 3.2 Evidencias (API :8025, build de producción servida con `vite preview` en :5179)

El servidor de desarrollo se recargaba con los cambios de otros agentes (HMR) y cortaba las pruebas a medias, así que probé contra una build propia (`vite build --outDir scratchpad/dist-fe-taller`) servida con `vite preview`, que usa el mismo proxy. Creé clientes de prueba ("Prueba RGPD QA fe-taller") y los **borré al terminar**; no anonimicé ningún cliente de la demo.

| Prueba | Resultado |
|---|---|
| Owner pulsa "Exportar datos" | Descarga `cliente-21-2026-10-26.json` con `generated_at, workspace, customer, vehicles, work_orders`; toast "Datos exportados · Se ha descargado cliente-21-2026-10-26.json." |
| Owner pulsa "Anonimizar…" | Diálogo `alertdialog` (1), foco dentro del diálogo. Captura `b2-dialogo-anonimizar-1280.png` |
| Confirma | `h1 = "Cliente anonimizado"` + píldora "Anonimizado"; 0 botones "Editar" y 0 "Anonimizar…"; toast "Cliente anonimizado". Captura `b2-cliente-anonimizado-1280.png` |
| Lista `?q=anonimizado` | Aparece con la píldora. Captura `b2-lista-anonimizado-1280.png` |
| Cliente con órdenes abiertas (Autoescuela Muestra, 2) | Sin botón; texto "No se puede anonimizar mientras tenga 2 órdenes abiertas. Entrégalas o cancélalas antes." |
| 404 (borro el cliente por la API con la ficha abierta y pulso Exportar) | Toast "No se pudieron exportar los datos · Este cliente ya no existe en el taller." |
| Gerente | Ve la sección "Datos personales" (1); la API le exporta (200) |
| Mecánico | No ve la sección (0); la API le responde **403** al exportar |
| 360 px | `scrollWidth = 360` en la ficha y en la lista. Captura `b2-cliente-360.png` |

El 403 en la interfaz no se puede provocar con la sección oculta; el mensaje está cubierto por el test unitario.

## 4. Bloque 3 · Tarea 16, paso 2: taller y portada

Historia del bloque: lo empezó la sesión del 26/10 (centro de control, ficha y lista de clientes, `orderUtils`), lo siguió el piloto el 27/10 de 10:55 a 11:09 (órdenes y portada; se apagó el PC) y lo retoma el piloto el 27/10 a las 17:45 (API :8065, web :5186).

### 4.1 Estado encontrado al retomar (27/10, 17:46)

Revisé en disco cada archivo de mi zona (`git diff` + lectura completa). Lo que ya estaba bien no lo he rehecho:

| Pantalla | Archivos | Estado al retomar |
|---|---|---|
| Centro de control (5.3) | `dashboard/WorkshopDashboard.tsx`, `orderUtils.ts` (`controlCenterHeadline`, `attentionOrders`, `waitingOrders`) | **Hecho.** Línea de resumen, "Requiere atención" (tarde + para hoy, máx. 8, tabla en escritorio y filas en móvil), tabla "Elevadores" con "Subir coche ▾", "Alertas de flota" con el aviso "no medido" una vez. Sin 3D, sin tarjetas de cifras, sin importes, sin actividad. Mecánico: "Mis órdenes" primero |
| Tablero (5.4) | `OrdersPage.tsx`, `KanbanBoard.tsx`, `OrderCard.tsx`, `OrderList.tsx` | **Hecho.** Columnas sin caja con nombres cortos (`KANBAN_SHORT_LABEL`) y nombre completo para el lector; tarjeta de 3 líneas sin miniatura, sin placa, sin cliente, solo "Tarde"/"Urgente"; ayuda de arrastre solo `sr-only`; móvil abre en "Lista" y los filtros caben en "Filtros ▾" |
| Detalle de orden (5.4) | `OrderDetailPage.tsx`, `BayPicker.tsx`, `StatusStepper.tsx`, `OrderTotals.tsx`, `AssigneeField.tsx` | **Hecho.** Cabecera en dos líneas (`OrderMeta`), primaria = siguiente paso, sin "Mover a…", elevador con un selector (ocupados deshabilitados), sin columna lateral, prioridad en selector, barra de guardar fija solo con cambios |
| Nueva orden (5.4) | `NewOrderPage.tsx`, `NewOrderVehicle.tsx` | **Hecho.** Buscador con resultados en lista (sin miniaturas), "Coche nuevo" como enlace, "Qué le pasa" con 6 sugerencias y prioridad, "Más opciones" plegado (elevador, mecánico, km, fecha, piezas) que solo pide los elevadores al abrirse, sin columna de resumen |
| Clientes y ficha (5.5) | `CustomersPage.tsx`, `CustomerDetailPage.tsx` | **Hecho** el 26/10 (bloque 2) |
| Portada (5.5, petición 18) | `landing/LandingPage.tsx` | **Hecho casi del todo.** `HeroImage` con `priority`, sin `useScrollProgress` ni sección de 170vh, sin `Reveal`, "Ver en 3D" monta `HeroScene` solo al pulsarlo. Falta un detalle de accesibilidad del botón (ver 4.4) |
| Navegación del taller (5.6) | `components/layout/nav.ts` | **Hecho.** "Centro de control" lleva `mobileLabel: 'Inicio'` y `MobileNav` ya lo usa |
| Equipo (5.5) | `TeamPage.tsx`, `TeamActivity.tsx`, `team.ts` | **Pendiente**: "Único propietario" repetido, guía de roles en caja con baldosas de icono, lista y actividad en cajas, 3 peticiones al abrir |
| Taller 3D (5.5) | `WorkshopFloorPage.tsx`, `FloorPanel.tsx` | **Pendiente**: franja de 4 elevadores bajo la escena, panel en caja con cajas dentro, 4 píldoras en la ficha, 2 etiquetas en MAYÚSCULAS, miniatura `CarThumbnail` |

Línea base comprobada: `npm run typecheck` sin errores; `npm run lint` 0 errores y ningún aviso en mi zona (74 avisos, todos de `three/`, `app/router.tsx`, `features/vehicle`, `features/maintenance` y `features/auth`).

Estado a las 17:50: diagnóstico hecho; empiezo por Equipo.

### 4.2 Equipo (5.5) — hecho

- **`TeamPage.tsx`**: una columna (`max-w-4xl`). Sección "Personas" con cabecera de columnas en escritorio (Persona · Desde · Rol) y filas con separador, sin caja ni iniciales en círculo (R3, R7). El rol es texto o su menú "Gerente ▾", sin píldora ni icono (R5). Fuera la etiqueta "Único propietario" con candado: el motivo se dice **una vez** bajo la lista y solo a quien gestiona. "Salir del taller" y "Quitar a…" son botones de icono con etiqueta accesible y `title`.
- **"¿Qué puede hacer cada rol?"** plegado con `<details>` nativo (teclado y lector sin JavaScript), en vez de la tarjeta lateral con baldosas de icono.
- **Actividad**: lista de 10 con "Ver más". El filtro por vehículo ya no se monta al abrir: sale "Filtrar por vehículo" y, al pulsarlo, aparece el selector (recibe el foco cuando tiene opciones) con "Quitar filtro". Con `?vehiculo=` en la URL se abre solo. Al abrir la pantalla quedan **2 peticiones** (miembros y actividad) en vez de 3 (R12).
- **`TeamActivity.tsx`**: sin caja ni iniciales; frase y "hace 2 h" en una línea en escritorio, dos en móvil.
- **`team.ts`**: quito `protectedLabel` (ya no se usa) y reescribo `protectedReason` como frase única.
- Alta de persona: el diálogo no cambia salvo quitar los iconos de rol (queda la marca ✓ del elegido).

Estado a las 18:05: Equipo hecho (typecheck limpio); sigo con Taller 3D.

### 4.3 Taller 3D (5.5) — hecho

- **`WorkshopFloorPage.tsx`**: fuera la franja de 4 elevadores bajo la escena (repetía los rótulos de la escena y el panel). La escena ocupa toda la altura en escritorio (`xl`) y, en móvil y tableta, va arriba con el panel debajo. Columna lateral de 380 px sin caja.
- **`FloorPanel.tsx`** (reescrito; la lógica de selección, mover, subir/bajar y errores se mantiene):
  - Sin elegir nada, el panel lista **Elevadores** (uno por fila: "Elevador 1 · Reparto 1 · 2207 LBC · 0019 · En reparación") y **En espera (n)**. Así sigue siendo la alternativa HTML de la escena que antes daba la franja.
  - Filas con separador, sin cajas (antes, 4 cajas dentro de la caja del panel). Punto de color del coche (el `color_hex`, excepción permitida) en vez de la baldosa de 28 px con icono.
  - Ficha de la orden: estado, número y elevador en la línea bajo el título, en texto; píldora solo para "Tarde" y "Urgente" (antes 4: estado, prioridad, elevador, "En espera"). Fuera la miniatura `CarThumbnail` y la placa. Cliente con teléfono dentro de la lista de datos. Fuera las 2 etiquetas en MAYÚSCULAS ("EN ESPERA", "ELEVADOR").
  - Sin "eyebrow" sobre el título (R10): lo que decía pasa a la línea de debajo.
  - Foco: al elegir algo desde la lista o al cerrar la ficha, el botón pulsado desaparece; ahora el foco pasa al título de la ficha (`tabIndex=-1`) en vez de perderse en `body`.
  - Errores en línea como texto con icono, sin recuadro.
- **`OrderBadges.tsx`**: quito `OrderStatusPill` y `BayBadge`, que ya no usa ninguna pantalla.
- **`OrderLinesTable.tsx`** (líneas de una orden cerrada): tabla y lista sin caja (R3).

### 4.4 Órdenes en el móvil y portada — retoques

- **Lista agrupada por estado en el móvil (5.4)**: con el filtro "Abiertas", la lista del móvil se agrupa en secciones plegables (`<details>` nativo) en el orden del flujo, "Recibido 3 · Diagnóstico 2…", y las filas no repiten el estado. Solo se agrupa si están cargadas todas las órdenes abiertas (`!hasNextPage`); si quedan páginas, se muestra la lista plana para que los recuentos no engañen. En escritorio sigue la tabla.
- **Portada**: el botón "Ver en 3D / Ver la imagen" cambiaba de texto y además llevaba `aria-pressed`, y el lector anunciaba algo contradictorio ("Ver la imagen, pulsado"). Ahora la etiqueta basta y lleva `aria-controls` hacia la imagen.

Estado a las 18:20: código del bloque terminado (typecheck y lint de mi zona limpios). Empiezo la verificación.

### 4.5 Verificación (retomado el 28/10 a las 15:40)

El piloto del 28/10 a las 09:17 me relanzó y se cortó hacia las 10:00 sin escribir aquí; solo quedó en disco `formatWhenInline` en `orderUtils.ts` (sin usar). Retomado el 28/10 a las 15:40 por el piloto (API :8065, web :5186).

- **`formatWhenInline` terminado.** Las fechas relativas a mitad de frase salían con mayúscula ("prometida Mañana, 13:00", "Recibida Hoy, 09:10", "Tarde · Ayer, 19:00", "Entrega prevista: Mañana, 13:00."). Ahora usan `formatWhenInline` en `OrderDetailPage` (línea de la cabecera), `WorkshopDashboard` ("Tarde · ayer, 19:00"), `OrderCard` ("Andrés · mañana, 13:00"), `OrderList` ("Recibida hoy, 09:10") y `PromisedAtField` (ayuda del campo). Donde la fecha va sola (celda de tabla, `PromisedAt` con icono, ficha del Taller 3D) se queda `formatWhen` con mayúscula. Test nuevo en `orderUtils.test.ts` (15/15).

Estado a las 15:45: `npm run typecheck` sin errores; `npm run lint` 0 errores y 73 avisos, ninguno en mi zona; `npm run test` 10 archivos, 71 tests pasan. Build a carpeta propia hecha (1,68 s). **MySQL no responde**: el piloto lo arrancó a las 15:31, el puerto 3306 acepta la conexión pero no llega el saludo (`mysqladmin ping` ⇒ "Lost connection … at 'handshake: reading initial communication packet'"), y la primera petición a la API (:8065) se queda colgada. Mientras, reviso el código con las reglas del plan.

**Base de datos de la prueba.** Por indicación del piloto, la prueba de humo se hizo contra una **base SQLite propia con la demo recién sembrada** (`migrate --seed`, `DemoSeeder` completo, archivo `Temp/carcare-sqlite/demo-8065.sqlite`), **no contra la BD `carcare` de Alberto**. API :8065 lanzada con `DB_CONNECTION=sqlite DB_DATABASE=… DB_URL=`; web :5186 = build de producción propia (`vite build --outDir Temp/fe-taller-27/dist`) servida con `vite preview` (mismo proxy). Script de Playwright: `Temp/fe-taller-27/smoke.mjs` (por usuario y a 360 y 1280: ancho de documento, elementos que se salen, primarias con `bg-accent`, símbolos "€", `<canvas>`, chunks `three-*`, peticiones a la API al abrir, errores de consola y HTTP, recorrido con Tab comprobando el anillo de foco, y captura de página completa).

Estado a las 15:58: owner (`taller@`) recorrido en las 8 pantallas a 360 y 1280 + portada. **Sin desbordes** (`scrollWidth` = ancho de ventana en las 18 combinaciones), 0 errores de consola/HTTP en la app, una sola primaria por pantalla. **Fallo grave fuera de mi zona: `three-*.js` (1 MB) y `charts-*.js` se descargan en todas las pantallas, también en la portada antes de pulsar "Ver en 3D"** (ver 6.3). Pendiente: gerente, mecánico y revisar 3 avisos de foco.

Estado a las 16:20: gerente y mecánico recorridos (mismas 8 pantallas × 2 anchos). Sin desbordes, 0 errores de consola y **0 respuestas 4xx/5xx** (ningún botón llama a algo que el rol no puede hacer). Mecánico: **0 "€"** en todas las pantallas, sin "Datos personales", sin "Eliminar orden", sin "Añadir persona" ni menús de rol. Los avisos de foco eran falsos positivos (enlaces "estirados": el anillo lima lo pinta la fila o la tarjeta con `has-[…:focus-visible]`, y `transition-colors` anima su color 150 ms; comprobado tras la transición: `outline: solid 2px rgb(199,243,107)`). Corregidos dos detalles del centro de control (ver 6.2). Causa del `three-*.js` en todas las pantallas encontrada y probada fuera del repo (ver 6.3).

Estado a las 20:40: corregida la tabla de la lista de órdenes a 1280 (ver 6.2), última pasada del owner sobre una build con la configuración del repositorio y comandos finales en verde. Servidores :8065 y :5186 cerrados. Cierro el informe.

(Nota: entre las 16:30 y las 20:30 los dos servidores en segundo plano se cerraron solos por el límite de tiempo de la sesión y hubo que relanzarlos; no afectó a los datos.)

## 5. Archivos tocados

Todo dentro de mi zona. Ninguno en `components/ui/`, `components/layout/` (salvo `nav.ts`), `three/`, `api/types.ts`, `vite.config.ts` ni el backend.

**Bloques 1 a 3 (26 y 27/10, ya en el commit `6f55463`)**, en `frontend/src/`:

- `components/layout/nav.ts`
- `features/dashboard/WorkshopDashboard.tsx`
- `features/landing/LandingPage.tsx`
- `features/workshop/`: `CustomerDetailPage.tsx`, `CustomersPage.tsx`, `NewOrderPage.tsx`, `OrderDetailPage.tsx`, `OrdersPage.tsx`, `TeamPage.tsx`, `WorkshopFloorPage.tsx`
- `features/workshop/components/`: `AssigneeField.tsx`, `BayPicker.tsx`, `CustomerPrivacySection.tsx` (nuevo), `customerPrivacy.ts` (nuevo), `customerPrivacy.test.ts` (nuevo), `FloorPanel.tsx`, `KanbanBoard.tsx`, `NewOrderVehicle.tsx`, `OrderBadges.tsx`, `OrderCard.tsx`, `OrderLinesTable.tsx`, `OrderList.tsx`, `OrderTotals.tsx`, `StatusStepper.tsx`, `TeamActivity.tsx`, `orderUtils.ts`, `orderUtils.test.ts`, `team.ts`

**Esta tanda (28/10, sin commit)**, en `frontend/src/`:

| Archivo | Cambio |
|---|---|
| `features/workshop/components/orderUtils.ts` | `formatWhenInline` (empezada el 28/10 a las 09:59) |
| `features/workshop/components/orderUtils.test.ts` | Test de `formatWhenInline` |
| `features/workshop/OrderDetailPage.tsx` | "prometida mañana, 13:00" en la cabecera |
| `features/workshop/components/OrderCard.tsx` | "Andrés · mañana, 13:00" |
| `features/workshop/components/PromisedAtField.tsx` | "Entrega prevista: mañana, 13:00." |
| `features/workshop/components/OrderList.tsx` | "Recibida hoy, 09:10"; tabla de la lista: desde `xl`, número corto, "Vehículo y cliente" en una columna |
| `features/dashboard/WorkshopDashboard.tsx` | Número corto en las dos tablas; el mecánico no ve repetidas sus órdenes; "Mis órdenes" con lo urgente primero; columna "Prometida" más ancha |
| `docs/equipo/informes/2026-10-26-frontend-react-taller.md` | Este informe |

Fuera del repositorio, en `Temp/fe-taller-27/`:

- scripts: `smoke.mjs`, `focus.mjs`, `focus2.mjs`, `list.mjs` y `build-fix.mjs`;
- builds: `dist/` y `dist-fix/`;
- resultados: `smoke-results-*.json` y `final-*.txt`;
- capturas `v-*.png` y `foco-*.png`.

## 6. Comprobaciones finales

### 6.1 Prueba de humo (28/10, SQLite con la demo recién sembrada, build de producción)

Recorrido con Playwright de 8 pantallas (centro de control, órdenes, detalle de orden, nueva orden con "Más opciones" abierto, clientes, ficha del cliente, equipo y Taller 3D) con los 3 roles a 360 y 1280. Son 48 combinaciones, más la portada sin sesión a 360 y 1280.

| Comprobación (plan UX) | Resultado |
|---|---|
| Sin desbordes horizontales | `scrollWidth` = ancho de ventana en las 48 combinaciones y en la portada. Ningún elemento se sale por la derecha fuera de un contenedor con scroll |
| Teclado y foco visible (R, §4) | 25 pulsaciones de Tab por pantalla: todos los elementos enfocados tienen `:focus-visible` y anillo. Los 3 avisos del script eran enlaces "estirados" cuyo anillo pinta la fila o la tarjeta: comprobado `outline: solid 2px rgb(199,243,107)` en `li`/`article` (capturas `foco-cliente-lista-360.png`, `foco-cliente-vehiculo-360.png`, `foco-tarjeta-1280.png`) |
| Una primaria por pantalla (R1) | 1 `bg-accent` visible por pantalla (el otro que cuenta el script es "Saltar al contenido", oculto hasta enfocarlo). En Taller 3D, los 4 restantes son puntos de estado "En reparación" de la escena (`three/`), no botones |
| El mecánico no ve importes ni botones que no puede usar | **0 "€"** en las 16 pantallas del mecánico. No aparecen: "Datos personales" (exportar/anonimizar/eliminar), "Eliminar orden", "Añadir persona", menús de rol ni "Quitar a…". **0 respuestas 4xx/5xx** de la API en todo el recorrido de los 3 roles. El gerente sí ve "Exportar datos" y gestiona el equipo |
| 3D solo en Taller 3D (R11, §5.7) | 1 `<canvas>` en Taller 3D y 0 en las demás. **Pero `three-*.js` se descarga en todas las pantallas** (ver 6.3) |
| Peticiones al abrir (R12) | Centro 2 propias (+ `/me`), órdenes 2, clientes 1, ficha del cliente 3, detalle de orden 3, equipo 2, Taller 3D 2 |
| Centro de control (5.3) | Línea de resumen, "Requiere atención", "Elevadores" y "Alertas de flota" con "no medido" una vez. Sin 3D, sin cifras grandes, sin importes. Mecánico: "Mis órdenes" primero |
| Tablero (5.4) | 5 columnas con nombre corto y tarjetas de 3 líneas. Móvil: lista agrupada por estado con `<details>` (captura `v-gerente-360-ordenes.png`) y "Filtros ▾" |
| Detalle y nueva orden (5.4) | Cabecera en 2 líneas, primaria = siguiente paso, elevador en un selector, líneas en tabla en escritorio, "Más opciones" plegado |
| Clientes, ficha y RGPD (5.5) | Tabla y filas sin caja; RGPD solo para quien gestiona |
| Equipo y Taller 3D (5.5) | Como en 4.2 y 4.3 |
| Portada (5.5) | Imagen fija, 2 botones y secciones en texto; "Ver en 3D" monta la escena y pasa a "Ver la imagen" (con `aria-controls` y sin `aria-pressed`) |

Alto de página (R13, pantallas de 800 px):

- centro de control a 1280: owner 1,71 → **1,57** y mecánico 2,36 → **1,85**;
- centro de control a 360: owner 2,1 y mecánico 3,01 → **2,35**;
- lista de órdenes: 1 a 1280 y 2,18 a 360.

### 6.2 Lo que corregí en esta tanda

1. **Fechas en mayúscula a mitad de frase.** Terminé `formatWhenInline` (ver 4.5).
2. **Centro de control, columna "Nº".** "OT‑2026‑0022" se partía en dos líneas y doblaba el alto de cada fila. Ahora sale "0022", como en el boceto 5.3, y el lector oye el número completo (`sr-only`). Lo mismo en la columna "Orden" de "Elevadores", donde además ya no se corta el título. La columna "Prometida" es algo más ancha.
3. **Centro de control del mecánico.** "Requiere atención" repetía las mismas 6 órdenes que "Mis órdenes", porque en la demo todas son suyas (R14). Ahora no repite las suyas y, si todas lo son, lo dice en una línea: "Las 6 órdenes que van tarde o son para hoy son tuyas: están en «Mis órdenes»". Solo filtra cuando "Mis órdenes" ha cargado; si falla, no se esconde ninguna orden urgente. "Mis órdenes" pone primero las que van tarde y luego las ordena por fecha prometida.
4. **Lista de órdenes a 1280 (owner y gerente).** La columna "Trabajo" se quedaba en unos 38 px ("Cam d…") y los números se partían. Era una tabla fija con 8 columnas en 996 px de contenido, y a 1024 px habría sido peor. Cambios:
   - la tabla sale desde `xl` (1280) y por debajo se usan las filas, que ya caben;
   - el número va en corto;
   - el cliente pasa bajo el vehículo ("Vehículo y cliente").
   
   Capturas: `v-taller-1280-ordenes-vista-lista.png` y `v-taller-1024-ordenes-vista-lista.png`.

### 6.3 Fallo encontrado fuera de mi zona: three.js y Recharts en todas las pantallas

**Síntoma.** En la build de producción, `index.html` hace `modulepreload` de `three-*.js` (1.003 KB) y `charts-*.js` (373 KB). Pasa en todas las pantallas, también en la portada antes de pulsar "Ver en 3D". Incumple R11 y la comprobación de la petición 18.

**Causa** (traza en `dist/assets`). Los grupos de `codeSplitting` arrastran las dependencias de sus módulos:

- `clsx` cae en `charts` porque lo importa Recharts;
- `use-sync-external-store` cae en `three` porque lo importa zustand, de React Three Fiber; Recharts también lo usa.

Así se forma la cadena `Button` (usa `cn` → `clsx`) → `charts` → `three`, y la entrada importa `Button`.

**Arreglo probado, sin tocar el repo.** Un grupo más en `frontend/vite.config.ts`, antes de `three`:

```ts
{ name: 'vendor', test: /[\\/]node_modules[\\/](clsx|tailwind-merge|use-sync-external-store)[\\/]/, priority: 25 },
```

Lo construí con `Temp/fe-taller-27/build-fix.mjs` (misma configuración más ese grupo) y lo serví en :5186. Resultado:

- la entrada ya no precarga `three` ni `charts` (`vendor-*.js`, 30 KB);
- `three-*.js` = 0 en las 14 pantallas sin 3D de owner y mecánico;
- en Taller 3D se carga three.js y la escena funciona;
- en la portada no se descarga three.js hasta pulsar "Ver en 3D", y después sí, con `<canvas>`.

**Petición** a experto‑3d (dueño de ese ajuste, tarea 20) o a quien lleve `vite.config.ts`: aplicar el grupo y comprobar con `grep modulepreload dist/index.html`.

### 6.4 Comandos (desde `frontend/`, 28/10 a las 20:35, con los cambios del otro agente en disco)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sale con 0, sin errores |
| `npm run lint` | Sale con 0: **0 errores**, 73 avisos, ninguno en mi zona (`app/router.tsx` 29, `three/` 19, `features/vehicle` 12, `components/layout/CommandPalette.tsx` 4, `components/forms/LineItemsEditor.tsx` 4 y otros sueltos) |
| `npm run test` | **10 archivos, 71 tests pasan** (`orderUtils.test.ts` 15/15 con el test nuevo) |
| `npm run build` | Sale con 0, `built in 1.69s`. Sigue el aviso de chunk > 500 KB (`three`) y la precarga de 6.3 |

### 6.5 Peticiones del tablero

- **Petición 8 (RGPD del cliente): resuelta.** Hecha y probada el 26/10 (bloque 2). Hoy he vuelto a comprobar que el gerente ve "Datos personales" y el mecánico no.
- **Petición 18 (imagen fija de la portada): resuelta en mi parte.** `HeroImage priority` y `HeroScene` solo al pulsar "Ver en 3D". **Su comprobación final ("ningún `three-*.js` en la red de la portada") no se cumplirá hasta que se aplique el arreglo de 6.3 en `vite.config.ts`**, fuera de mi zona. Con ese arreglo se cumple (probado).

## 7. Limitaciones y siguiente paso

**Limitaciones**

- **No probé contra la BD `carcare` de Alberto.** MySQL estaba colgado (acepta la conexión pero no envía el saludo), así que todo se probó contra la SQLite de la demo recién sembrada. Las diferencias de datos o de motor (MariaDB frente a SQLite) no están cubiertas por esta prueba.
- **Lo que no probé en el navegador:**
  - arrastrar en el kanban;
  - mover un coche de elevador;
  - crear o guardar una orden;
  - anonimizar.
  
  Hoy no hice ninguna mutación, para no tocar datos; esas acciones se probaron el 26 y el 27/10. Tampoco comprobé con lector de pantalla real (solo el árbol y los `sr-only`).
- **R13 no se cumple del todo** con la demo: centro de control del owner 1,57 pantallas a 1280 (objetivo ≤ 1,5) y del mecánico 1,85. El detalle de orden mide 4,15 pantallas a 360, porque el editor de líneas apila una tarjeta por línea.
- `uppercase` queda en los campos de matrícula y NIF (`NewOrderVehicle`, `CustomerDialog`). Es la transformación del valor que se escribe, no una etiqueta, igual que en el formulario de vehículo del particular. El `grep` de R6 los cuenta.

**Peticiones a otras zonas** (para el tablero; no he tocado nada):

1. **experto‑3d / `vite.config.ts`.** Grupo `vendor` de 6.3. Es lo más importante de este informe: hoy todas las pantallas descargan 1,4 MB que no usan.
2. **experto‑3d / `three/scenes/WorkshopCanvas.tsx:235`.** Los rótulos de elevador de la escena van en `uppercase tracking-wide` (R6).
3. **frontend‑react (común) / `components/forms/LineItemsEditor.tsx`.** A 1280 el selector "Tipo" corta "Mano de o…". Bastaría con 8–9 rem o "M. de obra".
4. **frontend‑react (común) / `components/ui/`.** `transition-colors` también anima `outline-color`, y el anillo de foco de las filas con enlace "estirado" aparece en blanco y pasa a lima en 150 ms. Habría que quitar `outline-color` de la transición o usar `transition-[background-color]` en esas filas. Las filas son mías, pero el patrón está repartido; lo dejo anotado para hacerlo junto.

**Siguiente paso propuesto**

1. Aplicar 6.3 y repetir `Temp/fe-taller-27/smoke.mjs`. El script sirve tal cual con cualquier API en :8065 y web en :5186.
2. Cuando MySQL vuelva, una pasada contra la BD `carcare`.
3. Reducir el alto del centro de control. Por ejemplo, "Alertas de flota" en una línea por alerta, o plegada si hay más de 3. Lo decide el diseñador UX.
