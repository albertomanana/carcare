# frontend-react · CarCare más intuitiva: menú, primeros pasos y formularios (10/11/2026)

**Encargo** (sesión principal, pedido por Alberto): «quiero que la página sea mucho más intuitiva para todos los usuarios». Lo más confuso según él: (1) menú y navegación, (2) primeros pasos, (3) formularios. Primero auditar con las cuentas demo y una cuenta nueva a 1280 y 360 px; después arreglar lo que más gente notará, sin tocar el mundo «Carta de colores» (`DESIGN.md`), ni la vista Taller 3D, ni `src/three/`.

**Sin commits** (los hace la sesión que dirige). Capturas, antes y después, en [`2026-11-10-frontend-react-intuitiva/`](2026-11-10-frontend-react-intuitiva/), junto con los tres guiones de Playwright con los que se hicieron (`audit.cjs`, `flow.cjs` y `rail.cjs`).

---

## 1. Auditoría (antes)

Recorrido contra la API real en una instancia aislada (API :8044 con OPcache y Vite :5197, BD `carcare` con la demo), con `demo@`, `taller@`, `mecanico@`, una cuenta particular nueva y un taller nuevo, registrados en el momento. 36 capturas `antes-*.png`.

| # | Dónde | Qué confunde (evidencia) | Qué se esperaba | Gravedad |
|---|-------|--------------------------|-----------------|----------|
| A1 | Barra lateral del taller | 9 entradas planas sin agrupar: «Centro de control», «Órdenes», «Solicitudes», «Clientes», «Vehículos», «Taller 3D», «Agenda de flota», «Equipo», «Analítica» ([`antes-taller-1280-inicio`](2026-11-10-frontend-react-intuitiva/antes-taller-1280-inicio.png)) | Grupos por tarea y los nombres de lo que se busca («Inicio», «Taller») | Alta |
| A2 | Ficha de un vehículo, formularios del coche | **Ninguna sección de la barra marcada como activa** al entrar en `/vehiculos/12/gastos` ([`antes-demo-1280-ficha-gastos`](2026-11-10-frontend-react-intuitiva/antes-demo-1280-ficha-gastos.png)): la ruta no cuelga de `/garaje` | «Garaje» (o «Vehículos» en el taller) marcado | Alta |
| A3 | Barra estrecha (768‑1023 px) | Solo iconos y **sin tooltip**: el `title` solo salía con la barra plegada a mano, no en tableta | Nombre y qué hay dentro al pasar el ratón o llegar con el teclado | Media |
| A4 | Barra inferior del móvil | En «Equipo», «Analítica» o «Solicitudes» no se marca nada abajo; la hoja «Más» es una lista sin descripción | Saber dónde estás | Media |
| A5 | Selector de espacio | Solo dice «Mi garaje ▾» o «Taller Demo ▾»: ni el tipo ni qué cambia al pasar al otro ([`antes-taller-1280-espacios`](2026-11-10-frontend-react-intuitiva/antes-taller-1280-espacios.png)) | «Taller · Propietario» a la vista y qué se ve en cada espacio | Alta |
| A6 | Particular: «Talleres» y «Solicitudes» | Dos entradas sin pista de la diferencia (directorio frente a mis peticiones) | Nombres que lo digan | Media |
| A7 | Pantallas de segundo nivel | Solo «← Garaje»; en la ficha no se sabe en qué pestaña ni de qué coche cuelga un formulario | Migas «Garaje › Kia Sportage › Gastos» | Media |
| P1 | Inicio de una cuenta nueva | Un estado vacío con un botón, sin decir qué viene después ([`antes-nuevo-1280-inicio`](2026-11-10-frontend-react-intuitiva/antes-nuevo-1280-inicio.png)) | El camino completo: coche → km → recordatorio, con «Paso 1 de 3» | Alta |
| P2 | Inicio con el coche recién creado | La guía antigua enseñaba **los 3 pasos a la vez, cada uno con su botón** (5 botones), más «Registrar ▾» arriba | Una sola acción principal | Alta |
| P3 | Taller nuevo | «Centro de control» con «Nada va tarde», 4 elevadores libres y «Sin alertas»: nada dice por dónde empezar ([`antes-nuevotaller-1280-inicio`](2026-11-10-frontend-react-intuitiva/antes-nuevotaller-1280-inicio.png)) | Elevadores → primer cliente → primera orden | Alta |
| F1 | Todos los campos de km | El marcador de posición **«0 km» parece un valor ya puesto** ([`antes-demo-1280-intervencion`](2026-11-10-frontend-react-intuitiva/antes-demo-1280-intervencion.png)) | Vacío, con el ejemplo en la ayuda | Alta |
| F2 | Alta de vehículo, «Año» | El marcador «2026» parece rellenado ([`antes-nuevo-1280-vehiculo-nuevo`](2026-11-10-frontend-react-intuitiva/antes-nuevo-1280-vehiculo-nuevo.png)) | «P. ej. 2019» y para qué sirve | Media |
| F3 | Alta de vehículo, «Siguiente» con error | Solo parpadean las luces del coche 3D; el foco se queda en el botón y el error puede quedar fuera de la vista | Foco al primer campo con error | Alta |
| F4 | Alta de vehículo | Barra de pasos sin «Paso X de 4»; el botón final dice «Añadir vehículo» como el título | Progreso a la vista y «Guardar coche» | Media |
| F5 | Matrícula y VIN | Sin ejemplo; el VIN no dice dónde encontrarlo; error «Solo letras y números (entre 2 y 12)» | Ejemplo y dónde se mira | Media |
| F6 | Nuevo recordatorio | Zona, repetición y notas al mismo nivel que lo obligatorio; «Cada (km)» sin ejemplo | Lo opcional plegado en «Más detalles» | Media |
| F7 | «Intervención» | Jerga: en el menú «Registrar ▾» de escritorio no se explica | «(revisión, reparación, ITV…)» la primera vez | Baja |
| F8 | Títulos de diálogo | «Actualizar kilometraje» frente a «Anotar km» en botones y enlaces | Un solo verbo | Baja |

