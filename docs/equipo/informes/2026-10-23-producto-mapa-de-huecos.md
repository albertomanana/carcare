# Informe — producto — mapa de huecos (2026-10-23)

> Estado del informe: **terminado** (2026-10-23).

## 1. Objetivo

Encargo de la sesión principal (tarea 21 de `docs/equipo/AUTOPILOTO.md`). Alberto dice que "aún hay espacios que están vacíos" y quiere completarlos. Hay que:

1. contrastar el backlog (E0‑E15) con la app real;
2. listar los "espacios vacíos" que Alberto ve;
3. convertir lo que falta en tareas priorizadas para la cola del piloto;
4. actualizar el backlog.

No duplica a los agentes en marcha:

- disenador-ux: plan de simplificación (tarea 16);
- frontend-react: Analítica (tarea 17);
- backend-laravel: datos demo y rendimiento (tarea 19);
- experto-3d: rendimiento del 3D (tarea 20).

## 2. Método y límites

- **Fuentes leídas:**
  - `frontend/src/app/router.tsx` y `frontend/src/components/layout/nav.ts`, `MobileNav.tsx`, `CommandPalette.tsx`;
  - todas las pantallas de `frontend/src/features/**` (dashboard, garaje, ficha y sus 8 pestañas, formularios, agenda, informe, ajustes, órdenes, clientes, equipo, taller 3D y portada);
  - `frontend/src/three/index.tsx` y `three/types.ts`;
  - `frontend/src/api/types.ts`, `backend/routes/api.php` (68 rutas) y `docs/api/contrato-v1.md`;
  - los informes de `docs/equipo/informes/`. Los de las tareas 17, 19 y 20 todavía estaban a medio escribir.
- **No he ejecutado la app ni los tests.** No tengo terminal en este encargo, y además la regla es no tocar código. El estado sale de leer el código y los informes. Por eso uso **"Construido"** y no "Hecho":
  - **Construido** significa que el flujo está en la app contra la API real y que el backend tiene tests (462 en verde según el [informe del backend](2026-10-23-backend-laravel-api-v1.md));
  - **Hecho** exige la definición de terminado completa (E2E, axe, 360/768/1280 px), que hoy no se ha verificado en ninguna historia. Lo confirman las tareas 5, 6 y 8 de la cola.
- Estados usados:
  - `Construido`;
  - `A medias`;
  - `Falta`;
  - `En curso` (otro agente lo está haciendo ahora);
  - `Decide Alberto`.

## 3. Resultado en una tabla

**90 historias Must + Should** (las Could van aparte, al final del apartado 4):

| Estado | Nº | Historias |
|--------|---:|-----------|
| Construido | 71 | Casi todo el particular y el taller (detalle en el apartado 4) |
| A medias | 7 | E3‑3, E5‑7, E6‑4, E7‑1, E7‑5, E12‑8, E13‑7 |
| Falta | 8 | E0‑2, E1‑6, E6‑2, E6‑3, E6‑5, E6‑6, E11‑6, E15‑2 |
| En curso (otros agentes) | 4 | E6‑1 (tarea 19), E14‑7 (tarea 20), E15‑1 y E15‑3 (tarea 17) |

**Lectura rápida:**

- **Construcción:** la API está completa (68 rutas) y casi todas las pantallas existen y están conectadas. Lo que falta de construcción es poco: la Analítica (en curso), su variante de taller y unos pocos huecos pequeños.
- **Calidad (lo más grande que falta):** no hay E2E (no existe `frontend/e2e/`), ni auditoría axe, ni auditoría de seguridad, ni CI. Ya están en la cola (tareas 5‑11), así que no propongo tareas nuevas para eso.
- **Criterios revisados:** E0‑3, E4‑2 y E4‑3 pasan a `Construido` **porque he revisado su criterio**, no por código nuevo. El motivo está en el apartado 4.

## 4. Estado real por historia (Must y Should)

Rutas relativas a la raíz del repositorio. `f/` = `frontend/src/features/`.

