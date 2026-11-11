# Informe · frontend-react · Mundo «Diorama» en el taller (fase B)

Fecha: 11/11/2026 · Encargo de la sesión principal, pedido por Alberto («que sea como un juego TODA la página en TODOS los usuarios, y para el perfil del taller espabila y déjalo como el vídeo») · Sin commits.

## 1. Objetivo

Aplicar el sistema de la fase A ([informe](2026-11-11-frontend-react-mundo-diorama.md)) a las pantallas del espacio `workshop`: que la portada del taller sea la maqueta a pantalla completa con la interfaz flotando encima, y que el resto de pantallas del taller (tablero, orden, nueva orden, clientes, equipo, solicitudes) hablen el mismo idioma de juego. Solo datos reales (regla 2): sin puntos, niveles ni XP; sin conductor, batería, velocidad ni ruta.

## 2. Qué hice

### 2.1 Una sola portada: «Taller» (decisión)
«Inicio» (centro de control: atención, tabla de elevadores, alertas de flota, primeros pasos) y «Taller» (la maqueta) enseñaban lo mismo desde dos sitios. Los fusioné: **la portada del espacio del taller es la vista «Taller» en `/app/{ws}`**. Motivo: cada dato del Inicio ya existía en la maqueta o encaja en ella (los elevadores y la espera están en la escena y en la lista de la flota; lo que va tarde, en las cifras y en las misiones; las alertas de flota, en una misión; los primeros pasos, en la columna lateral), y mantener dos entradas obligaba a elegir entre dos «inicios».

- `nav.ts`: en el taller desaparece «Inicio»; la entrada **«Taller»** apunta a `base` (`end`, también en la barra inferior móvil) y la paleta la sigue encontrando por «inicio», «centro de control» y «taller 3d». El grupo «Día a día» queda en Taller · Órdenes · Solicitudes. El particular no cambia.
- `router.tsx`: `/taller` ya no es una pantalla, redirige a `..` **conservando `?orden=` y `?elevador=`** (`TallerRedirect`), así que los enlaces antiguos (p. ej. «Ver en el taller 3D» de la orden, ahora «Ver en la maqueta del taller») siguen sirviendo. Comprobado: `/taller?orden=27` → `/app/3?orden=27`.
- `DashboardPage.tsx`: el taller carga `WorkshopFloorPage`; `WorkshopDashboard.tsx` se **elimina** (su contenido está repartido arriba; no queda ninguna referencia).
- `nav.test.ts` actualizado (+1 test: una sola portada, sin «Inicio» duplicado, barra inferior Taller · Órdenes · Clientes).

### 2.2 La portada («como el vídeo»)
`WorkshopFloorPage.tsx` reescrito sobre **`CanvasBleed`**: la maqueta ocupa toda la ventana (empieza en `var(--shell-left)`, el hueco del dock, ver petición 31) y flotan encima:
- **Cabecera** (`hud-bar`): «Taller», «Tablero» y «Nueva orden» (la primaria desaparece si hay guía de primeros pasos: una sola primaria por pantalla).
- **Cifras clave** (`FloorStats`, rehechas como tarjetas `hud-panel` con icono): En taller, En elevador, Esperando, Listos para entregar, Con retraso (solo si hay). Filtran la lista; activa = relleno azul suave + aro + marca inferior + `aria-pressed` (no solo color). Sin datos: «—», nunca un 0 inventado.
- **Flota** abajo (`FleetTable`, `hud-panel`): plegable, chips de filtro, fila elegida con barra azul. Es la alternativa HTML/teclado de la escena.
- **Columna lateral** a la derecha (360 px en escritorio), según el caso:
  - **Ficha** de la orden o del elevador libre (lo que ya existía, con el aspecto nuevo). Hoja inferior a 768.
  - **Primeros pasos** (taller sin órdenes y quien puede gestionar): `FirstStepsGuide` movido a `WorkshopFirstSteps.tsx`.
  - **Misiones** (solo escritorio, sin selección): lista de `Mission` pulsables. Cada una hace algo: elegir la orden en la maqueta, filtrar la flota o abrir la agenda.
- **Misiones con datos reales** (`homeMissions.ts`, función pura con 6 tests): órdenes tarde (las más urgentes primero), entregas de hoy (del resumen del taller), «N coches listos para entregar», «N esperan elevador» (dice cuántos elevadores libres hay) y «N alertas de flota» (con «según los intervalos anotados, no medido»). Al **mecánico** le salen primero «Mis órdenes» (asignadas a él). Sin datos de órdenes no se inventa nada; taller vacío, no hay misiones.
- `focusInset` pasa a medirse con el relleno real de `.canvas-hud` (84 / 24 / 32 px) más lo que ocupan cabecera, lista y columna lateral.
- **<768 px o sin WebGL**: todo apilado (cabecera → cifras → primeros pasos si los hay → escena → misiones → flota → ficha), con la escena sin marco (a ancho completo, fondo `--base`).
- Se conserva todo lo de antes: selección en la URL, Escape con foco devuelto a la fila, regiones `aria-live`, importe solo con `manage`, refresco cada minuto.

