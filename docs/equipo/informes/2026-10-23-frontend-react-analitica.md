# Informe frontend-react — Analítica (tareas 17, 22 y 23), simplificación del particular (tarea 16) y primeros pasos (tarea 26)

- **Agente:** frontend-react (modo particular)
- **Fechas:** 2026-10-23 23:20 – 2026-10-24 (con cortes por límite de uso)
- **Instancia aislada:** API `:8020` (PHP con OPcache, `SANCTUM_STATEFUL_DOMAINS=localhost:5181,127.0.0.1:5181`) y web `:5181`
- **Estado:** bloque 1 (tareas 17, 22 y 23) **hecho**. Bloques 2 (tarea 16, particular) y 3 (tarea 26): ver sus apartados

---

## Bloque 1 · Analítica (17), "no prometer lo que no existe" (22) y analítica del taller (23)

### Objetivo

- **17.** La pantalla `/app/:ws/analitica` era la única vacía ("Pantalla en preparación"). Construirla simple, solo con cifras de la API.
- **23.** Que cubra también los espacios `workshop`: importe de órdenes entregadas, cuántas, ticket medio, días medios en el taller y reparto por cliente. Rótulo "Importe de órdenes entregadas", nunca "facturación".
- **22.** Que el menú, la hoja "Más", la paleta, el Centro de control y la portada dejen de anunciar "Facturación" (D12 = A, decidida por Alberto el 24/10).

### Qué hice

**Pantalla de Analítica** (`features/analytics/`). Una columna de 768 px como máximo y **una sola petición** (`GET /workspaces/{ws}/analytics?from&to`):

| | Particular | Taller (owner y manager) |
|---|---|---|
| Cifras clave (3 como máximo, R2) | Gasto total · Gastos anotados · Mes con más gasto | Importe de órdenes entregadas (con IVA) · Órdenes entregadas · Ticket medio |
| Línea de texto | — | "Tiempo medio en el taller, de la recepción a la entrega: 1 día." (`avg_days_in_shop`) |
| Gráfico (Recharts, único) | Gasto por mes | Importe por mes, según la fecha de entrega |
| Listas de barras en HTML | Por categoría (nº de gastos y %) · Por vehículo (matrícula y %, enlaza a su pestaña Gastos) | Por cliente (nº de órdenes, enlaza a la ficha del cliente). Si hay entregas sin cliente, se dice cuántas y que no salen en la lista |
| Vacío | Sin vehículos: "Aún no hay vehículos" + **Añadir vehículo** (sin selector de periodo). Sin gastos: "Sin gastos en este periodo" + **Añadir gasto** (abre el diálogo de gasto) | "Aún no hay órdenes entregadas en este periodo" + **Ver órdenes** |
| Sin permiso | El menú no la muestra al mecánico. Si entra por URL (o la API responde 403), aviso "Tu rol no incluye la analítica" + enlace al Centro de control o al Inicio. No se lanza la petición si el rol ya dice que no | |

- **Periodo:** selector con etiqueta visible ("Últimos 12 meses", "Este año", "Año pasado"), guardado en la URL (`?periodo=`). Siempre envío `from` y `to` explícitos, porque el contrato se contradice: §3.2 dice "últimos 12 meses" y §4 "año natural" (el backend hace lo primero). Al cambiar de periodo se mantienen los datos anteriores atenuados, con `aria-busy` y un aviso para lectores de pantalla.
- **Accesibilidad:** el gráfico es `aria-hidden` y su alternativa es una **tabla visible** dentro de "Ver los datos en una tabla" (`<details>`), útil para todo el mundo. Las listas por categoría, vehículo y cliente son HTML con la cifra escrita. "Mostrar N más" lleva `aria-expanded` y `aria-controls`. Probado con teclado: el periodo cambia con las flechas, la tabla se abre con Enter y el foco se ve (contorno de 2 px).
- **Movimiento:** los gráficos no se animan nunca (`isAnimationActive={false}`); la atenuación al cambiar de periodo dura 200 ms y la anula la regla global de `prefers-reduced-motion`.
- **Reglas de UX aplicadas** (informe del diseñador, §4): 3 cifras grandes como máximo (R2); el único recuadro es el del gráfico, las listas van sin caja (R3); ninguna píldora (R5); ninguna etiqueta en mayúsculas y la matrícula como texto, "4821 KTB" (R6); sin iconos de adorno: solo el chevron del desplegable (R7); sin degradados (R8); 1 petición (R12). Las barras de las listas van en gris: la lima queda para el mes en curso del gráfico. El esqueleto tiene 3 bloques y aparece con 300 ms de retraso para no parpadear.
- **Lo que quité por el camino.** La primera versión pedía además el resumen de cada vehículo para enseñar coste por km y consumo (2 + N peticiones). La quité al llegar R12 ("como mucho 2 peticiones"): esas cifras ya están, con su motivo cuando faltan datos, en la pestaña Gastos de cada vehículo, y la sección "Por vehículo" enlaza allí.

**Tarea 22: "Facturación" → "Analítica"** (`grep -ri "facturaci" frontend/src`):