### E0 · Base

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E0‑1 | Must | Construido | `README.md`, `iniciar-carcare.bat`, `scripts/servidor-api.cmd` | — |
| E0‑2 | Must | Falta | `.github/` solo tiene `pull_request_template.md` | Es la tarea 11 de la cola |
| E0‑3 | Must | Construido (criterio revisado) | `frontend/src/components/ui/*` (botones, campos, tarjetas, estados) | La "página de muestra" no existe (solo `/dev/3d` en `router.tsx`). No aporta al usuario: pasa a Could |

### E1 · Autenticación y perfil

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E1‑1, E1‑8 | Must | Construido | `f/auth/RegisterPage.tsx` (`account_type`, `workshop_name`); `backend/tests/Feature/AuthTest.php` | — |
| E1‑2 | Must | Construido | `f/auth/LoginPage.tsx`; `components/layout/UserMenu.tsx` (cerrar sesión) | — |
| E1‑3 | Must | Construido | `f/auth/guards.tsx` (`RequireAuth`) | — |
| E1‑4 | Must | Construido | `f/settings/AccountForms.tsx` | — |
| E1‑5 | Must | Construido | `backend/tests/Feature/IsolationTest.php` (215 casos) | — |
| E1‑6 | Should | **Falta · Decide Alberto (D17)** | Ninguna ruta en `backend/routes/api.php`; `LoginPage.tsx` no tiene el enlace | Necesita enviar correo |
| E1‑7 | Should | Construido | `f/settings/SettingsPage.tsx` (`DeleteAccountCard`) | — |

### E2 · Garaje

| ID | Prio | Estado | Evidencia |
|----|------|--------|-----------|
| E2‑1 | Must | Construido | `f/vehicle/VehicleFormPage.tsx` (4 pasos y vista previa 3D) |
| E2‑2 | Must | Construido | `f/garage/GaragePage.tsx` (búsqueda, orden, archivados), `components/vehicles/VehicleCard.tsx` |
| E2‑3 | Must | Construido | `f/vehicle/VehicleDetailPage.tsx`, `tabs/DataTab.tsx` ("Sin indicar") |
| E2‑4 | Must | Construido | `VehicleFormPage.tsx` (en edición no hay paso de km) |
| E2‑5 | Must | Construido | `VehicleDetailPage.tsx` (archivar y restaurar), `GaragePage.tsx` `?ver=archivados` |
| E2‑6 | Must | Construido | `f/vehicle/dialogs/MileageDialog.tsx`, `components/forms/MileageConflictNotice.tsx` |

### E3 · Intervenciones

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E3‑1, E3‑8 | Must | Construido | `f/maintenance/MaintenanceFormPage.tsx`, `lib/quickServices.ts` | — |
| E3‑2 | Must | Construido | `components/forms/LineItemsEditor.tsx` | — |
| E3‑3 | Must | **A medias** | `f/vehicle/tabs/HistoryTab.tsx` | Tiene filtros, búsqueda y orden. **No agrupa por año** (solo filtra por año) |
| E3‑4 | Must | Construido | `HistoryTab.tsx` | El detalle se despliega en la tarjeta: líneas, documentos y orden de origen |
| E3‑5 | Must | Construido | `HistoryTab.tsx` (editar, archivar y restaurar, filtro "Archivadas") | — |
| E3‑6 | Must | Construido | `HistoryTab.tsx` ("Cuenta como gasto"), `tabs/ExpensesTab.tsx` ("Desde su intervención"), `MaintenanceExpenseTest.php` | — |
| E3‑7 | Must | Construido | `MileageConflictNotice.tsx` | — |

### E4 · Gastos

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E4‑1 | Must | Construido | `f/vehicle/dialogs/ExpenseDialog.tsx` | — |
| E4‑2 | Must | Construido (criterio revisado) | `tabs/ExpensesTab.tsx`: 3 periodos (este año, últimos 12 meses, año pasado) y 1 categoría, guardados en la URL | El rango personalizado y la selección de varias categorías pasan a Could. Motivo: Alberto pidió una interfaz más simple, y la Analítica (tarea 17) ya filtra por periodo |
| E4‑3 | Must | Construido (criterio revisado) | `ExpensesTab.tsx`: el total y el reparto por categoría cambian con los filtros | Las 12 barras mensuales están en el Resumen (`tabs/OverviewTab.tsx`) y en la Cabina, no en esta pestaña. La suma exacta la prueba `AnalyticsTest.php` |
| E4‑4, E4‑5, E4‑6 | Must, Must, Should | Construido | `OverviewTab.tsx`, `ExpensesTab.tsx`, `PersonalDashboard.tsx` (`StatCard` con `reason` y `change_pct`) | — |

