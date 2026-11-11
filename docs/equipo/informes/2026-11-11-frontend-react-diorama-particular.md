# Informe · frontend-react · Mundo «Diorama», fase B: pantallas del particular

Fecha: 11/11/2026 · Encargo de la sesión principal (pedido de Alberto: «que sea como un juego TODA la página en TODOS los usuarios») · Sin commits.

## 1. Objetivo

Llevar el mundo «Diorama» (fase A: tokens, `hud-panel`, `chunky`, `chip`, `Mission`, `Progress` segmentado, `CanvasBleed`) a las pantallas del espacio `personal`: Inicio, Garaje, ficha del vehículo y sus pestañas, Agenda, Analítica, formularios, Ajustes, solicitudes y las pantallas de acceso. Reglas: nada de puntos, niveles ni cifras inventadas; todo sale de la API.

## 2. Qué hice

### Piezas nuevas (`components/game/kit.tsx`, `lib/missions.ts`)
- `HudHeader`: cabecera tipo HUD (panel de cristal con migas o enlace de vuelta, ficha, título, línea de estado, chips y acciones). Sustituye a `PageHeader` en las pantallas del particular.
- `GamePanel` (panel con título, icono y acción), `PanelLink`, `StatTile`/`StatRow` (cifra con su etiqueta; si falta el dato dice por qué y ofrece la acción, nunca un cero), `PaintToken` (ficha de arcilla con la pintura real del vehículo) y `EmptyBoard` (estado vacío con ilustración isométrica de maqueta, título, explicación y una acción).
- `mileageMissions()` (`lib/missions.ts`, con test): misión «Anota los km de X» para un vehículo activo **sin ninguna lectura** o con la última lectura de hace **30 días o más** (umbral de la interfaz, `STALE_MILEAGE_DAYS`; el texto muestra los días reales).

### Pantallas
- **Inicio** (`features/dashboard/PersonalDashboard.tsx`, reescrito; borrado `Showroom.tsx`, la placa ya no se usa): `CanvasBleed` con **`GarageScene`** de experto-3d (carga diferida, un solo `<Canvas>`), mapeando `display_name/plate/color_hex/body_type`, con `focusInset` según el ancho. Flotando encima: cabecera con chips de vencido, próximo y nº de vehículos y «Registrar» (la única primaria), ficha del vehículo elegido (con selector en chips: es también la alternativa accesible y 2D del lienzo), **Misiones** (recordatorios vencidos o próximos reales con barra segmentada del intervalo y acciones, más las misiones de kilometraje; «Todo al día» si no hay nada), cifras del mes (`StatRow`), lista de vehículos con chips de estado, gasto y último registrado. Sin WebGL no se monta la escena y la ficha enseña la miniatura estática. Con la guía «Primeros pasos» activa, esa guía ocupa el sitio de las misiones.
- **Primeros pasos** (`components/vehicles/FirstSteps.tsx`): barra segmentada con los pasos hechos y cada paso como tarjeta de misión (icono, `aria-current`, «Hecho»). Lo comparte el taller.
- **Garaje**: `HudHeader` con chips de filtro «Activos / Archivados» (sustituyen al enlace del pie) y recuento; barra de herramientas en `hud-bar`; `VehicleCard` rehecha (ficha de pintura, miniatura estática sobre plataforma, chips de estado con icono y texto, sube al pasar el ratón); estados vacíos con `EmptyBoard`.
- **Ficha del vehículo**: cabecera HUD con `PaintToken`; pestañas como píldoras en una `hud-bar` (conservan el desbordamiento a «Más»); Resumen con **Pendiente como misiones**, Kilometraje y «Desde el último» en `GamePanel`, mapa de zonas en panel; Historial, Gastos y Datos dentro de paneles; Recordatorios como misiones con filtro y barra en `hud-bar` y estado vacío con ilustración.
- **Agenda**: filtros en `hud-bar`, recordatorios y calendario del día como misiones.
- **Analítica**: cifras en `StatRow`, bloques en paneles, gráfico sin caja propia.
- **Formularios** (vehículo e intervención): el formulario en un panel; el paso actual del alta con barra gorda.
- **Solicitudes, Ajustes y Directorio**: `HudHeader` y `EmptyBoard`. Los diálogos heredan el `Dialog` de la fase A.
- **Acceso** (entrar, registro, recuperar, restablecer): `AuthLayout` con panel de cristal y, en escritorio, la maqueta del coche (imagen fija `HeroImage`, sin WebGL).
- `index.css`: `.list-flat` (lista plana dentro de un panel) y `.hud-panel .list-panel` (una lista en caja dentro de un panel pierde su caja propia).
- `ReminderItem`/`ReminderList`: variante `mission` (compatible: por defecto sigue igual).

### Correcciones de accesibilidad en componentes compartidos (aviso al otro agente)
Axe encontró fallos reales que también afectan al taller; los arreglé con cambios compatibles:
- `VehicleDock` (el nombre accesible no incluía el texto visible; solo se pone `aria-label` en el dock estrecho).
- `WorkspaceSwitcher` y `UserMenu` (WCAG 2.5.3: el nombre accesible debe contener el texto visible).
- `ReminderItem`: el enlace al vehículo se distinguía solo por color (ahora subrayado) y «Marcar hecho» no coincidía con su `aria-label`.
- `ZoneMap`: los botones de la lista de zonas, mismo caso.

## 3. Archivos tocados