### 2.3 Resto de pantallas del taller
Nuevo `features/workshop/components/WorkshopHeader.tsx` (cabecera de panel con migas, título, descripción y acciones; mismo papel que `PageHeader`, que es compartido y no se toca) y `features/workshop/diorama.css` (carriles, tarjeta con canto, «slab» para listas y tablas dentro de un panel; solo tokens, vale en claro y noche).
- **Tablero de órdenes** (`OrdersPage`, `KanbanBoard`, `OrderCard`): barra de herramientas en `hud-bar`; **carriles de juego** (bandeja de cristal con pestaña de color por estado, icono, nombre y contador en chip; al arrastrar, el carril se ilumina con aro azul); **tarjetas con canto** que suben al pasar el ratón, se hunden al pulsar y se inclinan al arrastrarlas; las tarde con canto rojo más el icono y «Tarde». Arreglé de paso que el número corto se salía de la tarjeta cuando había «Tarde» y «Urgente» a la vez (la fila ahora pasa a la línea siguiente).
- **Vista lista** (`OrderList`): tabla y filas dentro de un panel.
- **Detalle de orden**: cabecera en panel con migas; el avance del estado pasa a **barra gruesa con pieza actual en azul**; cada bloque (estado y elevador, trabajo, piezas y mano de obra, planificación, fechas) es un panel; la barra de guardar es una `hud-bar`. Lectura (entregada/cancelada) igual.
- **Nueva orden**: cabecera, los tres bloques en paneles y la barra de acciones.
- **Clientes**: cabecera, lista (móvil) y tabla (escritorio) dentro de panel.
- **Ficha de cliente**: vehículos y órdenes en paneles; el aviso de privacidad (RGPD) intacto.
- **Equipo**: «Personas» y «Actividad» en paneles.
- **Solicitudes** (bandeja y detalle): cabecera, lista en panel y detalle en paneles (qué le pasa, presupuesto, coche, contacto, orden, historial).
- Diálogos y formularios heredan el estilo del sistema (fase A).

### 2.4 No hecho por mí (comparten pantalla con el particular)
**Vehículos** (`GaragePage`), **Agenda**, **Analítica** y **Ajustes** son los mismos componentes en los dos modos y los está rehaciendo el otro frontend-react en paralelo (los archivos ya aparecían modificados por él). No los toqué para no pisarnos; los he mirado en el espacio del taller y heredan el sistema sin romperse. **Elevadores** no tiene pantalla propia (viven en la maqueta, en la ficha del elevador libre y en el selector de la orden; el número se cambia en Ajustes). **Facturación** no existe como pantalla: los importes del taller son «Importe de órdenes entregadas» (Analítica, solo `manage`).

## 3. Archivos

Nuevos (`frontend/src/features/workshop/`): `components/{homeMissions.ts, homeMissions.test.ts, MissionsPanel.tsx, WorkshopFirstSteps.tsx, WorkshopHeader.tsx}`, `diorama.css`.
Modificados: `WorkshopFloorPage.tsx` (reescrito), `floor.css` (solo las animaciones de la columna; el cristal es el del sistema), `components/{FloorStats, FleetTable, FloorPanel, KanbanBoard, OrderCard, OrderList, StatusStepper}.tsx`, `{OrdersPage, OrderDetailPage, NewOrderPage, CustomersPage, CustomerDetailPage, TeamPage}.tsx`, `requests/{WorkshopRequestsPage, WorkshopRequestDetailPage}.tsx`.
Fuera de `features/workshop/` (compatibles hacia atrás): `app/router.tsx` (redirección `/taller`, ya sin la pantalla), `components/layout/nav.ts` y `nav.test.ts` (entrada única «Taller»), `features/dashboard/DashboardPage.tsx` (carga la portada del taller).
Eliminado: `features/dashboard/WorkshopDashboard.tsx` (fusionado; motivo en 2.1).
Docs: `docs/equipo/TABLERO.md` (mi fila y la petición 31) y la carpeta de capturas de este informe.
No toqué `frontend/src/three/`, `components/ui/`, `index.css`, `AppShell` ni `api/types.ts`. Sin dependencias nuevas.

## 4. Evidencias