### E5 · Cabina del particular

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E5‑1 … E5‑6 | Must | Construido | `f/dashboard/PersonalDashboard.tsx`; acción rápida en `components/layout/MobileNav.tsx` | — |
| E5‑7 | Must | **A medias** | `PersonalDashboard.tsx` (`Onboarding`) | El inicio sin vehículos existe. **Falta la tarjeta guía para un vehículo sin datos**: hoy cada sección enseña su propio vacío |

### E6 · Calidad y entregables

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E6‑1 | Must | En curso | Tarea 19 ([informe en curso](2026-10-23-backend-laravel-demo-y-rendimiento.md)) | — |
| E6‑2 | Must | Falta | No existe `frontend/e2e/` | Tarea 6 |
| E6‑3 | Must | Falta | No hay ninguna auditoría axe | Tareas 6 y 8 |
| E6‑4 | Must | **A medias** | `docs/tfg/01…08`, contrato, ADR y `README.md` | Faltan el manual de usuario y el de instalación (tarea 10) |
| E6‑5 | Must | Falta | — | Tarea 7 |
| E6‑6 | Should | Falta | [`guion-prueba-usuarios.md`](../../../CarCare/06_investigacion/guion-prueba-usuarios.md) listo | Necesita a Alberto para las sesiones (T30) |

### E7 · Seguimiento diario

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E7‑1 | Must | **A medias** | `f/vehicle/tabs/JournalTab.tsx` (vista "Lecturas de km") | Tiene la lista, el origen y el borrado de las lecturas manuales. **Cada lectura no enlaza con su registro de origen**: `MileageLog` no trae `source_id` en `types.ts` (hay que cambiar el contrato) |
| E7‑2, E7‑3, E7‑4 | Must | Construido | `ExpenseDialog.tsx` (combustible), `StatCard` de consumo, `JournalTab.tsx` (día a día) | — |
| E7‑5 | Should | **A medias** | `OverviewTab.tsx` | Muestra los km del mes y la media diaria. **El km del año** (`summary.mileage.km_this_year`, `types.ts:561`) no se muestra en ninguna pantalla |

### E8 · Recordatorios y zonas

| ID | Prio | Estado | Evidencia |
|----|------|--------|-----------|
| E8‑1, E8‑2, E8‑3 | Must | Construido | `f/vehicle/dialogs/ReminderDialog.tsx`, `CompleteReminderDialog.tsx`, `components/vehicles/ReminderItem.tsx` |
| E8‑4 | Should | Construido | `f/vehicle/useReminderActions.tsx` (descartar y eliminar) |
| E8‑5 | Should | Construido | `f/agenda/AgendaPage.tsx` y `AgendaCalendar.tsx` |
| E8‑6 | Must | Construido | `components/vehicles/ZoneMap.tsx` (3D/2D, rayos X "Ilustrativo"), `three/index.tsx` (`CarViewer`, `ZoneMap2D`) |

### E9 · Documentos

| ID | Prio | Estado | Evidencia |
|----|------|--------|-----------|
| E9‑1, E9‑2, E9‑3 | Should | Construido | `f/vehicle/tabs/DocumentsTab.tsx`, `dialogs/DocumentUploadDialog.tsx` |

### E10 · Informe

| ID | Prio | Estado | Evidencia |
|----|------|--------|-----------|
| E10‑1, E10‑2 | Should | Construido | `f/report/ReportPage.tsx`: fecha de generación, aviso de datos no contrastados y botón "Imprimir / Guardar PDF" |

### E11 · Taller: clientes

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E11‑1 … E11‑5 | Must, Should | Construido | `f/workshop/CustomersPage.tsx`, `components/CustomerDialog.tsx`, `CustomerDetailPage.tsx`, `VehicleFormPage.tsx` (`customer_id`) | — |
| E11‑6 | Should | **Falta** | No hay ni exportar ni anonimizar en `CustomerDetailPage.tsx`, ni ruta en `api.php` | RGPD (T29) |