Lo que ya estaba bien y no se tocó: aviso de cambios sin guardar, fecha de hoy por defecto, «Usar 56.212 km», errores junto al campo con icono, validación del servidor por campo, «Más opciones» de la nueva orden, chips de «¿Qué se hizo?».

---

## 2. Qué se ha hecho (después)

### 2.1 Menú y navegación

- **`components/layout/nav.ts`**: grupos por tarea (`navGroups`) y cada sección con `description` y `keywords`.
  - Taller: **Día a día** (Inicio, Órdenes, Taller, Solicitudes) · **Clientes y vehículos** (Clientes, Vehículos, Agenda) · **Gestión** (Equipo, Analítica).
  - Particular: Inicio, Garaje, Agenda y Analítica, más un grupo **Talleres** con «Buscar taller» y «Mis solicitudes».
  - Las rutas no cambian. «Taller 3D» → «Taller» **solo en la etiqueta** del menú (la pantalla no se ha tocado).
  - `isNavItemActive` con rutas `also`: la ficha y los formularios del vehículo marcan «Garaje»/«Vehículos» (A2).
- **`AppShell.tsx`**: los grupos llevan encabezado en la barra ancha y una línea fina en la estrecha (con el nombre para lectores de pantalla). Con solo iconos (plegada **o** de 768 a 1023 px, `useMediaQuery`), cada enlace lleva un **tooltip de Radix con el nombre y la descripción**, que también sale al llegar con el teclado (A3). La sección activa lleva `aria-current="page"`.
- **`MobileNav.tsx`**: la sección activa cuenta las rutas `also`. «Más» se marca cuando estás en una de sus secciones. La hoja «Más» repite los grupos con la descripción de cada sección y «Estás aquí» (con palabra, no solo con fondo) (A4). «Orden de trabajo» lleva descripción en «Registrar».
- **`CommandPalette.tsx`**: «Ir a» enseña la descripción y busca por los nombres antiguos («centro de control», «taller 3d», «agenda de flota»). «Actualizar kilometraje» → «Anotar kilómetros», e «Intervención» con «Revisión, reparación, ITV…».
- **`WorkspaceSwitcher.tsx`**: el botón dice el nombre y debajo el tipo («Particular» o «Taller · Propietario»), con su icono. En el menú, cada espacio dice qué ves en él («Tus coches: kilómetros, gastos y avisos» frente a «Clientes, órdenes de trabajo, elevadores y equipo»). Al cambiar, un aviso confirma «Ahora estás en Taller Demo» (A5).
- **Migas de pan**: componente nuevo `components/ui/Breadcrumbs.tsx` y prop `crumbs` en `PageHeader`. En el móvil queda solo «← paso anterior». Van en la ficha («Garaje › Kia Sportage › Gastos»; en el Resumen, «Garaje › Kia Sportage»), en el alta y la edición del vehículo, en la intervención («Garaje › Coche › Historial › Nueva intervención»), en la nueva orden, en el detalle de la orden y del cliente, y en los archivados (A7).
- **Títulos alineados con el menú**: el Inicio del taller pasa de «Centro de control» a «Inicio». También cambian «Agenda» (antes «Agenda de flota»), «Buscar taller» y «Mis solicitudes» (A6). En el Inicio del taller, «Ver Taller 3D» pasa a «Ver el taller» y «Agenda de flota» a «Ver la agenda».