**Comandos (desde `frontend/`, 11/11/2026, al final):**
- `tsc -b` (typecheck): sin errores (exit 0).
- `oxlint src` (lint): exit 0, 75 avisos, ninguno en mis archivos (los de `router.tsx` son los `lazy` de siempre).
- `vitest run`: **22 archivos, 188 tests en verde** (+6 de `homeMissions`, +1 de `nav`).
- `vite build`: correcto (`✓ built in 4,05 s`; `WorkshopFloorPage` 35,7 kB / 11,1 kB gzip; el chunk de three.js sigue aparte).
Durante la sesión hubo momentos en que `tsc` fallaba por `AnalyticsPage.tsx` (trabajo en curso del otro frontend-react); al terminar pasa limpio.

**Prueba contra la API real** (API :8042 + web :5202, datos demo; Playwright con WebGL por software). Guion en `probar.cjs`, `vacio.cjs` y `capturar.cjs`; resultado literal en `probar-resultado.txt`:
- Elegir una fila → `?orden=27` y ficha; Escape → URL limpia; pulsar una misión → `?orden=26`; `/taller?orden=27` → `/app/3?orden=27`.
- **Importes**: el propietario ve «Total (con IVA)»; el **mecánico no lo ve** (0). El mecánico tampoco ve «Analítica» y sus misiones empiezan por «Tuya · va tarde» (sus órdenes).
- **Taller sin órdenes** (cuenta nueva registrada por API con taller): cifras en 0, maqueta con 4 elevadores libres, «No hay coches en el taller» con «Nueva orden» y la guía «Primeros pasos» con una sola acción azul (capturas `despues-vacio-*`, 1440/768/360). Era la limitación abierta del informe del 10/11.
- **axe** (wcag2a, wcag2aa, wcag21aa, claro, 1440): **0 violaciones** en la portada, la portada con ficha, órdenes (tablero y lista), clientes, equipo, nueva orden y solicitudes, y en el taller vacío (9 pantallas).
- No se midió desbordamiento horizontal con un script; se revisó a ojo en las 68 capturas.

**Capturas** (`2026-11-11-frontend-react-diorama-taller/`): `antes-*` (estado de la fase A sin tocar) y `despues-*` de portada (`inicio`; `taller` es la misma pantalla tras la fusión), órdenes, lista, orden, nueva, clientes, cliente, equipo y solicitudes a 1440/768/360 en claro y oscuro (68 de «después»). «Antes» no está completo: sobre todo 1440 claro, más 768 y 360 de portada, órdenes, orden, clientes y equipo (la primera tanda se cortó y no repetí las que quedaban). Además `despues-ficha-*` (portada con la ficha abierta), `despues-mecanico-*`, `despues-vacio-*` (taller sin órdenes) y, solo como `antes-*` a 1440 claro, Vehículos, Agenda, Analítica y Ajustes (las que no he rediseñado).

## 5. Limitaciones

- **Sin GPU real.** Todo el WebGL fue por software: no medí fotogramas ni la latencia de selección. El cristal (`backdrop-filter`) sobre una escena WebGL a sangre tampoco (pendiente desde la fase A).
- **Escena**: la leyenda del 3D se solapa con rótulos de coches cuando la lista está abierta y la maqueta queda pequeña a 1440×900 (es de experto-3d; la dejé tal cual). La cámara no tiene `focusInset.left`: el lienzo empieza a la derecha del dock (petición 31).
- **Tableta (768)**: la ficha es una hoja inferior y las misiones no se ven (solo las cifras); es a propósito, para no tapar la maqueta.
- **Tres pantallas con trabajo del otro agente** (Vehículos, Agenda, Analítica, Ajustes): no las rediseñé; queda por ver cómo quedan en el espacio del taller cuando él termine.
- `WorkshopHeader` se parece a `HudHeader` de `components/game/kit.tsx` (otro agente, particular): convendría unirlos en uno cuando ambos estén estables.
- `AppShell` conserva la rama heredada `flush` (la regex `/taller`); ya no se usa. No la quité para no tocar un archivo compartido en caliente.
- No probé la vista de **gerente** esta vez (la ficha y los importes de `manage` son los mismos que el propietario).
- **Datos de prueba**: el taller vacío creó en la BD `carcare` un usuario y un espacio nuevos («Taller Vacío» / «Taller Nuevo», `vacio…@carcare.test`). No toqué la demo.
- Mis servidores (:8042 y :5202) están apagados.

## 6. Siguiente paso propuesto

1. **qa-tester:** E2E de la portada (filtro, fila → `?orden=`, Escape → foco, misión → ficha, `/taller` → portada, el mecánico no ve importes, taller vacío) y pasada de axe en oscuro y a 360/768.
2. Medir con GPU real el cristal sobre el lienzo y la latencia de selección a 1440.
3. Cuando el otro frontend-react cierre Vehículos/Agenda/Analítica/Ajustes, repasarlos en el espacio del taller (borrar `.lacquer`, `Tilt` y `AppShell.flush`, y unificar `WorkshopHeader` con `HudHeader`).
4. Decidir con Alberto si el 3D debe pasar también por debajo del dock de cristal (petición 31).