### E12 · Órdenes y elevadores

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E12‑1 … E12‑5 | Must | Construido | `NewOrderPage.tsx`, `components/KanbanBoard.tsx`, `OrderDetailPage.tsx` y `OrderTotals.tsx`, `BayPicker.tsx` (409), entrega → `maintenance_record_id` | — |
| E12‑6 | Should | Construido | `OrdersPage.tsx` ("Solo tarde"), `WorkshopDashboard.tsx` ("Tarde" y "Para hoy") | — |
| E12‑7 | Should | Construido | `WorkshopFloorPage.tsx` y `components/FloorPanel.tsx` (lista HTML), `Workshop2D` en `three/fallbacks.tsx` | — |
| E12‑8 | Should | **A medias** | `OrdersPage.tsx:123-132` | Hay un filtro "Mecánico" genérico. **No existe el atajo "Mis órdenes"** |

### E13 · Equipo y roles

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E13‑1 … E13‑5 | Must | Construido | `f/settings/WorkspacesCard.tsx` (crear taller, elevadores, IVA, salir), `f/workshop/TeamPage.tsx`, `components/layout/WorkspaceSwitcher.tsx`, `nav.ts` (`can('manage')`), `RolesTest.php` | — |
| E13‑6 | Should | Construido | `WorkspacesCard.tsx` ("Eliminar taller") | — |
| E13‑7 | Should | **A medias** | `TeamPage.tsx:306,320` | Solo enseña las 10 últimas acciones, **sin "ver más" ni filtro por vehículo**. La API ya admite las dos cosas (`?vehicle_id`, paginada) |

### E14 · 3D

| ID | Prio | Estado | Evidencia |
|----|------|--------|-----------|
| E14‑1 | Should | Construido | `f/landing/LandingPage.tsx` y `HeroScene`. Ojo: anuncia "Facturación" (ver apartado 5) |
| E14‑2, E14‑5 | Must | Construido | `three/index.tsx` (`CarViewer`, `CarThumbnail`) |
| E14‑3 | Should | Construido | `VehicleFormPage.tsx` (`CarPreview`) |
| E14‑6 | Must | Construido (sin probar con lector de pantalla) | `three/fallbacks.tsx`, `ZoneMap2D`, `Workshop2D` |
| E14‑7 | Must | En curso | Tarea 20 ([informe en curso](2026-10-23-experto-3d-rendimiento.md)) |

### E15 · Analítica

| ID | Prio | Estado | Evidencia | Nota |
|----|------|--------|-----------|------|
| E15‑1, E15‑3 | Must, Should | En curso | Tarea 17. Hoy, `f/analytics/AnalyticsPage.tsx:4` solo dice "Pantalla en preparación." | — |
| E15‑2 | Should | **Falta** | La API lo da (`types.ts:742-747`: entregadas, ticket medio, estancia, por cliente) | El [informe de la tarea 17](2026-10-23-frontend-react-analitica.md) solo habla del modo particular: **hay que confirmar si incluye el taller**. Si no, es T23 |

### Could (resumen)

- **Construidas:** E2‑7, E7‑6 y E14‑4 (rayos X con el rótulo "Ilustrativo").
- **A medias:** E14‑8. La prop `lighting: 'night'` existe en `three/types.ts:27`, pero ninguna pantalla la usa.
- **Faltan:** E8‑7, E8‑8, E9‑4, E10‑3, E10‑4, E12‑9, E12‑10, E13‑8 y E15‑4.
- **E12‑9 (resumen imprimible de la orden)** es la que más se nota en el taller: ver T24.

## 5. Espacios vacíos que Alberto puede ver

En orden de lo que más se nota:

1. **Analítica (particular) / "Facturación" (taller): la pantalla está vacía.**
   - Muestra solo "Pantalla en preparación." (`f/analytics/AnalyticsPage.tsx:4`).
   - Se llega desde 5 sitios:
     - el menú lateral (`nav.ts:40` y `:47`);
     - la hoja "Más" del móvil;
     - la paleta de comandos;
     - "Gasto mensual → Analítica" de la Cabina (`PersonalDashboard.tsx:101`);
     - "Importe de órdenes entregadas → Facturación" del Centro de control (`WorkshopDashboard.tsx:231-232`).
   - La tarea 17 cubre el particular. Para el taller, ver T23.