| Dónde | Antes | Ahora |
|-------|-------|-------|
| `components/layout/nav.ts` (barra lateral, hoja "Más" del móvil y paleta, que salen de aquí) | "Facturación" | "Analítica" |
| `features/dashboard/WorkshopDashboard.tsx` (enlace de la sección de importes) | "Facturación" | "Analítica" |
| `features/landing/LandingPage.tsx` (tarjeta del taller) | "Facturación · Totales con IVA y facturación de las órdenes entregadas." | "Importe de órdenes entregadas · Totales con IVA por mes y por cliente, ticket medio y tiempo en el taller. No son facturas." |
| `features/auth/LoginPage.tsx` (cuenta demo del mecánico) | "sin facturación" | "no ve importes" |
| `lib/labels.ts` (descripción de los roles) | "Gestiona clientes, facturación…" · "No ve facturación." | "Gestiona clientes, importes, analítica, ajustes y equipo." · "No ve importes ni analítica." |
| `features/maintenance/MaintenanceFormPage.tsx` | "solo los ve quien gestiona la facturación" | "solo los ven propietarios y gerentes" |
| `features/workshop/components/OrderTotals.tsx` (comentario) | "Sin permiso de facturación" | "Sin permiso para ver importes" |

Tras el cambio, `grep -rni "facturaci" frontend/src` (sin `three/`) devuelve solo: el comentario de `AnalyticsPage.tsx` que aclara que "nunca se llama facturación: CarCare no emite facturas", y **dos comentarios de `api/types.ts` (líneas 725 y 735)**, que es del arquitecto: lo pido en el tablero (petición 12). "Factura" sigue en los textos del particular donde se refiere a las facturas reales que el usuario sube de su taller (documentos), que es correcto.

**Otros cambios pequeños en mi zona:**
- `components/charts/Charts.tsx`: `MonthlyBars` admite `highlightMonth` (resalta el mes en curso, no siempre el último) y `srTable` (para no duplicar la tabla cuando la pantalla ya enseña una visible); `HBarList` pinta todas las barras en gris. **I2 del informe de UX:** la tabla `sr-only` va dentro de un `<div className="sr-only">`, porque una `<table>` no respeta `height: 1px` y dejaba ~1.376 px vacíos al final de la ficha.
- `lib/format.ts`: `formatPlate('4821KTB')` → "4821 KTB" (R6). Las demás matrículas se dejan como están.
- `lib/analytics.ts` (+ test): periodo, mes con más gasto, nº de gastos, porcentajes y órdenes sin cliente. Solo seleccionan o suman cifras de la API.

### Archivos tocados (bloque 1)

- Nuevos: `frontend/src/features/analytics/parts.tsx`, `frontend/src/lib/analytics.ts`, `frontend/src/lib/analytics.test.ts`.
- Reescrito: `frontend/src/features/analytics/AnalyticsPage.tsx` (tenía 5 líneas con "Pantalla en preparación").
- Modificados: `frontend/src/components/charts/Charts.tsx`, `frontend/src/lib/format.ts`, `frontend/src/lib/helpers.test.ts`, y los 7 archivos de la tabla de la tarea 22 (incluida `LandingPage.tsx`, solo las dos líneas de la tarjeta, como pedía la tarea 22).
- Fuera de mi zona: nada. `api/types.ts` no lo he tocado (petición en el tablero).

### Evidencias (bloque 1)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | 0 errores (hubo errores transitorios en `OrdersPage.tsx` mientras el agente del taller lo editaba; en la pasada final, limpio) |
| `npm run lint` (oxlint) | 0 errores, 69 avisos, todos previos y ninguno en archivos míos |
| `npm run test` (Vitest) | 3 archivos, **30 tests en verde** (8 nuevos de analítica + 1 de matrícula) |
| `npm run build` | En verde. **`AnalyticsPage` = 10,19 kB (3,90 kB gzip)**. Recharts va en el chunk `charts` (404,58 kB, 115,48 kB gzip), que solo se descarga con las pantallas que tienen gráfico; el chunk inicial `index` = 279,69 kB (87,52 kB gzip) |
| `GET /workspaces/1/analytics` (demo) | 6.469,55 €, 12 meses, 11 categorías, 2 vehículos. Coincide con la pantalla |
| `GET /workspaces/3/analytics` (taller) | 4.284,78 €, 15 entregadas, ticket 285,65 €, 1 día, 10 clientes. Coincide con la pantalla |
| `GET /workspaces/3/analytics` como `mecanico@` | 403 "No tienes permiso para esta acción." |
| Auditoría de densidad (script del diseñador) | Analítica: 1 petición propia, 0 `<canvas>`, 0 three.js, 1 caja, 0 píldoras, 0 mayúsculas, 3 cifras grandes, 1,5 pantallas de alto a 1280 |