### 2.2 Primeros pasos

- **`lib/firstSteps.ts`** rehecho: cada función devuelve la lista completa con lo hecho y lo pendiente, o `null` si la guía ya no aplica.
  - `dashboardFirstSteps`: coche → km → recordatorio.
  - `vehicleFirstSteps`: km → intervención o recordatorio → repostaje, en el mismo orden que Inicio.
  - `workshopFirstSteps`: elevadores → cliente → orden.
  - `currentStep` dice cuál toca.
- **`components/vehicles/FirstSteps.tsx`** rehecho como `FirstStepsGuide`: «Paso X de 3 · N hechos» con `aria-live`, una barra de tramos en tinta (el azul queda para la acción) y la lista de pasos. **Solo el paso que toca enseña su frase de por qué y su botón**. Lo hecho lleva icono y «Hecho»; lo que falta, solo su nombre. Botón «Ocultar guía», con «Deshacer» en el aviso (`hooks/useHiddenGuide.ts`, guardado en el navegador por espacio o por vehículo).
- **Inicio del particular** (`PersonalDashboard.tsx`): sin vehículos, la guía es la pantalla («Añadir mi coche»). Con coche, va junto a la placa, y en el móvil **antes** que la placa. Mientras se ve, no sale «Registrar ▾»: el paso es la única acción principal (R1). El paso 3 ofrece además, en texto, «o anota la última revisión o reparación».
- **Ficha** (`OverviewTab.tsx`): la misma guía con botones normales, porque ahí la acción principal es «Registrar ▾» (R1). Explica qué es una intervención.
- **Taller nuevo** (`WorkshopDashboard.tsx`, solo con `manage`):
  1. «Indica cuántos elevadores tiene el taller», con «Cambiar los elevadores», que abre directamente el diálogo «Ajustes del taller» con `?ajustar=<id>` (nuevo en `WorkspacesCard.tsx`), o «Son 4, está bien».
  2. «Da de alta tu primer cliente» (`clientes?nuevo=1`).
  3. «Abre tu primera orden».

  Mientras dura, «Requiere atención» y «Alertas de flota» (vacías) no se pintan. El mecánico no ve la guía. Todo usa rutas y datos que ya existían (`counts.customers`, `orders_by_status`, `bays`). El único dato nuevo es local: la confirmación de los elevadores, en el navegador, porque la API no tiene un «hecho» para eso (ver pregunta 14).

### 2.3 Formularios

- **`MileageInput`**: fuera el «0» de ejemplo en todos los campos de km (F1). El ejemplo va en la ayuda: «p. ej. 45.230».
- **Alta de vehículo** (`VehicleFormPage.tsx`):
  - «Paso 1 de 4: Vehículo · opcional» visible y anunciado.
  - Foco al primer campo con error al pulsar «Siguiente» (`trigger(…, { shouldFocus: true })`); con un 422 del servidor en otro paso, cambia de paso y lleva el foco al campo (F3).
  - Botón final «Guardar coche» («Guardar vehículo» en el taller) (F4).
  - Año: «P. ej. 2019» y para qué sirve (F2).
  - Matrícula: «P. ej. 1234 ABC…», con el error en llano.
  - VIN: «17 letras y números; viene en el permiso de circulación (casilla E)». Km de compra: «si no lo sabes, déjalo vacío». Km de hoy, con ejemplo (F5).
  - La descripción dice qué es obligatorio (los marcados con *).