2. **"Facturación" promete algo que no existe.**
   - El menú del taller rotula "Facturación" (`nav.ts:40`).
   - La portada anuncia "Totales con IVA y facturación de las órdenes entregadas" (`LandingPage.tsx:259-260`).
   - Pero el propio Centro de control dice "no son facturas" (`WorkshopDashboard.tsx:228`) y D12 sigue sin decidir.
   - Esto incumple la regla 2 de `CLAUDE.md`. Ver T22 (no depende de D12) y la pregunta 1.
3. **La orden de trabajo no tiene nada que darle al cliente.**
   - `OrderDetailPage.tsx` calcula el subtotal, el IVA y el total, pero no se puede imprimir ni compartir. Para un taller, esto es "lo que falta de la facturación".
   - Corresponde a E12‑9 y depende de D12 (T24).
4. **Faltan las cifras de negocio del taller.** Ticket medio, estancia media y reparto por cliente: la API ya las da y no hay pantalla (E15‑2, T23).
5. **La pantalla de entrar no tiene "¿Has olvidado tu contraseña?".** Ver `LoginPage.tsx` (E1‑6). Depende de D17 (enviar correos): pregunta 3.
6. **La actividad del equipo se corta en 10 acciones**, sin "ver más" (`TeamPage.tsx:306`). Ver E13‑7 y T25.
7. **El mecánico no tiene "Mis órdenes".** Tiene que buscarse en el filtro "Mecánico" (`OrdersPage.tsx:123-132`). Ver E12‑8 y T25.
8. **Un coche recién dado de alta se ve como un montón de cajas vacías.** El Resumen (`OverviewTab.tsx`) enseña 5‑6 bloques de "sin datos" en lugar de una guía de primeros pasos (E5‑7, T26). Encaja con la simplificación que pide Alberto.
9. **Dato calculado que no se enseña:** los km del año (E7‑5, T26).
10. **Lecturas de km sin enlace a su origen.** Ver `JournalTab.tsx:317` (E7‑1, T27, prioridad baja).
11. **La ficha del cliente no tiene opciones de RGPD**, solo "Eliminar" (`CustomerDetailPage.tsx:113-124`). Ver E11‑6 y T29. No es un hueco que se vea, pero el tribunal puede preguntar por él.
12. **Pantallas vacías con las cuentas demo.** Por ejemplo, los documentos. Lo resuelve la tarea 19, en curso; no lo he comprobado en pantalla.

**Sin huecos (leído en el código):**

- Cabina, garaje, ficha (las 8 pestañas), formularios por pasos, agenda, informe imprimible y ajustes;
- tablero kanban, ficha de orden, nueva orden, clientes, equipo, taller 3D y portada.

En ninguna de estas pantallas he encontrado botones decorativos: todos los enlaces llevan a rutas que existen en `router.tsx`.

## 6. Tareas propuestas para la cola (no he editado `AUTOPILOTO.md`)

Numeración a partir de la 22, que es la primera libre. **Las de frontend deben coordinarse con el paso 2 de la tarea 16** (simplificación): tocan las mismas pantallas. Si el reparto del paso 2 ya existe, lo mejor es meter T22 y T26 dentro de él.