**Capturas** (en `C:\Users\Alberto\AppData\Local\Temp\claude\c--Users-Alberto-Desktop-CarCare\3d6948c2-f3d3-4558-bc63-9fd193529f13\scratchpad\frontend-analitica\`):

- `demo-app_1_analitica-1280.png` y `-360.png`: particular con datos.
- `taller-app_3_analitica-1280.png` y `-360.png`: taller como propietario. `gerente-app_3_analitica-1280.png`: como gerente (igual).
- `taller-app_2_analitica-1280.png` y `-360.png`: espacio personal sin vehículos (vacío con "Añadir vehículo").
- `mecanico-app_3_analitica-1280.png` y `-360.png`: aviso de permiso.
- `mock-taller-empty-1280.png`, `mock-taller-error-1280.png` y `mock-taller-forbidden-1280.png`: con la respuesta interceptada en Playwright (taller sin entregas, error 500 con "Reintentar" y 403 de la API). Los datos demo no tienen un periodo sin entregas.
- `teclado-taller-1280.png`: tras cambiar el periodo con flechas, abrir la tabla con Enter y "Mostrar 4 clientes más".

### Respuesta a la petición 1 del tablero (producto)

**Sí: la Analítica incluye la variante de taller (E15‑2).** Muestra el importe de órdenes entregadas, cuántas, el ticket medio, el tiempo medio en el taller, el gráfico por mes y el reparto por cliente, todo de `GET /workspaces/{ws}/analytics`. El rótulo es "Importe de órdenes entregadas" y la pantalla dice "CarCare no emite facturas". La tarea 23 queda cubierta dentro de la 17. Marco la petición como resuelta.

### Limitaciones (bloque 1)

- El periodo solo ofrece 3 opciones; no hay fechas a medida. Con un periodo largo el gráfico tendría muchas barras, y por eso no lo he abierto.
- El "Ticket medio" y el "Tiempo medio" los calcula el backend. Si `avg_days_in_shop` es `null` (no debería pasar con entregas) la línea no sale.
- El particular no muestra el coste por km ni el consumo del conjunto (no lo da la API); están en la pestaña Gastos de cada vehículo.
- Las pruebas de vacío del taller, error 500 y 403 se hicieron interceptando la respuesta en el navegador, no con datos reales.

---

## Bloque 2 · Simplificación del modo particular (tarea 16, paso 2)

*(en curso)*

---

## Bloque 3 · Primeros pasos, km del año e historial por año (tarea 26)

*(pendiente)*

---

## Oleadas 1c/1d (modo particular y taller): qué existe y qué limitaciones se conocen

El informe de estas oleadas nunca se escribió porque el límite de uso cortó a los dos agentes. Lo reconstruyo leyendo el código y el commit `779dc5c` (41 archivos, +5.691 líneas). La base (login, registro, cabina, garaje, ficha con 3D y zonas, diario, gastos, historial, documentos, datos, formularios de vehículo e intervención) es de la oleada 1b (commit `a3c417c`).

**Modo particular (oleada 1d, 779dc5c):**

| Pantalla | Qué hace | Limitaciones conocidas |
|----------|----------|------------------------|
| Agenda (`features/agenda/`) | Todos los recordatorios pendientes del espacio por urgencia (vencidos, próximos, en plazo, sin datos), filtros de estado y vehículo, vista de calendario mensual y acciones (hecho, posponer, editar, descartar) | Pide hasta 10 páginas de 100 recordatorios y avisa si hay más. Fila de ~140 px y el aviso "no medido" repetido en cada fila (UX R4 y R9). A 360 px el filtro de estado se sale de la pantalla (I4) |
| Posponer recordatorio (`dialogs/PostponeReminderDialog.tsx`) | Mueve la fecha y/o los km del vencimiento | — |
| Informe imprimible (`features/report/`) | Hoja clara con ficha, historial, gastos por categoría y año, lecturas, pendientes y documentos; "Imprimir / Guardar PDF" con el diálogo del navegador | No genera PDF en el servidor. Cabeceras de tabla en mayúsculas (26) y matrícula con forma de placa (UX 5.5) |
| Ajustes (`features/settings/`) | Perfil, contraseña, tema, espacios (crear taller, salir, eliminar) y baja de la cuenta | Cajas dentro de cajas en "Espacios" (UX 5.5) |
| Pestaña Órdenes de la ficha | Órdenes del vehículo en talleres | — |
| Analítica | Seguía vacía: es la tarea 17 de este informe | — |

**Modo taller (oleada 1d, 779dc5c):** detalle de orden (estado con pasos, líneas de piezas y mano de obra, totales con IVA en "Resumen de la orden (no es una factura)", elevador, mecánico, fecha prometida, entrega que crea la intervención), nueva orden (vehículo del taller o alta rápida, qué le pasa, planificación y líneas), clientes (búsqueda, tabla en escritorio y tarjetas en móvil) y su ficha, equipo (altas por email, cambio de rol, último propietario protegido, actividad) y Taller 3D con panel accesible. Limitaciones conocidas (informe UX §5.3‑5.4): el centro de control repite la misma información 4 veces, el detalle de orden tiene cajas anidadas y dos modelos de guardado, y el tablero corta los títulos de columna a 1280 px. Desde el 23/10 las lleva el agente `frontend-react (taller)` (ver su informe del 23/10).

---

## Siguiente paso propuesto

*(se completa al cerrar los bloques 2 y 3)*