- **Nuevo recordatorio** (`ReminderDialog.tsx`): arriba, tipo y título; después, «¿Cuándo vence?» con su ejemplo de km («Ahora marca 79.058 km: escribe a cuántos km vence, p. ej. 94.058 km»). Zona, repetición (con ejemplos: 12 meses, 15.000 km) y notas van plegadas en **«Más detalles»**, que cerrado resume lo que hay dentro («General · sin repetir») y se abre solo si hay un error dentro (F6).
- **Gasto** (`ExpenseDialog.tsx`): el botón dice «Guardar repostaje» o «Guardar gasto»; importe «Con IVA, p. ej. 54,90»; ayuda de km en llano.
- **Kilometraje** (`MileageDialog.tsx`, `QuickActionsProvider.tsx`): el título pasa a «Anotar kilómetros» (F8) y el campo lleva ejemplo.
- **Intervención** (`MaintenanceFormPage.tsx`): la descripción explica qué es («una revisión, una reparación, la ITV…») y qué es obligatorio; km con ejemplo. En los menús «Registrar ▾» (Inicio y ficha), «Intervención» lleva «Revisión, reparación, ITV…» (F7).
- **Nueva orden** (`NewOrderPage.tsx`, `NewOrderVehicle.tsx`, `newOrderForm.ts`): la descripción dice qué es obligatorio; km de entrada y matrícula con ejemplo; error de matrícula en llano.
- **Validación**: las reglas del cliente no cambian de límites (contrato §3.3: matrícula 2‑12 alfanuméricos normalizada, VIN 17 sin I/O/Q, km 0‑2.000.000, año 1900…actual+1, recurrencia 1‑120 meses). Solo cambian los textos.

---

## 3. Archivos

**Nuevos:** `components/ui/Breadcrumbs.tsx`, `components/layout/nav.test.ts`, `hooks/useMediaQuery.ts`, `hooks/useHiddenGuide.ts`.

**Modificados:**
- Navegación: `components/layout/{nav.ts, AppShell.tsx, MobileNav.tsx, CommandPalette.tsx, WorkspaceSwitcher.tsx}`, `components/ui/{PageHeader.tsx, inputs.tsx}`.
- Primeros pasos: `components/vehicles/FirstSteps.tsx`, `lib/{firstSteps.ts, firstSteps.test.ts, storage.ts}`, `features/dashboard/{PersonalDashboard.tsx, WorkshopDashboard.tsx}`.
- Ficha y garaje: `features/vehicle/{VehicleDetailPage.tsx, VehicleFormPage.tsx, tabs/OverviewTab.tsx, dialogs/ExpenseDialog.tsx, dialogs/MileageDialog.tsx, dialogs/ReminderDialog.tsx}`, `features/maintenance/MaintenanceFormPage.tsx`, `features/garage/GaragePage.tsx`, `features/quick-actions/QuickActionsProvider.tsx`.
- Taller: `features/workshop/{NewOrderPage.tsx, OrderDetailPage.tsx, CustomerDetailPage.tsx, components/NewOrderVehicle.tsx, components/newOrderForm.ts}`, `features/settings/WorkspacesCard.tsx`.
- Agenda y solicitudes: `features/agenda/AgendaPage.tsx`, `features/requests/{DirectoryPage.tsx, MyRequestsPage.tsx, NewRequestPage.tsx, RequestDetailPage.tsx}`.

Todo está dentro de `frontend/` (mi zona). **No toqué** `src/three/`, `WorkshopFloorPage.tsx`, `FloorPanel.tsx`, `floor.ts`, `api/types.ts` ni el backend. Los cambios de `LoginPage.tsx`, `guards.tsx`, `lib/navigation.ts`, `package.json` y los de la vista Taller que hay en el árbol son de otras sesiones y los he dejado como estaban. Sin dependencias nuevas.

---

## 4. Evidencias