| # | Tarea | Agente | Zona de archivos | Tamaño | Depende de | Criterio de aceptación |
|---|-------|--------|------------------|:------:|------------|------------------------|
| 22 | **No prometer lo que no existe**: el menú, el enlace del Centro de control y la portada dejan de decir "Facturación" | frontend-react | `frontend/src/components/layout/nav.ts`, `features/dashboard/WorkshopDashboard.tsx` (solo el texto del enlace), `features/landing/LandingPage.tsx` (tarjeta "Facturación") | S | Ninguna. Es la regla 2 de `CLAUDE.md` y vale para cualquier opción de D12. Va dentro de la 16 o justo después | Dado el taller demo como owner, cuando recorro el menú (escritorio y móvil), la paleta de comandos, el Centro de control y la portada, entonces nada dice "Facturación" ni "facturas", salvo para aclarar que no se emiten. La entrada del menú se llama "Analítica" (o el nombre que fije D12) y lleva a la pantalla de la tarea 17. `grep -ri "facturaci" frontend/src` solo devuelve textos del tipo "no son facturas" |
| 23 | **Analítica del taller** (E15‑2), si la tarea 17 no la incluye | frontend-react | `frontend/src/features/analytics/**` | M | 17 (es el mismo archivo: después de ella o dentro de ella). Rótulos: "Importe de órdenes entregadas" mientras no se decida D12 | Dado el taller demo como owner o manager, cuando abro Analítica, entonces veo: el importe total, el nº de órdenes entregadas, el ticket medio, los días medios en el taller y el reparto por cliente. Todo sale de `GET /workspaces/{ws}/analytics` y no se inventa nada. Sin entregas en el periodo, el ticket y la estancia dicen "Aún no hay órdenes entregadas en este periodo". Un mechanic no ve la entrada y, si escribe la URL, ve un aviso de permiso (la API da 403). Sin desbordes a 360 y 1280 px |
| 24 | **Resumen imprimible de la orden** (E12‑9) | frontend-react (taller) | `frontend/src/features/workshop/**` (acción en `OrderDetailPage.tsx` + hoja de impresión) | M | **Decide Alberto (D12)**, si elige la opción A | Dada una orden con líneas, cuando un owner o manager pulsa "Imprimir resumen", entonces se imprime una hoja A4 (`window.print`, sin menús). Lleva el nombre del taller, el cliente, el vehículo, las líneas, el subtotal, el IVA y el total, iguales a los de la ficha, y el rótulo **"Resumen de la orden — no es una factura"**. El mechanic la imprime sin precios. Sin endpoints nuevos |
| 25 | **Taller: "Mis órdenes" y actividad completa** (E12‑8, E13‑7) | frontend-react (taller) | `features/workshop/OrdersPage.tsx`, `TeamPage.tsx`, `components/TeamActivity.tsx` | M | Ninguna | (a) Dado un mechanic con órdenes asignadas, cuando abre Órdenes, entonces "Mis órdenes" está activado por defecto y filtra por `assigned_to` = él, en el tablero y en la lista. Si lo desactiva, ve todas, y la elección queda en la URL. (b) Dado el taller demo, cuando abro Equipo, entonces la actividad tiene "Ver más" y se puede filtrar por vehículo (`?vehicle_id`). Sin actividad, se muestra un estado vacío |
| 26 | **Particular: primeros pasos, km del año e historial por año** (E5‑7, E7‑5, E3‑3) | frontend-react (particular) | `features/vehicle/tabs/OverviewTab.tsx`, `features/dashboard/PersonalDashboard.tsx`, `features/vehicle/tabs/HistoryTab.tsx` | S | 17: su informe dice que repasa el particular, así que antes hay que comprobar que no lo haya hecho ya. 16, paso 2: son los mismos archivos | (a) Dado un vehículo sin lecturas, intervenciones ni recordatorios, cuando abro su Resumen o la Cabina, entonces veo **una sola** tarjeta "Primeros pasos" en vez de varios vacíos. Tiene 3 acciones: anotar km, primer repostaje (solo si el usuario puede ver gastos) y primera intervención o recordatorio. Cada paso desaparece al hacerlo. (b) Si `km_this_year` no es null, se muestra; si es null, pone "Faltan lecturas para calcularlo". (c) El historial pone un encabezado por año |
| 27 | **Cada lectura de km enlaza con su origen** (E7‑1) | arquitecto → backend-laravel → frontend-react | `docs/api/contrato-v1.md` y `frontend/src/api/types.ts` (añadir `source_id` a `MileageLog`), el Resource del backend con su test de forma, y `JournalTab.tsx` | S | Que se apruebe el cambio de contrato. Prioridad baja | Dada una lectura con `source` = intervención, gasto, orden o recordatorio, cuando la veo en "Lecturas de km", entonces su origen es un enlace al registro. `ContractShapeTest` sigue en verde |
| 28 | **Recuperar la contraseña** (E1‑6) | arquitecto → backend-laravel → frontend-react | Contrato y `types.ts`; `backend/` (el password broker de Laravel); `features/auth/` (2 pantallas) | M | **Decide Alberto (D17)** | Se cumple el criterio E1‑6: misma respuesta exista o no la cuenta; enlace de un solo uso que caduca a los 60 min; límite de intentos. En local, el correo se escribe en `storage/logs` (`MAIL_MAILER=log`), sin servicio externo ni coste. Tests de éxito, token caducado, token reutilizado y 429 |
| 29 | **Derechos RGPD del cliente del taller** (E11‑6) | arquitecto → backend-laravel → frontend-react (taller) | Contrato y `types.ts`; `backend/` (2 rutas `manage`); `features/workshop/CustomerDetailPage.tsx` | M | Que se apruebe el cambio de contrato. Su prioridad depende de D6 y D9 | Dado un cliente, cuando un manager pulsa "Exportar datos", entonces descarga un JSON con sus datos, sus vehículos y sus órdenes. Cuando pulsa "Anonimizar" y lo confirma, entonces el nombre pasa a "Cliente anonimizado" y el email, el teléfono, el NIF y las notas quedan a null, pero el historial técnico de los vehículos se conserva. Mechanic ⇒ 403; otro espacio ⇒ 404 (tests) |
| 30 | **Preparar las pruebas con usuarios** (E6‑6) | producto (+ Alberto) | `CarCare/06_investigacion/` | S | 5 (integración). Alberto tiene que reclutar a la gente y estar en las sesiones | El guion está actualizado con tareas sobre pantallas reales. Hay una lista de 3‑5 particulares y 2‑3 talleres a los que Alberto pueda escribir y un texto de consentimiento. No se inventa ningún resultado |