Nuevos: `components/game/kit.tsx`, `lib/missions.ts`, `lib/missions.test.ts`.
Reescritos o muy modificados: `features/dashboard/PersonalDashboard.tsx`, `features/garage/GaragePage.tsx`, `components/vehicles/VehicleCard.tsx`, `features/vehicle/VehicleDetailPage.tsx`, `features/vehicle/tabs/{OverviewTab, RemindersTab, HistoryTab, ExpensesTab, DataTab}.tsx`, `features/auth/AuthLayout.tsx`, `components/vehicles/FirstSteps.tsx`.
Retocados: `features/agenda/{AgendaPage, AgendaCalendar}.tsx`, `features/analytics/{AnalyticsPage, parts}.tsx`, `features/settings/SettingsPage.tsx`, `features/requests/{Directory, MyRequests, NewRequest, RequestDetail}Page.tsx`, `features/vehicle/{VehicleFormPage, DocumentsSection}.tsx`, `features/vehicle/history/{Records, Journal, Mileage}View.tsx`, `features/vehicle/tabs/OrdersTab.tsx`, `features/maintenance/MaintenanceFormPage.tsx`, `components/vehicles/{ReminderItem, ZoneMap}.tsx`, `index.css`.
En zona compartida (cambios mínimos, ver §2): `components/layout/{VehicleDock, WorkspaceSwitcher, UserMenu}.tsx`.
Borrado: `features/dashboard/Showroom.tsx` (sin uso tras el nuevo Inicio).
Dependencias nuevas: ninguna. No toqué `frontend/src/three/` ni `features/workshop`.

## 4. Evidencias

Desde `frontend/`, 11/11/2026, al final:
- `npm run typecheck`: 0 errores.
- `npm run lint`: 0 errores, 75 avisos (los anteriores de `three/`, `CommandPalette`, `LineItemsEditor`, etc.; de mi trabajo solo el de `Date` durante el render en dos archivos que ya lo tenían).
- `npx vitest run`: 22 archivos, 188 tests en verde (incluye `missions.test.ts`).
- `npm run build`: correcto; el chunk de three.js sigue aparte.
- **axe-core 4.x (WCAG 2.0/2.1 A y AA)** sobre entrar, Inicio, Garaje, ficha (Resumen y Recordatorios) y Agenda, en claro y oscuro a 1280 px: **0 violaciones** (`axe-resultado.txt`; `axe-resultado-1.txt` es la primera pasada, con las violaciones que arreglé; `axe.cjs` lo reproduce).
- Capturas en `2026-11-11-frontend-react-diorama-particular/`: `antes-*` (estado tras la fase A, con el código anterior de las pantallas) y `despues-*` de Inicio, Garaje, ficha, historial, agenda, analítica, ajustes, alta de vehículo y entrar a 1440, 768 y 360 en claro y a 1440 y 360 en oscuro (Inicio, Garaje, ficha, Agenda y entrar), más `despues-ficha-gastos/datos`, y `gl-inicio-light-1440/360` con la escena 3D real. `capturar.cjs` las genera.
- Probado contra la API real (PHP :8041, Vite :5201, datos demo `demo@carcare.test`): carga de todas las pantallas anteriores. No probé a mano el envío de los diálogos ni la creación de un coche en esta pasada (los diálogos no cambian de lógica).

## 5. Limitaciones

- **Antes a 768**: copiado del informe de la fase A (`rev-*-768`, mismo estado de las pantallas) y solo para Inicio, Garaje y ficha; el resto de «antes» a 768 y el oscuro a 360 no los tengo. Las «antes» de las pantallas sin 3D se hicieron sin WebGL (como las «después», salvo `gl-*`): el renderizado por software tarda ~50 s por captura.
- No he visto la escena 3D en GPU real, solo con SwiftShader. A 360 px el hueco por el que se ve el garaje es pequeño (30 % del alto); queda por ajustar con GPU real y con `focusInset` fino (experto-3d).
- Pantallas que **no** rediseñé a fondo (heredan paneles, botones y tipografía del sistema): Documentos y los diálogos por dentro, Informe imprimible (a propósito, es de impresión), solicitudes (detalle y alta: solo cabecera y vacíos), 404 y error de ruta.
- `.hud-panel .list-panel` aplana toda lista en caja dentro de un panel, también en pantallas del taller si las hubiera.
- Quedan `.lacquer`, `.paint-wipe`, `Tilt` y `.scene` en la portada y en `Screenshot`; su retirada es de la limpieza de la fase A.
- MySQL estaba parado al reanudar (reinicio del equipo) y lo arranqué con `mysqld` de XAMPP; sigue encendido (lo comparten todos los agentes). Además `node_modules` estaba a medias (otro `npm install` interrumpido por Vite con el binario de rolldown bloqueado): repetí `npm install` y quedó entero; queda una carpeta residual `node_modules/@rolldown/.binding-win32-x64-msvc-*` que Windows no deja borrar mientras haya servidores Vite abiertos.

## 6. Siguiente paso propuesto

1. qa-tester: pasada de teclado sobre el selector de vehículo del Inicio y las pestañas píldora de la ficha; axe sobre Documentos, formularios y los diálogos.
2. experto-3d: GPU real, encuadre a 360 px y que el «cargando» de `GarageScene` no pinte caja (lo anulo con CSS en Inicio).
3. Retirar lo heredado de la fase A cuando el taller termine (`.lacquer`, `Tilt`, `PageHeader` en desuso).