Comandos desde `frontend/`, todos en la versión final:

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` (`tsc -b`) | Sin errores |
| `npm run lint` | Salida 0. 74 avisos, todos anteriores (`react-hook-form` «incompatible-library», `three/`, `CommandPalette`…). El único que añadí (exportar el hook desde `FirstSteps.tsx`) lo quité moviendo `useHiddenGuide` a `hooks/` |
| `npm run test` | **19 archivos, 154 tests, todos bien**. Los de `firstSteps` se reescribieron (12, con el taller) y `nav.test.ts` es nuevo (6) |
| `npm run build` | `✓ built in 4.92s` (el aviso de trozos de más de 500 kB es el de siempre: three, catálogo y gráficos) |

**Contra la API real** (instancia aislada :8044 + :5197):

- `flow.cjs` (cuenta particular nueva y taller nuevo, registrados en el momento). **21/21 bien a 1280 en claro y 16/16 a 360 en oscuro**:
  - «Paso 1 de 3» y una sola acción principal en el Inicio vacío;
  - alta del coche con «Paso 1 de 4», foco en «Marca» al pulsar «Siguiente» vacío y el error junto al campo;
  - km en el paso 4 y botón «Guardar coche»;
  - en la ficha nueva, las migas y «Garaje» activo en la barra (en el móvil, «← Garaje»);
  - de vuelta en Inicio, «Paso 3 de 3» sin «Registrar ▾»; «Ocultar guía» deja ver «Pendiente»;
  - taller nuevo: «Inicio», «Paso 1 de 3»; «Son 4, está bien» lleva a «Paso 2 de 3»; `?ajustar` abre «Ajustes del taller»; los tres grupos están en la barra.
- `rail.cjs` (cuenta `taller@`). **4/4 bien**:
  - a 768, el tooltip «Órdenes · El tablero de trabajos, de la entrada a la entrega» sale al enfocar con el teclado;
  - en la ficha, «Vehículos» queda activo;
  - a 360, en «Equipo», «Más» se marca y la hoja dice «Estás aquí».
- `audit.cjs`: capturas «después» con `demo@`, `taller@` y la cuenta nueva a 1280 y 360. Además, el menú «Registrar ▾» y el diálogo de recordatorio: al enviarlo vacío, el foco va a «Fecha» y salen los dos errores.

Capturas clave del después:
- [Inicio vacío con la guía](2026-11-10-frontend-react-intuitiva/despues-nuevo-1280-inicio.png).
- [Inicio, paso 3](2026-11-10-frontend-react-intuitiva/despues-flujo-1280-light-p5-inicio-paso3.png).
- [Taller nuevo](2026-11-10-frontend-react-intuitiva/despues-flujo-1280-light-t1-inicio-taller.png) y [en oscuro a 360](2026-11-10-frontend-react-intuitiva/despues-flujo-360-dark-t1-inicio-taller.png).
- [Migas y «Garaje» activo](2026-11-10-frontend-react-intuitiva/despues-demo-1280-ficha-gastos.png).
- [Selector de espacio](2026-11-10-frontend-react-intuitiva/despues-taller-1280-espacios.png).
- [Tooltip a 768](2026-11-10-frontend-react-intuitiva/despues-taller-768-tooltip.png).
- [Hoja «Más»](2026-11-10-frontend-react-intuitiva/despues-taller-360-mas-equipo.png).
- [Error y foco en el alta](2026-11-10-frontend-react-intuitiva/despues-flujo-1280-light-p2-alta-error.png).
- [Recordatorio con «Más detalles»](2026-11-10-frontend-react-intuitiva/despues-demo-1280-recordatorio-error.png).

---

## 5. Limitaciones

- **768 px** solo se probó en el taller (tooltip y sección activa). Las demás pantallas, a 1280 y 360. El oscuro se vio a 360 (flujo completo), no a 1280.
- Una vez ocultada la guía, solo vuelve con «Deshacer» del aviso o borrando `carcare.firstSteps.hidden.*` del navegador: no hay un «Mostrar la guía» en Ajustes.
- La confirmación «Son 4, está bien» se guarda **en el navegador** (no hay un campo en la API). En otro navegador, el paso 1 vuelve a salir hasta que haya un cliente.
- La vista 3D sigue titulándose «Taller 3D» (h1 y título de pestaña en `WorkshopFloorPage.tsx`, que no podía tocar), mientras que el menú dice «Taller». Lo pido en el tablero (petición 28).
- No probé con un lector de pantalla real, solo la estructura: `aria-current`, `aria-live`, encabezados de grupo, `nav` con nombre y foco.
- Las capturas `antes-*` del mecánico y de la nueva orden en el taller pueden mostrar esqueletos: el servidor PHP atiende de una en una y algunas tardaron más de 25 s.

## 6. Siguiente paso propuesto

1. Que la vista Taller cambie su h1 a «Taller» (petición 28).
2. «Mostrar la guía de primeros pasos» en Ajustes → Apariencia, si Alberto lo quiere.
3. Pasar `@axe-core/playwright` (ya instalado) por Inicio, alta de vehículo y nueva orden a 360 y 1280 (qa-tester).
4. Revisar con la misma vara los diálogos que no entraron: posponer y completar un recordatorio, subir un documento y el cliente del taller.