**Lo que ya está en la cola y cubre huecos (no lo dupliqué):**

| Tarea | Cubre |
|-------|-------|
| 5 | Integración |
| 6 | E2E y axe: E6‑2, E6‑3 |
| 7 | Seguridad: E6‑5 |
| 8 | Revisión de UX |
| 10 | Manuales: E6‑4 |
| 11 | CI: E0‑2 |

**Orden recomendado:**

1. **22**: barata, se ve mucho y es una regla del proyecto.
2. **23**: es la otra mitad de la pantalla vacía.
3. **26** y **25**, en paralelo.
4. **24**, cuando Alberto responda a D12.
5. **28**, cuando responda a D17.
6. **29**.
7. **27**.
8. **30**, después de la tarea 5.

**Qué puede ir a la vez sin pisarse:**

| Carril | Tareas | Archivos | Choca con |
|--------|--------|----------|-----------|
| Frontend particular | 26 | `features/vehicle/tabs/*`, `features/dashboard/PersonalDashboard.tsx` | Tareas 16 y 17 (mismas pantallas): ir después de ellas |
| Frontend taller | 22 → 23 → 25 → 24 | `components/layout/nav.ts`, `features/landing/`, `features/analytics/`, `features/workshop/**` | 23 choca con 17 (mismo archivo) |
| Contrato y backend | La parte de servidor de 27, 28 y 29 | `docs/api/`, `frontend/src/api/types.ts` (arquitecto), `backend/**` | Ninguno de los frontend hasta llegar a la pantalla |
| 3D | Nada nuevo: tras la tarea 20 no queda ningún hueco 3D en Must ni Should | — | — |
| Producto | 30 | `CarCare/06_investigacion/` | Ninguno |

## 7. Preguntas para Alberto (escritas en el tablero, máximo 3)

1. **D12 · "Facturación" del taller.** Recomiendo la opción A: llamarla "Analítica" y añadir un resumen imprimible de la orden que diga "no es una factura".
2. **D6 + D9 · Fechas de entrega y defensa.** Sirven para decidir si los "deseables" (recuperar contraseña, RGPD de clientes, pruebas con usuarios) entran o se quedan como trabajo futuro. Recomiendo darlas ya; mientras tanto, se termina primero lo imprescindible.
3. **D17 · "¿Has olvidado tu contraseña?"** Recomiendo la opción A: correo solo en local (se guarda en un archivo de registro), sin servicio externo ni coste.

Siguen pendientes en el registro, pero no las repito en el tablero para no saturar: D1 (normativa de Ilerna), D15 (versiones de Node y PHP), D5, D13, D10, D11 y D14.

## 8. Archivos tocados

Todos están en mi zona (`CarCare/`), salvo el informe y el tablero, que el protocolo permite.

| Archivo | Cambio |
|---------|--------|
| `CarCare/02_backlog/backlog-mvp.md` | El estado real de las 90 historias Must y Should (y de las Could). La leyenda tiene estados nuevos (`Construido`, `A medias`, `Falta`, `Decide Alberto`) y `Hecho` sigue reservado a la definición de terminado. El resumen por épica y la nota del núcleo defendible están al día. Hay **3 criterios revisados**: E0‑3, E4‑2 y E4‑3; cada uno lleva una nota con la fecha y el motivo |
| `CarCare/02_backlog/E8-6-mapa-zonas-3d.md`, `E12-2-tablero-kanban-elevadores.md`, `E12-5-entrega-orden-crea-intervencion.md` | Solo la línea "Estado": pasa a `Construido`, con la evidencia |
| `CarCare/03_decisiones/registro-decisiones.md` | D17 nueva (envío de correos para recuperar la contraseña). Notas del 23/10 en D12 (ya es un hueco visible) y en D9 (lo que se recortaba ya está construido). El número siguiente pasa a D18 |
| `CarCare/01_plan/hoja-de-ruta.md` | Nuevo apartado "Dónde estamos (23/10/2026)". La oleada 1 pasa a "casi terminada". Nueva oleada 1e (propuesta). H2 y H3 al día |
| `docs/equipo/TABLERO.md` | Mi fila. 3 preguntas en "Preguntas para Alberto". 2 peticiones: a frontend-react (¿la tarea 17 incluye el taller?) y a la sesión principal (meter las tareas 22‑30 en la cola) |
| `docs/equipo/informes/2026-10-23-producto-mapa-de-huecos.md` | Este informe |

**No he tocado** código, `AUTOPILOTO.md`, `Car_Care_Documentacion/` ni ningún `.env`. No he hecho commits (regla 11).

## 9. Evidencias, limitaciones y siguiente paso

**Evidencias.** Es una revisión de lectura: no he ejecutado ningún comando. Lo comprobado:

- `router.tsx` declara 28 rutas de pantalla (incluidas las 8 pestañas de la ficha y sin contar `/dev/3d`). **Solo una es un marcador sin contenido:** `AnalyticsPage.tsx`, que devuelve únicamente `<PageHeader title="Analítica" description="Pantalla en preparación." />`.
- La búsqueda de `en preparaci|Próximamente|TODO|FIXME|href="#"` en `frontend/src` solo encuentra esa pantalla. El resto de coincidencias eran falsos positivos de la palabra "todo/todos".
- Todos los enlaces internos del menú (`nav.ts`), del móvil (`MobileNav.tsx`) y de la paleta (`CommandPalette.tsx`) apuntan a rutas que existen en `router.tsx`.
- Las búsquedas de `olvid|recuperar|reset` (en `features/auth`), de `plantilla|template|orientativ` y de `km_this_year` no encuentran nada en las pantallas. Eso confirma que faltan E1‑6, E8‑7 y E7‑5.
- `frontend/e2e/` no existe y `.github/` solo contiene `pull_request_template.md`. Eso confirma que faltan E6‑2 y E0‑2.
- Las 68 rutas de `backend/routes/api.php` cubren el contrato. No hay rutas para recuperar la contraseña ni para el RGPD de clientes.

**Limitaciones.**

- No he visto la app funcionando. "Construido" quiere decir que el código está y que el backend tiene tests, **no** que esté probado en pantalla a 360/768/1280 px ni con teclado. Eso lo confirman las tareas 5, 6 y 8.
- Los informes de las tareas 17, 19 y 20 estaban a medio escribir mientras yo trabajaba. Si la tarea 17 ya cubre el taller o los huecos pequeños del particular, las tareas 23 y 26 se reducen o desaparecen. Lo he dejado como petición en el tablero.
- No he medido nada de rendimiento ni he revisado la calidad visual: son las tareas 16 y 20.

**Siguiente paso propuesto.**

1. La sesión principal decide qué tareas de la 22 a la 30 entran en la cola. Recomiendo empezar por la 22: es pequeña y no depende de nadie.
2. Trasladar a Alberto las 3 preguntas.
3. Cuando cierre la tarea 5 (integración), producto vuelve a pasar el mapa y empieza a preparar las pruebas con usuarios (tarea 30).
