# Informe · disenador-ux · Simplificar la interfaz y darle un aspecto natural

| Campo | Valor |
|-------|-------|
| Agente | disenador-ux |
| Fecha | 2026-10-23, de 22:55 a 23:50 (cortado por el límite de uso), y 2026-10-24, de 09:00 a 09:40 |
| Encargo | Tarea 16 de [`AUTOPILOTO.md`](../AUTOPILOTO.md), paso 1: auditar la app real, plan para simplificarla mucho y 2‑3 direcciones visuales "naturales" para que Alberto elija |
| Petición de Alberto (23/10, literal) | "Quiero que simplifiques mucho más la interfaz. La verdad es que la veo un poco sobrecargada y quiero que sea más simple. Y así podría renderizarse de una manera mejor y más rápida. Sobre el diseño, la verdad es que no me termina de convencer, aunque eso lo podemos ir cambiando más adelante, ya que se nota muy artificial y hecho con IA. Quiero que esto luzca de la manera más natural posible." |
| Estado | Hecho (paso 1). No he cambiado código de la app |
| Material | Bocetos, capturas y script de medición en [`2026-10-23-disenador-ux-simplificacion/`](2026-10-23-disenador-ux-simplificacion/) |

---

## 0. Resumen para Alberto

- **La app hace bien lo que promete, pero cada pantalla lo enseña todo a la vez.** La cabina tiene 16 cajas, 7 cifras grandes y 11 etiquetas en mayúsculas. La ficha del vehículo mide 4,4 pantallas de alto en el ordenador y 6,9 en el móvil. El centro de control lleva 39 píldoras de colores.
- **El 3D se carga en sitios donde no se ve.** three.js se descarga en 21 de las 31 pantallas medidas, pero solo 7 muestran un `<canvas>`. El resto lo descarga solo para pintar la miniatura de la cabecera o de las tarjetas. Las pantallas más lentas son las del 3D: la ficha tarda 6,5 s en quitar los esqueletos, el centro de control 5,3 s y la cabina 3,5 s. Las pantallas sin 3D tardan entre 1,5 y 2,4 s.
- **Lo que suena a "hecho con IA"** es sobre todo esto: etiquetas en MAYÚSCULAS con letras separadas, el saludo con la fecha encima ("VIERNES, 23 DE OCTUBRE · Hola, Lucía"), lemas como "Tu coche, al día. Tu taller, bajo control." y "Todo lo de tus vehículos, de un vistazo.", la retícula y el brillo lima del fondo, una píldora para cada dato, un icono para cada etiqueta y una tipografía "tecnológica" (Space Grotesk) sobre carbón y lima neón.
- **Lo más natural que ya tenemos son el informe imprimible y la tabla de clientes:** texto, tablas y nada más. Propongo llevar toda la app hacia eso.
- **Plan:** 14 reglas que se pueden comprobar (apartado 4) y un plan por pantalla (apartado 5). El 3D se queda en dos sitios: el **mapa de zonas de la ficha** y el **Taller 3D**. La cabina, el centro de control, los listados y la portada pasan a imagen estática.
- **Diseño:** 3 propuestas con bocetos hechos sobre los datos reales de la demo (apartado 7). Son opciones para más adelante, que se aplicarán solo cambiando tokens: **no hace falta decidir hoy**. **Recomiendo la A, "Claro y sobrio".**

---

## 1. Método

- **Herramienta.** Playwright con Chromium sin interfaz y WebGL por software (SwiftShader). Cada pantalla se abre en un navegador nuevo con la sesión ya iniciada, es decir, en frío. Se mide a **1280×860** y a **360×780**.
- **Cuentas.** `demo@carcare.test` (particular, 2 vehículos), `taller@carcare.test` (propietario: 20 vehículos, 31 órdenes, 12 clientes) y `mecanico@carcare.test`.
- **Métricas automáticas.** Las calcula el script [`auditoria-densidad.cjs`](2026-10-23-disenador-ux-simplificacion/auditoria-densidad.cjs):
  - **Cajas:** elementos con borde y radio de tarjeta. Entre paréntesis, cuántas están dentro de otra caja.
  - **Píldoras:** elementos redondeados de 14 a 28 px de alto que llevan texto.
  - **Etiquetas en MAYÚSCULAS:** con `text-transform: uppercase` y letras separadas. Incluyen la matrícula.
  - **Cifras grandes:** de 22 px o más.
  - **Iconos visibles.**
  - **Peticiones propias a `/api/v1`:** sin contar `/me`.
  - **`<canvas>`:** cuántos hay en la pantalla.
  - **three.js:** si se descarga algún chunk de three, de R3F o de drei.
  - **Listo:** tiempo hasta que no queda ningún esqueleto, spinner ni `aria-busy` visible.
  - **Alto:** alto de la página dividido por el alto de la ventana.
- **Ojo con los tiempos.** Son del servidor de desarrollo de Vite, sin minificar, y con el 3D pintado por software, que es más lento que con una tarjeta gráfica. Sirven **para comparar pantallas entre sí y medir el antes y el después, no como cifras absolutas**.
- **Peticiones duplicadas en desarrollo.** En desarrollo, React StrictMode lanza cada petición dos veces y cancela la primera. Solo cuento las que terminan. En producción no pasa.
- **Incidencia.** La API de `:8000` dejó de responder hacia las 23:13. Estuvo más de 5 minutos sin contestar a nada, ni siquiera a `curl /api/v1/me`. El resto de pantallas (ajustes, informe y todo el modo taller) las medí contra la pila paralela `:5181 → :8020`, que es el mismo código y la misma base de datos y que había arrancado `frontend-react` para su tarea 17. Solo hice lecturas e inicios de sesión. Esa noche no arranqué ni paré ningún servidor.
- **Comprobaciones del 24/10.** Siguiendo la norma de instancias aisladas de `CLAUDE.md`, las hice en una instancia propia: API en `:8035` y web en `:5178`, con la misma base de datos `carcare`. La arranqué al empezar y la paré al terminar.
  - **Qué comprobé.** Desbordes a 360, el alto vacío de la ficha, el garaje con silueta 2D (`?sin3d`) y el tema claro actual.
  - **Por qué no rehíce las mediciones de la noche.** El código ya estaba cambiando por el paso 2. Aun así, esas dos comprobaciones valen como "antes":
    - C1: nadie había tocado todavía `PersonalDashboard.tsx`;
    - I2: la línea `<table className="sr-only">` de `Charts.tsx` estaba igual en el último commit y en la copia de trabajo.
  - **Los tiempos de esa mañana no sirven**, porque la máquina estaba cargada con otros 3 agentes.

---

## 2. Inventario

### 2.1 Métricas por pantalla (antes)

Medido el 23/10 entre las 22:55 y las 23:45. Los datos completos, con los textos de cada píldora y etiqueta, las cifras, los encabezados y las peticiones una a una, están en [`metricas-antes.json`](2026-10-23-disenador-ux-simplificacion/metricas-antes.json). Para medir el "después", el mismo script: `UX_BASE=http://localhost:<puerto> node auditoria-densidad.cjs particular|workshop|mechanic|guest`.

| Pantalla | Cajas (anidadas) | Píldoras | Etiq. MAYÚS | Cifras grandes | Iconos | Peticiones propias | `<canvas>` | three.js | Listo 1280 / 360 | 1.er canvas | Alto (pantallas) 1280 / 360 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Invitado · portada | 12 (0) | 5 | 4 | 3 | 25 | 0 | 1 | sí | 0,5 s / 1,0 s | 0,7 s | 5,3 / 8,8 |
| Invitado · login | 1 (0) | 0 | 0 | 0 | 6 | 0 | 0 | no | 0,9 s / 0,9 s | — | 1,0 / 1,3 |
| Invitado · registro | 2 (0) | 0 | 0 | 0 | 4 | 0 | 0 | no | 0,9 s / 0,9 s | — | 1,1 / 1,5 |
| Particular · cabina | 16 (1) | 6 | 11 | 7 | 46 | 2 | 1 | sí | 3,5 s / 4,0 s | 3,5 s | 2,9 / 4,9 |
| Particular · garaje | 2 (0) | 3 | 4 | 0 | 10 | 1 | 0 | sí | 1,9 s / 1,9 s | — | 1,0 / 1,6 |
| Particular · ficha-resumen | 14 (0) | 14 | 7 | 4 | 75 | 3 | 1 | sí | 6,5 s / 6,4 s | 7,7 s | 4,4 / 6,9 |
| Particular · ficha-diario | 16 (0) | 13 | 5 | 3 | 29 | 2 | 0 | sí | 1,6 s / 1,8 s | — | 2,6 / 3,7 |
| Particular · ficha-historial | 8 (0) | 17 | 2 | 0 | 39 | 2 | 0 | sí | 1,6 s / 2,0 s | — | 1,9 / 4,3 |
| Particular · ficha-gastos | 6 (0) | 13 | 6 | 3 | 64 | 3 | 0 | sí | 5,8 s / 6,3 s | — | 3,3 / 4,8 |
| Particular · ficha-recordatorios | 5 (0) | 4 | 2 | 0 | 30 | 2 | 0 | sí | 2,1 s / 1,7 s | — | 1,3 / 2,4 |
| Particular · ficha-documentos | 3 (0) | 2 | 2 | 0 | 18 | 3 | 0 | sí | 2,4 s / 2,2 s | — | 1,0 / 1,7 |
| Particular · ficha-datos | 5 (0) | 0 | 4 | 0 | 6 | 1 | 0 | sí | 1,9 s / 2,0 s | — | 1,4 / 2,9 |
| Particular · form-vehiculo | 1 (0) | 0 | 0 | 0 | 2 | 0 | 1 | sí | 2,1 s / 2,4 s | 2,1 s | 1,0 / 1,9 |
| Particular · form-intervencion | 6 (0) | 0 | 3 | 0 | 20 | 2 | 0 | sí | 1,9 s / 1,9 s | — | 2,2 / 3,6 |
| Particular · agenda | 11 (0) | 12 | 0 | 0 | 87 | 1 | 0 | no | 2,2 s / 1,9 s | — | 3,0 / 5,3 |
| Particular · ajustes | 7 (2) | 0 | 0 | 0 | 12 | 0 | 0 | no | 1,5 s / 1,6 s | — | 2,0 / 2,9 |
| Particular · informe | 1 (0) | 0 | 26 | 0 | 5 | 1 | 0 | no | 1,8 s / 1,7 s | — | 3,9 / 7,1 |
| Particular · analitica | 0 (0) | 0 | 0 | 0 | 0 | 0 | 0 | no | — / — | — | 1,0 / 1,0 |
| Taller · centro | 31 (4) | 39 | 13 | 6 | 88 | 2 | 1 | sí | 5,3 s / 5,8 s | 5,3 s | 3,5 / 6,5 |
| Taller · ordenes | 19 (14) | 17 | 28 | 0 | 68 | 2 | 0 | sí | 3,1 s / 5,3 s | — | 1,5 / 1,8 |
| Taller · orden-detalle | 15 (7) | 3 | 4 | 0 | 41 | 4 | 0 | sí | 15,3 s / 5,0 s | — | 2,7 / 5,0 |
| Taller · orden-nueva | 12 (6) | 0 | 12 | 0 | 19 | 3 | 0 | sí | 6,7 s / 7,6 s | — | 2,6 / 4,0 |
| Taller · clientes | 1 (0) | 22 | 0 | 0 | 46 | 1 | 0 | no | 1,6 s / 2,8 s | — | 1,4 / 2,3 |
| Taller · cliente-detalle | 7 (0) | 12 | 5 | 0 | 24 | 3 | 0 | sí | 6,7 s / 7,5 s | — | 1,1 / 2,3 |
| Taller · equipo | 3 (0) | 1 | 0 | 0 | 12 | 2 | 0 | no | 3,8 s / 2,0 s | — | 1,4 / 2,6 |
| Taller · taller3d | 10 (4) | 14 | 6 | 1 | 31 | 3 | 1 | sí | 6,7 s / 9,2 s | 6,7 s | 1,0 / 2,0 |
| Taller · vehiculos | 20 (0) | 22 | 40 | 0 | 67 | 1 | 0 | sí | 4,2 s / 3,9 s | — | 3,4 / 10,1 |
| Taller · ficha-taller | 11 (0) | 10 | 7 | 3 | 47 | 3 | 1 | sí | 10,1 s / 19,8 s | 12,8 s | 2,9 / 4,8 |
| Taller · ficha-ordenes | 3 (0) | 1 | 2 | 0 | 10 | 2 | 0 | sí | 2,6 s / 2,5 s | — | 1,0 / 1,4 |
| Taller · agenda-flota | 6 (0) | 6 | 0 | 0 | 53 | 1 | 0 | no | 4,5 s / 2,6 s | — | 2,0 / 3,4 |
| Taller · facturacion | 3 (0) | 0 | 0 | 4 | 2 | 1 | 0 | no | 2,7 s / 2,4 s | — | 1,9 / 2,4 |
| Mecánico · centro | 30 (4) | 39 | 11 | 4 | 88 | 4 | 1 | sí | 40,8 s / 3,8 s | 40,8 s | 3,0 / 5,9 |
| Mecánico · ordenes | 19 (14) | 17 | 28 | 0 | 68 | 2 | 0 | sí | 2,8 s / 2,3 s | — | 1,5 / 1,8 |
| Mecánico · orden-detalle | 15 (7) | 3 | 4 | 0 | 43 | 4 | 0 | sí | 6,7 s / 2,3 s | — | 2,5 / 4,7 |

Notas para leer la tabla:

- **Valores sueltos que no hay que tomar en serio.** Son el detalle de orden a 1280 (15,3 s), la ficha del taller (10‑20 s) y el centro del mecánico (40,8 s). Se midieron mientras otros agentes compilaban y lanzaban pruebas en el mismo equipo. Lo que vale es la comparación con la misma pantalla en el otro ancho.
- **Analítica** era el aviso "Pantalla en preparación" (C2). **Facturación** ya mostraba la pantalla nueva que estaba construyendo `frontend-react` (tarea 17).
- **La portada** se da por "lista" enseguida porque no tiene esqueletos, pero la escena 3D tarda en pintarse, y su contenido no se ve sin hacer scroll (I1).
- **"Etiq. MAYÚS"** cuenta también la matrícula con forma de placa. Por eso la flota tiene 40 y el tablero 28.

### 2.2 Qué dicen los números

- **Las pantallas que más se ven son las más cargadas:**

  | Pantalla | Cajas | Píldoras | Cifras grandes | Iconos | Alto 1280 / 360 |
  |----------|-------|----------|----------------|--------|-----------------|
  | Cabina | 16 | 6 | 7 | 46 | 2,9 / 4,9 pantallas |
  | Ficha (Resumen) | 14 | 14 | — | 75 | 4,4 / 6,9 pantallas |
  | Centro de control | 31 | 39 | — | 88 | 3,5 / 6,5 pantallas |

- **three.js se descarga en 21 de las 31 pantallas, y solo 7 tienen un `<canvas>`.** Las otras 14 lo descargan para pintar la miniatura de la cabecera o de las tarjetas (I7).
- **Las pantallas con 3D o con el resumen del vehículo son las lentas:**
  - con 3D o resumen: ficha 6,5 s, gastos 5,8 s, centro 5,3 s, cabina 3,5 s;
  - sin 3D (historial, diario, garaje, datos, clientes): 1,5‑2,4 s.
- **Las rejillas de tarjetas alargan mucho la página en el móvil:**
  - la flota mide 10 pantallas en el móvil;
  - la agenda, 5,3;
  - el historial, 4,3.

  En forma de lista o tabla cabrían en 2‑3.
- **Hay muchas cajas dentro de otras cajas en el modo taller:**
  - tablero: 14;
  - detalle de orden: 7;
  - nueva orden: 6;
  - centro de control y Taller 3D: 4 cada uno.
- **Las pantallas más naturales ya existen:** el informe imprimible (1 caja, 0 píldoras) y la tabla de clientes (1 caja). Lo que sobra en clientes son las 22 píldoras de "2 vehículos" y "1 orden abierta".

---

## 3. Hallazgos que no son de gusto (fallos y accesibilidad)

Son fallos o problemas de accesibilidad, no cuestiones de gusto. Los he medido en la app tal como estaba el 23/10 por la noche. Las desbordaduras y el alto vacío los volví a comprobar el 24/10 a las 09:05 en mi instancia aislada (`:5178` → `:8035`) con `getBoundingClientRect`; el resultado está en *Evidencias*. Los archivos son de `frontend/src/`. Varios desaparecen al aplicar el plan del apartado 5, y lo indico para que quien lo aplique **compruebe** que de verdad han desaparecido.

### Críticos

| # | Pantalla | Problema | Evidencia | Archivo | Propuesta |
|---|----------|----------|-----------|---------|-----------|
| C1 | Cabina a 360 px | **El estado "Vencido" no se ve en el móvil.** La columna de texto del héroe llega hasta x = 505 px en una ventana de 360. El héroe la recorta (`overflow-hidden`) sin barra de desplazamiento, así que la píldora "Vencido" y la causa ("superado por 443 km") quedan fuera. Es justo lo más importante de la pantalla | [`actual-cabina-360.png`](2026-10-23-disenador-ux-simplificacion/actual-cabina-360.png). Medición del 24/10: `DIV.flex.flex-col.justify-between… right=505` con `vw=360` | `features/dashboard/PersonalDashboard.tsx` (`Hero`: rejilla sin `min-w-0` en la columna y bloque "Lo próximo" con `truncate`) | Se resuelve con 5.1 (Inicio sin héroe). Si el héroe se mantiene en algún sitio: `min-w-0` en los hijos de la rejilla y el estado antes del texto largo |
| C2 | Menú (particular y taller) | **"Analítica" y "Facturación" llevaban a "Pantalla en preparación"**, y la cabina y el centro de control enlazaban a ellas. Va contra la regla de oro 5 | [`metricas-antes.json`](2026-10-23-disenador-ux-simplificacion/metricas-antes.json) → `analitica`: 4 palabras, 0 cajas | `features/analytics/AnalyticsPage.tsx`, `components/layout/nav.ts` | Lo está construyendo `frontend-react` (tarea 17). En mi segunda pasada (23:40) la de taller ya mostraba cifras. Comprobar al cerrar la 17 que ninguna entrada del menú lleva a una pantalla vacía |
| C3 | Cabina | **Dos "gastos del año" distintos en la misma pantalla sin decir de qué son.** La tarjeta "Gasto del año" dice 2.506,76 € y es solo del vehículo elegido. El gráfico dice "Este año 5.274,31 €" y es de todos. Lo mismo pasa con "Este mes": 292,83 € y 470,26 €. El usuario lo leerá como un error | [`actual-cabina-1280.png`](2026-10-23-disenador-ux-simplificacion/actual-cabina-1280.png) | `PersonalDashboard.tsx`: `KpiCards` usa el resumen del vehículo y "Gasto mensual" usa `data.spend` del espacio | Se resuelve con 5.1, donde todo es global. Regla general: cada cifra dice su ámbito |
| C4 | Cabina ("Lo próximo") | **Aviso contradictorio:** "Vencido · El 9 dic 2026 (faltan 47 días) o A los 81.127 km (s…". Lo que se lee es "faltan 47 días", y la causa real (km superados) queda cortada | `actual-cabina-1280.png` | `lib/reminders.ts` (`dueSummary`) + `PersonalDashboard.tsx` | Cuando está vencido, la causa va primero: "pasado en 443 km". Así está en los bocetos |

### Importantes

| # | Pantalla | Problema | Evidencia | Archivo | Propuesta |
|---|----------|----------|-----------|---------|-----------|
| I1 | Portada | **Contenido invisible hasta hacer scroll.** Cada bloque empieza con opacidad 0 (`Reveal`, `whileInView` de motion). En la captura de página completa quedan **unos 3.000 px en blanco**, y lo mismo pasaría al imprimir o si falla `IntersectionObserver`. No he comprobado si `motion` respeta `prefers-reduced-motion` aquí, porque no hay `MotionConfig reducedMotion="user"` | [`actual-portada-1280-completa.png`](2026-10-23-disenador-ux-simplificacion/actual-portada-1280-completa.png) | `features/landing/LandingPage.tsx` (`Reveal`) | Quitar `Reveal` (va en 5.5). Si se quiere una entrada suave: CSS que parta de visible y desactivada con movimiento reducido |
| I2 | Ficha (y toda pantalla con gráfico) | **1.376 px de página vacía al final.** La tabla accesible del gráfico es `<table className="sr-only">`, y una tabla **no respeta** `height: 1px`: crece con su contenido. El documento mide 3.763 px y el contenido termina en 2.387 | Medición del 24/10: `doc=3763`, `mainBottom=2387`, el elemento más bajo es `TABLE.sr-only` | `components/charts/Charts.tsx`, línea 27 | Meter la tabla en `<div className="sr-only">…</div>`. Es un cambio de una línea |
| I3 | Todos los formularios | **El borde de los campos no llega a 3:1** (WCAG 1.4.11). En el tema oscuro, `--line-strong` `#5B666C` da 2,79:1 sobre `--surface` y 2,57:1 sobre `--surface-2`, que es el relleno del propio campo. En el claro, `#8C8A82` da 2,98:1 sobre `--surface-2` | Calculado con la fórmula WCAG 2.x, igual que en `contraste-paletas.cjs` | `index.css` (`--line-strong`), `components/ui/variants.ts` (input: `border-line-strong bg-surface-2`) | Ya, con los tokens actuales: oscuro `#6B777D` (3,57 y 3,29:1) y claro `#85837B` (3,80 y 3,27:1). Las tres direcciones del apartado 7 ya lo cumplen |
| I4 | Varias, a 360 px (y una a 1280) | **Contenido cortado.** <br>• Las filas de la lista de zonas llegan a x = 428, y "Con historial, sin interval…" queda cortado. <br>• El filtro de estado de la agenda llega a x = 483 y "En plazo" no se ve. <br>• Las pestañas de la ficha siguen fuera de la pantalla (Recordatorios, Documentos, Datos) sin ninguna pista. <br>• A 1280, los títulos de columna del tablero se cortan: "En diagnós…", "Esperando …", "En reparaci…" | Medición del 24/10 (`extra.log`); [`actual-ficha-360.png`](2026-10-23-disenador-ux-simplificacion/actual-ficha-360.png); [`actual-ordenes-1280.png`](2026-10-23-disenador-ux-simplificacion/actual-ordenes-1280.png) | `components/vehicles/ZoneMap.tsx` (`ZoneList`), `features/agenda/AgendaPage.tsx` (`SegmentedControl`), `features/vehicle/VehicleDetailPage.tsx` (nav de pestañas), `features/workshop/components/KanbanBoard.tsx` | 5.2 (5 pestañas), 5.4 (nombres cortos de columna) y 5.5 (filtros en una fila o "Filtros ▾"). La lista de zonas: `min-w-0` + texto sin píldora |
| I5 | Móvil, casi todas las pantallas | **Dos acciones primarias a la vez:** el "+" lima de la barra inferior y el botón lima de la pantalla ("Anotar km", "Nuevo recordatorio", "Nueva orden", "Registrar") | `actual-cabina-360.png`, `actual-ficha-360.png` | `components/layout/MobileNav.tsx` + las `actions` de cada `PageHeader` | R1 |
| I6 | Cabina | **El 3D se pinta sin parar.** En la cabina el coche gira solo con `frameloop="always"` mientras está en pantalla, así que la GPU y la batería no descansan en la pantalla que más se abre | `three/scenes/CarViewerCanvas.tsx`: `animate = mode === 'showcase' && !reduced && inView` | `three/scenes/CarViewerCanvas.tsx` | 5.7 (fuera de la cabina). `experto-3d` lo trata en las tareas 16 y 20 |
| I7 | 14 pantallas sin `<canvas>` | **Descargan three.js solo para la miniatura.** Pasa en el garaje, en las 6 pestañas de la ficha (no el Resumen), en la nueva intervención, el tablero, la nueva orden, el detalle de orden, el detalle de cliente, la flota y la pestaña Órdenes de la ficha | [`metricas-antes.json`](2026-10-23-disenador-ux-simplificacion/metricas-antes.json) (`threeChunks`) | `three/thumbnail/CarThumbnail.tsx` → `renderThumbnail.ts` | 5.7 y R11: silueta SVG, que ya existe y se ve bien ([`actual-garaje-silueta-2d.png`](2026-10-23-disenador-ux-simplificacion/actual-garaje-silueta-2d.png)) |
| I8 | Demo | **Datos de prueba visibles en la cuenta demo:** "Lucía Demo archivó la intervención «Prueba QA frontend (archivar)»" sale dos veces en la actividad de la cabina | `actual-cabina-1280.png` | Datos (no es código) | Volver a sembrar la demo antes de enseñarla. `backend-laravel` rehace los datos demo en la tarea 19 |

### Mejoras

| # | Pantalla | Problema | Archivo | Propuesta |
|---|----------|----------|---------|-----------|
| M1 | Ficha · Diario | "Viernes, 23 De Octubre": `capitalize` pone en mayúscula cada palabra de una fecha en español | `features/vehicle/tabs/JournalTab.tsx` (título del día con `capitalize`) | Solo la primera letra, con `formatDate` o `::first-letter` |
| M2 | Ficha · Diario | Los encabezados saltan de `h1` a `h3`: los días son `h3` sin `h2` | `JournalTab.tsx` | Los días como `h2`, o un `h2` "Día a día" |
| M3 | Ficha · Resumen y Agenda | Jerga: "Con historial, sin intervalos" | `lib/status.ts` (`zoneDescriptor`) | "Sin recordatorio" |
| M4 | Ficha · Datos | El color se muestra como "#6B7280" | `features/vehicle/tabs/DataTab.tsx` | El nombre del color (la paleta ya tiene nombres) o solo la muestra |
| M5 | Cabina, centro, equipo | La actividad dice "Lucía Demo registró…" en un espacio de una sola persona | `Activity.summary`, que lo genera el backend | Petición al arquitecto y al backend (apartado 8) |
| M6 | Formulario de vehículo | Las sugerencias de marca van en orden alfabético (Abarth, Alfa Romeo, Alpine, Aston Martin, Bentley…), no son las comunes | `features/vehicle/VehicleFormPage.tsx` / `lib/brands.ts` | Las 10 más comunes en España, o ninguna |
| M7 | Toda la app (desarrollo) | Con React StrictMode cada petición sale dos veces y la primera se cancela. No pasa en producción, pero confunde al medir | `main.tsx` | Nada que cambiar. Tenerlo en cuenta al leer la pestaña Red |

---

## 4. Reglas globales de simplificación (se aplican ya)

Las reglas no dependen de la dirección visual que elija Alberto: se pueden aplicar ya con los tokens actuales. Cada una dice cómo se comprueba. La métrica se mide con el script del apartado 1, y el `grep` se lanza sobre `frontend/src`.

| # | Regla | Cómo se comprueba |
|---|-------|-------------------|
| R1 | **Una sola acción primaria (relleno de acento) visible por pantalla, contando la barra inferior del móvil.** Si la pantalla tiene su propio botón primario, el "+" central del móvil no se pinta como primario: pasa a botón normal o se oculta en esa ruta. | Captura a 360 y a 1280: como mucho 1 elemento con `bg-accent` en la primera pantalla |
| R2 | **Como máximo 3 cifras grandes (≥ 22 px) en la primera pantalla.** Las demás cifras van en texto normal o en su pestaña. | Métrica "cifras grandes" ≤ 3 |
| R3 | **Nada de caja dentro de caja.** La caja (borde + fondo) solo se usa para: un elemento que se pulsa entero (vehículo del garaje, orden del tablero), un gráfico o el visor 3D, y un diálogo o menú. Las secciones se separan con su título y con espacio, no con un recuadro. | Métrica "cajas anidadas" = 0. Cajas totales ≤ 6 por pantalla, salvo el tablero |
| R4 | **Los datos van en listas y tablas, no en rejillas de tarjetas.** Una fila por elemento, con separador fino. Va para recordatorios, intervenciones, gastos, documentos, días del diario, órdenes en lista, clientes, equipo y elevadores. Solo usan tarjetas el garaje (porque lleva imagen) y el tablero kanban. | Revisión visual. En la agenda, una fila de recordatorio mide ≤ 64 px a 1280 (hoy mide unos 140 px) |
| R5 | **Píldora solo para lo que pide atención:** *Vencido*, *Próximo*, *Tarde*, *Urgente* y *Archivado*. "En plazo", "Sin datos", "Normal", "Baja", el tipo, la zona, la categoría, "Elevador 2", "38 km recorridos", "2,90 €" o "Depósito lleno" pasan a texto gris normal. | Métrica "píldoras" ≤ 6 en la primera pantalla. `grep "<Badge"` solo con `tone="danger"`, `"warning"` o el estado archivado |
| R6 | **Sin etiquetas en MAYÚSCULAS con letras separadas.** Las etiquetas se escriben como frase ("Kilometraje", "Este mes"), a 13‑14 px y en color secundario. La matrícula se muestra como texto ("4821 KTB"), sin imitar una placa. | `grep -rn "uppercase" src --include=*.tsx` → 0 resultados. Métrica "MAYÚS" = 0 |
| R7 | **Iconos solo donde sustituyen o aclaran:** navegación, botones de solo icono y estado (junto al texto del estado). Fuera los iconos en las etiquetas de cifras, en los títulos de tarjeta y delante de cada fecha y de cada km, y fuera la "baldosa" de 36 px detrás del icono. | Métrica "iconos" ≤ 15 en cabina, ficha y agenda (hoy 46, 75 y 87). `grep "place-items-center rounded-control bg-surface-2"` → 0 |
| R8 | **Superficies planas:** sin degradados, retícula de fondo (`bg-grid`), manchas de luz (`blur-3xl`), `backdrop-blur` ni sombras de color. Las cabeceras fijas son opacas. | `grep -rn "bg-gradient\|bg-grid\|blur-3xl\|blur-\[\|backdrop-blur" src` → 0, salvo el velo de los diálogos |
| R9 | **El aviso de honestidad va una vez por sección, no en cada elemento.** "Según tus intervalos, no medido" se pone en la cabecera de la sección (y en el texto accesible del 3D). No se repite en cada recordatorio ni en cada barra. | En la agenda aparece 1 vez (hoy 12). En la ficha, 1 vez por sección |
| R10 | **Sin saludos, fechas de adorno ni frases de marketing dentro de la app.** El título es el nombre de la pantalla ("Inicio", "Garaje", "Kia Sportage"). La línea de debajo solo aparece si informa de algo ("1 aviso vencido y 2 próximos") y nunca repite lo que ya dice la pantalla. | `grep -rn "Hola,\|de un vistazo\|te esperan\|bajo control"` → 0. Ningún `PageHeader` con `eyebrow` |
| R11 | **3D solo donde aporta (apartado 5.7).** Hay un `<canvas>` en la ficha (mapa de zonas) y en Taller 3D. Ninguna otra pantalla descarga three.js: ni la cabina, ni el garaje, ni las demás pestañas de la ficha, ni el tablero, ni la nueva orden, ni la portada al cargar. | En la red del navegador no aparece ningún chunk `three*`/`react-three*`/`drei*` en esas pantallas. Métrica "three.js" = no |
| R12 | **Pocas peticiones al abrir una pantalla:** como mucho 2 propias, 3 en la ficha. Lo secundario se pide al abrir su pestaña o su "ver más". Solo se refresca cada minuto donde hace falta (centro de control y Taller 3D) y nunca con la pestaña oculta. | Métrica "peticiones propias". Inicio = 1 (hoy 2) |
| R13 | **Pantallas cortas.** Las 4 pantallas más vistas (Inicio, Resumen de la ficha, Centro de control y lista de órdenes) miden con los datos demo ≤ 1,5 pantallas de alto a 1280 y ≤ 3 a 360 (hoy: cabina 2,9/4,9, ficha 4,4/6,9, centro 3,5/6,5). Lo demás va en su pestaña o detrás de "Ver todo". | Métrica "alto" |
| R14 | **Cada cosa se hace desde un solo sitio por pantalla.** Si existe el menú "Registrar ▾", no se repiten "Anotar km" en el héroe, en la tarjeta de km y en el menú. Si al pulsar un paso del progreso de la orden ya se cambia el estado, sobra el botón "Mover a…". Se aceptan atajos contextuales sueltos, como "Anotar km" junto al kilometraje. | Revisión visual: ninguna acción aparece 2 veces en la primera pantalla |

**Reglas de texto** (van con las anteriores):

- **Tú y en presente.** "Anotaste 54.000 km" mejor que "Lucía Demo registró 54.000 km" cuando solo hay una persona en el espacio.
- **Sin jerga.**
  - "Con historial, sin intervalos" pasa a ser "Sin recordatorio".
  - "Pantalla en preparación" no debe estar en el menú.
  - El color se escribe "Gris", no "#6B7280".
- **Fechas en minúscula y a la española:** "viernes, 23 de octubre", no "Viernes, 23 De Octubre".
- **Lo esencial va primero.** Un aviso vencido empieza por la causa: "Vencido: pasado en 443 km". No vale "El 9 dic 2026 (faltan 47 días) o A los 81.127 km (s…".

---

## 5. Plan por pantalla

Primero van las 4 pantallas que más se ven. Los bocetos ASCII marcan la estructura, no el estilo. El estilo depende de la dirección que elija Alberto (apartado 7). Los bocetos de verdad de "Inicio" están en la carpeta del informe.

### 5.1 Cabina → "Inicio" (particular)

**Problema.** Hoy mezcla dos ámbitos sin decirlo.

- **El vehículo elegido** ocupa el héroe 3D, las 4 cifras y "Desde el último…".
- **Todos los vehículos** ocupan el gráfico, los vencimientos y la actividad.

Por eso salen dos "gastos del año" distintos en la misma pantalla: 2.506,76 € (el vehículo) y 5.274,31 € (todos). Además mide 4,9 pantallas en el móvil, y lo importante (el aviso vencido) queda recortado a 360 px (hallazgo C1).

**Decisión.** Inicio pasa a ser **global**, de todos los vehículos, y **sin 3D**. El detalle de un vehículo vive en su ficha. Así se carga con **una sola petición** (`/workspaces/{ws}/dashboard` ya trae vehículos, vencimientos, gasto y actividad) y no descarga three.js.

```
Inicio                                                        [+ Registrar ▾]
1 aviso vencido y 2 próximos.

Pendiente                                       Según tus intervalos, no medido
─────────────────────────────────────────────────────────────────────────────
! Vencido   Cambio de aceite            El rojo         pasado en 443 km   Marcar hecho
◷ Próximo   Renovar el seguro           El rojo         9 nov · en 17 días Marcar hecho
◷ Próximo   Cambio de aceite y filtros  Kia Sportage    dentro de 641 km   Marcar hecho
Ver la agenda completa (11)

Vehículos                                                       Añadir vehículo
─────────────────────────────────────────────────────────────────────────────
[silueta] El rojo · 4821 KTB      Seat Ibiza 1.0 TSI · 2019   81.570 km · ayer  Anotar km
[silueta] Kia Sportage · 7310 LFW Kia Sportage 1.6 CRDi · 2021 54.000 km · hoy  Anotar km

Gasto                       Ver gastos │ Último registrado              Ver diario
Este mes 470,26 €  Este año 5.274,31 € │ 54.000 km en Kia Sportage     hace 26 min
▁▃▂▂▆▅▃▃▂▄▃█ (12 meses, sin ejes)      │ Aparcamiento 2,90 € · Kia     ayer
                                       │ 81.570 km en El rojo          ayer
```

- **Se quita:**
  - el saludo y la fecha;
  - la retícula del fondo;
  - el héroe 3D giratorio, que pasa a la ficha;
  - el selector de vehículo en tarjetas;
  - las 4 tarjetas de cifras;
  - el bloque "Lo próximo" duplicado;
  - el botón "Inspeccionar zonas", que pasa a la ficha.
- **Se junta.** Los vencimientos y el aviso de "Lo próximo" pasan a ser una sola lista, "Pendiente", con un máximo de 5 filas.
- **Pasa a segundo plano:**
  - el coste por km y el consumo, a la pestaña Gastos de la ficha;
  - "Desde el último…", al Resumen de la ficha;
  - la actividad, que se queda en 3 filas con "Ver diario";
  - el gráfico, que queda pequeño y sin ejes. El detalle está en Gastos.
- **Presupuesto:**
  - 1 petición, 0 `<canvas>`, ≤ 3 cifras grandes y ≤ 6 píldoras;
  - ≤ 1,3 pantallas a 1280 y ≤ 3 a 360.
- **Primer uso** (sin vehículos). Se mantiene el estado vacío con una sola acción, "Añadir vehículo". Fuera los 3 pasos numerados en lima y la mancha de luz.
- **Boceto real.** `boceto-A-1280.png` y `boceto-A-360.png` (y sus versiones B y C).

### 5.2 Ficha del vehículo

**Problema.**

- **Demasiadas pestañas y repetidas.** Hay 7 pestañas (8 en el taller) y tres de ellas cuentan lo mismo de tres formas: un gasto de una intervención sale en Diario, en Historial y en Gastos.
- **El Resumen es una segunda cabina.** Repite las 4 cifras, 2 gráficos, recordatorios y "Desde el último…", y mide 4,4 pantallas. Hay ~1.400 px vacíos al final (hallazgo I2, por confirmar).
- **El 3D llega tarde.** Ocupa la primera pantalla y tarda 6,5 s en aparecer.
- **El 3D sobra en las demás pestañas.** La miniatura de la cabecera descarga three.js en todas ellas.

**Pestañas: de 7 a 5** (6 en el taller):

| Hoy | Propuesta |
|-----|-----------|
| Resumen | **Resumen** (estado del coche) |
| Diario + Historial | **Historial**: todo lo registrado en orden de fecha, con un filtro de tipo (Todo · Intervenciones · Gastos · Kilometraje · Documentos). La vista "día a día" pasa a ser la agrupación por fecha de esta misma lista. El mapa de calor se quita |
| Gastos | **Gastos**: total del periodo, coste por km, consumo, reparto por categoría y lista de gastos. Aquí van las cifras que hoy están en el Resumen |
| Recordatorios | **Recordatorios**, en lista compacta |
| Documentos + Datos | **Datos**: ficha técnica y debajo los documentos, en lista |
| Órdenes (taller) | **Órdenes** (sin cambios, en lista) |

**Resumen:**

```
← Garaje
Kia Sportage · 7310 LFW                          [+ Registrar ▾]  [⋯]
1.6 CRDi Drive · 2021 · Diésel · Automático
54.000 km · leído hoy · Anotar km
Resumen  Historial  Gastos  Recordatorios  Datos
────────────────────────────────────────────────────────────────────
Pendiente                                    Según tus intervalos, no medido
◷ Próximo  Cambio de aceite y filtros   dentro de 641 km · 5 abr 2027   Marcar hecho
  (el resto en plazo: 3) Ver recordatorios

Zonas                                                    [3D | Lista]
┌───────────────────────────────┐  Motor ........... Próximo
│   visor 3D (sin giro solo)    │  Transmisión ..... Sin recordatorio
│   imagen fija hasta que carga │  Frenos .......... Sin datos
└───────────────────────────────┘  … (10 filas de texto, 1 píldora como mucho)

Desde el último
Cambio de aceite   5 abr 2026   hace 201 días · 9.359 km
Revisión           18 ago 2025  hace 431 días · 18.081 km
ITV                25 sept 2025 hace 393 días · 16.194 km
Ver historial
```

- **Se quita del Resumen:**
  - las 4 tarjetas de cifras (el kilometraje ya está en la cabecera);
  - los dos gráficos, que pasan a Gastos y al filtro Kilometraje del Historial;
  - "Últimas intervenciones", que se cubre con "Ver historial";
  - el interruptor "Rayos X" de la cabecera de la sección, que pasa a un control pequeño dentro del visor.
- **La cabecera:**
  - sin miniatura en la caja de 192×112 px: como mucho una silueta SVG pequeña al lado del nombre, que no descarga three.js;
  - "Informe" pasa al menú "⋯";
  - la píldora de vencidos se cambia por la línea "1 aviso vencido".
- **En el móvil:**
  - la cabecera mide ≤ 200 px (hoy unos 400);
  - con 5 pestañas cortas caben las 5 a 360 px. Si un día no caben, la última pasa a "Más ▾" en lugar de quedar escondida en un desplazamiento lateral que no se ve;
  - el mapa de zonas se abre en **Lista**, con "Ver en 3D" (apartado 5.7).
- **Presupuesto:**
  - ≤ 3 peticiones (vehículo, resumen y zonas; las zonas solo al ver la sección);
  - 1 `<canvas>`, solo en Resumen y en escritorio;
  - ≤ 1,5 pantallas a 1280 y ≤ 3 a 360.
- **Historial:**
  - una fila por intervención: fecha · título · km · importe;
  - el detalle se despliega al pulsar la fila;
  - "Editar" y "Archivar" van en el menú de la fila. Hoy aparecen 7 veces "Ver detalle / Editar / Archivar" y 7 veces "Cuenta como gasto".
- **Documentos.** Lista con nombre · tipo · fecha · tamaño · descargar. Fuera las tarjetas con el icono de PDF gigante.

### 5.3 Centro de control (taller)

**Problema.** La misma información sale cuatro veces:

1. el subtítulo, "14 órdenes abiertas · 7 van tarde · 2 para hoy";
2. 4 tarjetas de cifras;
3. 5 tarjetas por estado;
4. las listas "Tarde" y "Para hoy".

A eso se suman la escena 3D, una franja de 4 elevadores y el panel lateral, que también se repiten entre sí. Además lleva facturación, alertas de flota y 8 filas de actividad. En total hay 31 cajas, 39 píldoras y 5,3 s hasta quitar los esqueletos.

```
Centro de control                                 [Tablero]  [+ Nueva orden]
14 abiertas · 7 tarde · 2 para hoy · 1 de 4 elevadores libre

Requiere atención (tarde o para hoy)                          Ver en el tablero
───────────────────────────────────────────────────────────────────────────────
Nº    Trabajo                        Vehículo              Estado        Prometida
0016  Correa de distribución y bomba Reparto 3 · 5512 MDK  Esp. piezas   ! mar 20 oct 18:00
0024  Carga de aire acondicionado    Toyota Corolla · 4470…En reparación ! hoy 13:00
0027  Cambio de aceite y filtros     Prácticas 1 · 6701…   Recibido        hoy 14:00
…  (máx. 8 filas; urgente con texto "Urgente")

Elevadores                                                   Ver Taller 3D →
───────────────────────────────────────────────────────────────────────────────
Elevador 1  Reparto 1 · 2207 LBC   0019 Discos y pastillas   En reparación  Andrés
Elevador 2  Taxi 24h · 6629 KSM    0018 Sustitución embrague En reparación  Andrés
Elevador 3  Reparto 2 · 9930 KZF   0023 Testigo de motor     Diagnóstico    Andrés
Elevador 4  Libre                                            [Subir coche ▾]
En espera: 11 coches · Ver en el tablero

Alertas de flota (2)                                         Agenda de flota →
! Vencido  ITV de la furgoneta  Reparto 1 · 2207 LBC   13 oct (hace 10 días)
◷ Próximo  ITV                  Reparto 2 · 9930 KZF   3 nov (en 11 días)
```

- **Se quita:**
  - la fecha de adorno;
  - las 4 tarjetas de cifras, que pasan a la línea de resumen;
  - las 5 tarjetas por estado, porque eso ya es el tablero;
  - **la escena 3D y la franja de elevadores**, que se quedan en Taller 3D;
  - el panel "Elevadores y espera", que pasa a ser la tabla "Elevadores";
  - el gráfico de importes, que pasa a Facturación o Analítica (lo decide Alberto en la pregunta 1 del tablero);
  - la actividad del equipo, que pasa a Equipo.
- **Se junta.** "Tarde" y "Para hoy" quedan en una tabla, "Requiere atención". Una orden tarde y para hoy salía antes en las dos.
- **Presupuesto:**
  - 2 peticiones (el panel y las órdenes abiertas, que se refrescan cada minuto solo con la pestaña visible);
  - 0 `<canvas>`, ≤ 8 píldoras;
  - ≤ 1,5 pantallas a 1280.
- **Mecánico.** La misma pantalla sin importes y con "Mis órdenes" primero.

### 5.4 Órdenes: tablero, detalle y nueva orden

**Tablero** (hoy 19 cajas, 14 de ellas dentro de la columna; 17 píldoras; 14 miniaturas que descargan three.js; títulos de columna cortados a 1280: "En diagnós…", "Esperando …", "En reparaci…").

```
Órdenes de trabajo                                              [+ Nueva orden]
[Tablero | Lista]   [Buscar nº, matrícula o cliente…]   Mecánico [Todos ▾]  [Solo tarde (7)]

Recibido 3       Diagnóstico 2     Piezas 3          Reparación 3      Listo 3
┌────────────┐   ┌────────────┐
│Revisión    │   │Diagnóstico │   (tarjetas sin miniatura, 3 líneas)
│oficial     │   │testigo…    │
│Mazda MX‑5 ·│   │Reparto 2 · │   línea 2: vehículo · matrícula (texto)
│5106 KHG    │   │9930 KZF    │
│Sin asignar │   │! Tarde · Andrés · ayer 19:00     línea 3: aviso + mecánico + fecha
└────────────┘   └────────────┘
```

- **Columnas.** Sin caja alrededor, con nombres cortos que caben: Recibido · Diagnóstico · Piezas · Reparación · Listo. Para el lector de pantalla se mantiene el nombre completo.
- **Tarjeta.** Lleva título (2 líneas como mucho), vehículo · matrícula en texto, y una línea con "Tarde" o "Urgente" (solo si aplica) + mecánico + fecha. El número corto ("0024") va en gris al final.
  - Fuera la miniatura y la matrícula con forma de placa.
  - Fuera el cliente, que está en el detalle.
  - Fuera la prioridad "Baja" o "Alta": solo se marca "Urgente".
- **Fuera el texto de ayuda** "Arrastra una tarjeta a otra columna (Escape cancela)…". El botón "Mover a…" de cada tarjeta ya lo explica, y se puede dejar como ayuda en un tooltip.
- **Móvil.** Se abre por defecto en **Lista agrupada por estado** (secciones plegables). El tablero horizontal se queda como opción. Los filtros caben en una fila ("Filtros ▾").
- **Presupuesto:** 0 three.js, tarjetas ≤ 110 px de alto, ≤ 1,5 pantallas.

**Detalle de orden** (hoy 15 cajas, 7 anidadas, 5 peticiones y 2,7 pantallas):

- **Cabecera en dos líneas.** Título, y debajo "OT‑2026‑0024 · Toyota Corolla 4470 LJD · Carmen Ficticia Ruiz · prometida hoy 13:00 (tarde)".
  - Fuera las 3 píldoras, que repiten el estado del progreso.
  - Fuera el botón "Mover a…", que repite los pasos.
  - La acción primaria es el siguiente paso ("Marcar como lista").
- **Piezas y mano de obra en tabla:** Tipo | Concepto | Cant. | Precio | Total | 🗑, una fila por línea. Hoy cada línea es una caja con 5 campos con etiqueta propia ("Tipo (línea 1)"…).
- **Elevador con un selector** ("Elevador: Sin elevador ▾", con los ocupados deshabilitados), en vez de 5 tarjetas.
- **Columna lateral.** Solo queda el total (subtotal, IVA y total) y las fechas. El vehículo y el cliente pasan a la cabecera.
- **Planificación.** La prioridad pasa a un selector; el mecánico, los km de entrada y la fecha prometida se quedan.
- **Un solo modelo de guardado.** O todo se guarda al momento, o hay barra de guardar fija. Hoy el estado y el elevador se aplican al momento y el resto con un botón, y la pantalla tiene que explicarlo con un texto.

**Nueva orden** (hoy 2,6 pantallas; lista de 6 vehículos con miniatura 3D):

- **Paso 1. Vehículo.** Buscador con desplegable de resultados (matrícula, modelo o cliente), sin lista de tarjetas. "Coche nuevo" queda como enlace.
- **Paso 2. Qué le pasa.** Título (con las 6 sugerencias), síntoma y prioridad en un selector.
- **"Más opciones" plegado:** elevador, mecánico, km de entrada, fecha prometida, piezas. Si no se tocan, se guardan los valores por defecto.
- **Sin columna de resumen lateral**, porque repite lo que hay en el formulario.

### 5.5 Resto de pantallas

| Pantalla | Qué se quita / junta / pasa a segundo plano | Estructura objetivo |
|----------|---------------------------------------------|---------------------|
| **Portada** | **Se quitan:** <br>• la escena 3D coreografiada con el scroll; <br>• el chip "Para particulares y para talleres"; <br>• el titular a dos colores; <br>• "Desliza"; <br>• los "01 02 03" gigantes; <br>• la mancha de luz. <br>**Se arregla** que las secciones salgan **en blanco** hasta hacer scroll (hallazgo I1). | Titular descriptivo de una línea ("Lleva el mantenimiento y los gastos de tus coches, o los de tu taller") + 2 botones + **captura real de la app** (así lo pedía el plan inicial, §6) o imagen fija del coche. Después: Particular / Taller en dos columnas de texto, el mapa de zonas con una captura y los principios. Sin three.js al cargar; como mucho un botón "Ver en 3D" |
| **Entrar / Registro** | **Se quitan:** <br>• el panel de marca de media pantalla (retícula, brillo, lema en mayúsculas, 4 "features" con baldosa); <br>• "Tu garaje y tu taller te esperan". <br>Las cuentas demo se quedan (solo en desarrollo). | Una columna centrada: logotipo, "Entra en CarCare", formulario y enlace a registro. Como mucho, una frase debajo sobre qué es CarCare |
| **Garaje** | **Se quitan:** <br>• el control Activos/Archivados, que pasa a ser el enlace "Ver archivados (n)"; <br>• el buscador y el orden con menos de 7 vehículos; <br>• la miniatura 3D, que pasa a silueta o imagen estática. <br>Las píldoras se quedan solo para lo vencido o próximo. | Rejilla de tarjetas con imagen (aquí sí aporta), 3 líneas por tarjeta: nombre · matrícula, modelo · año, km · aviso |
| **Vehículos (flota del taller)** | Hoy son 20 tarjetas, 22 píldoras y 40 etiquetas en mayúsculas (las matrículas): **10 pantallas de alto en el móvil**. | **Tabla**: Vehículo · Matrícula · Cliente · Km · Orden abierta · Avisos, con búsqueda y orden. En el móvil, lista de 2 líneas |
| **Agenda** | **Se quitan:** <br>• las tarjetas de recordatorio (unos 140 px cada una); <br>• el aviso "no medido" repetido 12 veces; <br>• el botón "Hecho" con borde ×11. <br>**Se juntan** los 3 filtros (estado, vehículo, vista) en una fila; en el móvil, en un "Filtros ▾". **Se pliega** el grupo "En plazo" (8). | Grupos *Vencidos* / *Próximos* / *En plazo (8) ▸*. Cada fila: estado · título · vehículo · cuándo · "Marcar hecho" (enlace) · menú. El progreso, como texto ("94 % del intervalo"), o una barra fina de 2 px sin leyenda |
| **Agenda de flota** | Igual que la agenda. | Igual que la agenda + columna de cliente |
| **Formulario de vehículo** | **Se quita:** <br>• la vista previa 3D en los pasos 1, 3 y 4: solo aparece en el paso "Aspecto", donde se elige carrocería y color; <br>• las sugerencias de marca en orden alfabético (Abarth, Alfa Romeo, Alpine, Aston Martin…), que pasan a las más comunes en España o desaparecen (el campo ya autocompleta). | 4 pasos, una columna; vista previa solo en "Aspecto" |
| **Nueva intervención** | **Se quitan:** <br>• las 5 cajas, que pasan a ser secciones con título; <br>• los 11 chips con icono, que se quedan en 6 sin icono; <br>• la columna de resumen. <br>**Pasan a "Más detalles":** zona y "servicio concreto", que se rellenan solos al elegir el chip. <br>**Coste:** solo "Total"; "Desglosar en piezas y mano de obra" se pliega. | Qué se hizo (chips + título) · Cuándo (fecha, km, taller) · Coste (total) · Notas · [Guardar]. ≤ 1,5 pantallas |
| **Ajustes** | **Se quitan:** <br>• las cajas dentro de cajas en "Espacios"; <br>• las baldosas de icono de cada sección; <br>• la sección "Apariencia", que se queda solo con el selector de tema (el aviso de movimiento reducido pasa a un texto de ayuda). | Secciones con título y separador: Perfil · Contraseña · Apariencia · Espacios · Zona peligrosa |
| **Informe imprimible** | **Es la referencia de estilo.** Solo: quitar las MAYÚSCULAS de las cabeceras de tabla (26 etiquetas) y la matrícula con forma de placa. | Sin cambios de estructura |
| **Clientes** | Las píldoras "2 vehículos" y "2 órdenes abiertas" pasan a números en dos columnas. **Se quitan** las iniciales en círculo y los iconos de teléfono y email. | Tabla: Cliente · Teléfono · Email · NIF · Vehículos · Órdenes abiertas |
| **Detalle de cliente** | **Se quitan:** <br>• la etiqueta "CLIENTE"; <br>• el contacto dentro de cajas; <br>• las miniaturas 3D de vehículos y órdenes. | Cabecera (nombre + contacto en una línea) · Vehículos (lista) · Órdenes (tabla) |
| **Equipo** | **Se quita** "Único propietario", que repite la nota de abajo. La explicación de los roles se pliega en "¿Qué puede hacer cada rol?". La actividad, en lista de 10 con "Ver más". | Tabla de personas con su rol · actividad |
| **Taller 3D** | **Se quita** la franja de 4 elevadores bajo la escena, que repite los rótulos y el panel. El panel lateral pasa a ser una lista sin cajas. | Escena a toda la altura + lista lateral. Aquí **sí** va el 3D |
| **Analítica / Facturación** | Hoy las dos llevan al aviso "Pantalla en preparación", y la cabina y el centro enlazan a ellas (hallazgo C2). La Analítica la está construyendo `frontend-react` (tarea 17). El nombre y el alcance de "Facturación" esperan a la pregunta 1 del tablero. | Mientras no exista, **no sale en el menú** (regla de oro 5) |

### 5.6 Navegación

- **Particular.** Solo tiene 3 secciones (Inicio, Garaje y Agenda; Analítica cuando exista). La barra lateral de 256 px sobra.
  - **Propuesta:** barra superior con las secciones a la izquierda y buscar + avatar a la derecha. El contenido, centrado a un máximo de 1.000‑1.100 px. Es lo que muestran los bocetos.
  - En el móvil, barra inferior: Inicio · Garaje · [+ Registrar] · Agenda · Más.
- **Taller.** Tiene 7‑8 secciones, así que **mantiene la barra lateral**, más estrecha (220 px) y sin el anillo lima del avatar.
  - En la barra inferior del móvil, "Centro de control" pasa a "Inicio" (el texto no cabe).
- **Barra superior:**
  - el buscador se queda como campo, pero sin el `Ctrl K` dibujado (el atajo sigue funcionando);
  - el cambio de tema sale de la barra, porque está en Ajustes y en el avatar;
  - el selector de espacio pasa a ser texto ("Mi garaje ▾") sin baldosa de icono.

### 5.7 Dónde va el 3D (decisión)

| Sitio | Hoy | Propuesta | Por qué |
|-------|-----|-----------|---------|
| Ficha · Resumen (mapa de zonas) | `<canvas>` en la primera pantalla, 6,5 s | **Se queda.** Sin girar solo; se pinta solo cuando algo cambia (`frameloop="demand"`). Imagen fija o silueta mientras carga, y se monta cuando la sección es visible. **En el móvil se abre en "Lista"** con un botón "Ver en 3D" | Es lo distintivo del producto y conecta el estado con el coche. En el móvil la lista se lee mejor y ahorra batería |
| Taller 3D (`/taller`) | `<canvas>` a pantalla completa | **Se queda** | Es la vista propia del taller |
| Formulario de vehículo | `<canvas>` en los 4 pasos | **Solo en el paso "Aspecto"** | Es donde ver el color y la carrocería aporta |
| Cabina | `<canvas>` girando sin parar (`frameloop="always"` mientras se ve) | **Fuera.** Silueta estática en la lista de vehículos | Gasta GPU y batería en la pantalla que más se abre, y no informa |
| Centro de control | `<canvas>` del taller embebido | **Fuera.** Tabla de elevadores + enlace "Ver Taller 3D" | Ya existe la pantalla completa |
| Portada | Escena coreografiada con el scroll, 5,3 pantallas | **Imagen fija** (captura real o render estático) + "Ver en 3D" opcional | Primera impresión rápida; nada de 3D "de exhibición" |
| Miniaturas (garaje, cabecera de la ficha, tablero, nueva orden, cliente) | Render WebGL en tiempo de ejecución (descarga three.js) | **Imagen estática sin three.js en tiempo de ejecución.** Silueta SVG coloreada (ya existe y D16 dice "mantener la silueta") o PNG/WebP pre-renderizadas por carrocería | Con esto 14 pantallas dejan de descargar three.js (I7) |

---

## 6. Señales de "hecho con IA" y su alternativa natural

Ordenadas de más a menos evidentes. Las capturas están en la carpeta del informe con el prefijo `actual-`. Las rutas de archivo son de `frontend/src/`; cito el texto exacto para poder buscarlo, porque las líneas cambian mientras otros agentes trabajan.

| # | Señal | Ejemplo real | Alternativa natural |
|---|-------|-------------|---------------------|
| 1 | **Etiquetas en MAYÚSCULAS con letras separadas** (36 usos de `uppercase` en `.tsx`) | "VIERNES, 23 DE OCTUBRE", "CUENTAKILÓMETROS", "LO PRÓXIMO", "KM ESTE MES", "ZONAS (10)", "EN ESPERA (11)", "PARTICULARES Y TALLERES". Están en `components/ui/PageHeader.tsx` (`eyebrow`), `components/ui/StatCard.tsx`, `features/dashboard/PersonalDashboard.tsx`, `components/vehicles/ZoneMap.tsx`, `features/auth/AuthLayout.tsx`, `features/workshop/components/FloorPanel.tsx` y `features/landing/LandingPage.tsx` (×4). Capturas: `actual-cabina-1280.png`, `actual-login-1280.png` | La etiqueta como frase, en color secundario ("Kilometraje"), o ninguna etiqueta: "81.570 km" ya se explica sola |
| 2 | **Saludo y fecha encima del título** | "VIERNES, 23 DE OCTUBRE / Hola, Lucía / Tienes 1 recordatorio vencido y 2 próximos." (`PersonalDashboard.tsx`, `eyebrow={formatDate(todayISO(), 'weekday')}` y `` `Hola, ${firstName}` ``). La fecha se repite en el centro de control (`WorkshopDashboard.tsx`) | Título "Inicio" y la línea de estado solo si informa |
| 3 | **Lemas de marketing y frases en paralelo** | "Tu coche, al día. Tu taller, bajo control." (portada y `AuthLayout.tsx`, dos veces), "Todo lo de tus vehículos, de un vistazo." (cabina), "Tu garaje y tu taller te esperan." (`LoginPage.tsx`), "Del garaje de casa a la nave del taller.", "Tres pasos y ya está en marcha.", "Honestos con tus datos.", "Empieza por tu coche. O por todo tu taller.", "Gastos que se entienden" | Frases descriptivas y concretas: "Entra con tu email", "CarCare guarda el historial, los gastos y los vencimientos de tus vehículos". Ni lemas ni dobles frases cortas que riman |
| 4 | **Titular a dos colores con un chip encima** | Portada: chip "● Para particulares y para talleres" + "Tu coche, al día." en blanco + "Tu taller, bajo control." en lima (`LandingPage.tsx`). Captura `actual-portada-1280.png` | Titular de un color y una línea; sin chip |
| 5 | **Panel de marca a media pantalla en el login** con retícula enmascarada, mancha de luz (`blur-[120px]`) y 4 "features" con icono en baldosa | `AuthLayout.tsx`. Captura `actual-login-1280.png` | Login centrado de una columna. Si se quiere algo a la derecha, una captura real de la app |
| 6 | **Adornos de fondo**: retícula, brillos y degradados (11 `gradient`, 16 `backdrop-blur`, 3 `bg-grid`) | Retícula con máscara radial en el héroe de la cabina; mancha lima `blur-3xl` en el primer uso y en la portada; degradado lima en la cifra destacada (`StatCard.tsx`, `emphasis`); marcos con degradado detrás de cada miniatura (`VehicleCard.tsx`, `VehicleDetailPage.tsx`); barras traslúcidas con desenfoque | Superficies planas y un borde de 1 px. Cabeceras opacas |
| 7 | **Rejillas de "tarjetas de cifras" con icono en la esquina** (22 `<StatCard>`) | Cabina: 4 tarjetas + 2 cifras más en el gráfico. Ficha: 4. Diario: 3. Gastos: 3. Centro: 4 + 5 tarjetas por estado | 1‑3 cifras en una línea de texto o en una tabla. El resto, en su pestaña |
| 8 | **Iconos en todo**: 46 visibles en la cabina, 75 en la ficha, 87 en la agenda | Icono en cada etiqueta de cifra, delante de cada fecha y cada km de los recordatorios (`ReminderItem.tsx`: `CalendarDays`, `Gauge`), icono en "baldosa" de 36 px en cada fila (9 sitios), icono en cada título de tarjeta (`CardHeader icon`) y en cada chip | Iconos solo en navegación, botones de icono y estados. Sin baldosas |
| 9 | **Píldoras para todo** (35 `<Badge>`/`<StatusPill>`): 39 en el centro, 22 en clientes y flota, 17 en el historial, 14 en la ficha | "En plazo", "Sin datos", "Con historial, sin intervalos", "Baja", "Mantenimiento", "Motor", "38 km recorridos", "2,90 €", "Elevador 1", "Depósito lleno", "Desde su intervención", "2 vehículos" | Texto gris normal. Píldora solo para Vencido, Próximo, Tarde, Urgente y Archivado (R5) |
| 10 | **Todo en cajas iguales con radio grande** (16 y 24 px; `rounded-hero` en 21 sitios) y cajas dentro de cajas | Una caja por sección, por recordatorio, por día del diario y por documento. Cajas dentro de cajas en Ajustes → Espacios, en el panel del centro y en el detalle de orden (7 anidadas) | Secciones sin caja, filas con separador. Radio pequeño (6‑8 px) y solo en controles y en los pocos contenedores que quedan |
| 11 | **Tipografía "tecnológica" de titulares** (Space Grotesk, `font-display` en 69 sitios) combinada con Inter | Todos los títulos, las cifras y los nombres de vehículo | Una sola familia (Inter) con pesos. Si se quiere carácter, una serif sobria en títulos (dirección C) |
| 12 | **Lima neón sobre carbón con tinte azul** (`#C7F36B` sobre `#111518`) usada como firma por todas partes, no como acento | Botones, enlaces ("Analítica", "Agenda", "Ver todos"), icono activo del menú, barra activa, mes actual del gráfico, puntos de la actividad, pasos "01 02 03", anillo del avatar, reflejos lima en los cristales del coche de la portada | Ver el apartado 7. Como mucho, un acento y en 2‑3 usos |
| 13 | **Detalles "de exposición"** | "Desliza" con una línea vertical (portada); `Ctrl K` dibujado en la barra; `Esc` dibujado en el panel de zona; matrícula imitando placa con banda azul y letra monoespaciada (`Plate` en `Badge.tsx`); aparición escalonada de cada bloque al hacer scroll (`Reveal`) | Quitarlos. Los atajos siguen funcionando y se explican en la ayuda |
| 14 | **Textos de relleno que dicen lo evidente o se repiten** | "Datos tal como los guardaste. Lo que no indicaste aparece como «Sin indicar»." (`DataTab.tsx`); "Elige un elevador o un coche en espera, en la escena o en la lista, para ver su ficha y moverlo." (`FloorPanel.tsx`); "Arrastra una tarjeta a otra columna (Escape cancela)…" (`OrdersPage.tsx`); "Cuenta como gasto" ×7 (`HistoryTab.tsx`); "Según tus intervalos, no medido" ×12 en la agenda | Decirlo una vez, o en la ayuda o en un tooltip |
| 15 | **Actividad en tercera persona con nombre y apellido en un espacio de una sola persona** | "Lucía Demo registró 54.000 km en Kia Sportage" (lo devuelve la API en `Activity.summary`) | "54.000 km en Kia Sportage · hace 26 min", o "Anotaste…". Lo pido en el tablero (petición al arquitecto y al backend) |
| 16 | **Exceso de estados de carga detallados** | Esqueletos que copian la pantalla al milímetro (4 tarjetas, héroe de 440 px, franja de elevadores…) y que se ven aunque la respuesta tarde 200 ms | Un esqueleto simple (2‑3 bloques) que solo aparece si la carga pasa de unos 300 ms |

---

## 7. Dirección visual: tres propuestas para que elija Alberto

**Son opciones para más adelante.** Alberto ha confirmado que el diseño lo cambiará más tarde, así que hoy no se aplica ninguna.

- **Lo que no cambia.** Las tres usan las mismas reglas del apartado 4 y la misma estructura del apartado 5, que es lo que se está aplicando ahora con los colores actuales.
- **Lo que cambia.** Solo el color, la letra, los radios y el tono de los textos.
- **Cómo se aplicará.** Cambiando los tokens de `frontend/src/index.css` (los dos temas y el bloque `.paper`) y, como mucho, una fuente. No hay que rehacer pantallas: al simplificar, los componentes ya usan solo tokens (`bg-surface`, `text-fg-muted`, `border-line`…), sin colores escritos a mano.
- **Única condición para el paso 2.** Quien simplifique ahora no debe meter colores, sombras ni degradados nuevos fuera de los tokens; si no, el cambio de dirección ya no sería solo de tokens.

**Bocetos.** Hay un boceto real de "Inicio" para cada dirección, con los datos de la cuenta demo: El rojo, Kia Sportage, el aceite vencido por 443 km, 470,26 € este mes y 5.274,31 € este año.

| Dirección | Modo por defecto, 1280 px | Modo por defecto, 360 px | El otro modo, 1280 px |
|-----------|---------------------------|--------------------------|-----------------------|
| A · Claro y sobrio | [boceto-A-1280.png](2026-10-23-disenador-ux-simplificacion/boceto-A-1280.png) | [boceto-A-360.png](2026-10-23-disenador-ux-simplificacion/boceto-A-360.png) | [oscuro](2026-10-23-disenador-ux-simplificacion/boceto-A-otro-modo-1280.png) |
| B · Grafito tranquilo | [boceto-B-1280.png](2026-10-23-disenador-ux-simplificacion/boceto-B-1280.png) | [boceto-B-360.png](2026-10-23-disenador-ux-simplificacion/boceto-B-360.png) | [claro](2026-10-23-disenador-ux-simplificacion/boceto-B-otro-modo-1280.png) |
| C · Libro de mantenimiento | [boceto-C-1280.png](2026-10-23-disenador-ux-simplificacion/boceto-C-1280.png) | [boceto-C-360.png](2026-10-23-disenador-ux-simplificacion/boceto-C-360.png) | [tinta](2026-10-23-disenador-ux-simplificacion/boceto-C-otro-modo-1280.png) |

- **El código del boceto.** Está en [`boceto-inicio.html`](2026-10-23-disenador-ux-simplificacion/boceto-inicio.html). Se elige la dirección con el final de la dirección web: `#A`, `#B` o `#C`, y el otro modo con `#A-alt`, `#B-alt` o `#C-alt`.
- **Las siluetas del boceto** están dibujadas a mano. En la app irían las siluetas SVG que ya existen: se ven en [`actual-garaje-silueta-2d.png`](2026-10-23-disenador-ux-simplificacion/actual-garaje-silueta-2d.png) y son mucho mejores.
- **Contraste.** Todos los pares de color de las 6 paletas pasan AA, sin ningún fallo:
  - texto normal ≥ 4,5:1;
  - bordes de campo, foco y barras de gráfico ≥ 3:1.

  Lo comprueba [`contraste-paletas.cjs`](2026-10-23-disenador-ux-simplificacion/contraste-paletas.cjs) con la fórmula WCAG 2.x (`node contraste-paletas.cjs`). En las tablas pongo el peor caso de cada token.

### Dirección A · "Claro y sobrio" (recomendada)

- **La idea.** Una herramienta de gestión clara, como un buen programa de facturas o de banca: fondo casi blanco, texto casi negro, tablas con líneas finas y un solo color para actuar. Es lo que ya tiene el informe imprimible, que hoy es la pantalla más natural de la app.
- **Inspiración** (solo en el tipo de sobriedad, sin copiar nada de marca):
  - el panel de Stripe, por las tablas densas y un único color de acción;
  - el sistema de diseño de GOV.UK, porque el texto va primero y no hay adornos;
  - Ajustes y Notas de Apple, por las listas agrupadas.
- **Modo.** Claro por defecto y oscuro opcional (el tema se elige en Ajustes, como ahora).

| Token (`index.css`) | Claro | Oscuro | Peor contraste |
|---------------------|-------|--------|----------------|
| `--base` (fondo de página) | `#F7F7F5` | `#161718` | — |
| `--surface` (cajas, tablas) | `#FFFFFF` | `#1E1F21` | — |
| `--surface-2` (hover, fila seleccionada, relleno de campo) | `#F1F1EE` | `#26282A` | — |
| `--line` (separador decorativo) | `#E3E2DD` | `#2E3033` | decorativo |
| `--line-strong` (borde de campo) | `#8A8984` | `#71767A` | 3,10:1 / 3,22:1 sobre `--surface-2` |
| `--fg` (texto) | `#1B1D1F` | `#EDEDEB` | 14,9:1 / 12,6:1 |
| `--fg-muted` (texto secundario) | `#575C61` | `#A6A9AC` | 5,97:1 / 6,26:1 |
| `--fg-subtle` (metadatos) | `#64696F` | `#8E9296` | 4,89:1 / 4,72:1 |
| `--accent` = `--accent-ink` (botón primario, enlaces, foco) | `#24613A` (verde bosque) | `#7CC495` | texto 6,88:1 / 8,00:1 |
| `--on-accent` (texto sobre el botón) | `#FFFFFF` | `#111312` | 7,38:1 / 9,05:1 |
| `--danger` · `--warning` · `--ok` · `--info` | `#B42318` · `#8A5300` · `#1E6B43` · `#2556A3` | `#F07A6E` · `#E0A854` · `#6CC79B` · `#86B6EA` | ≥ 6,06:1 |
| Barra neutra de gráfico (mes actual = acento) | `#8F8E88` | `#6B7074` | 3,29:1 / 3,29:1 |

- **Tipografía.** Solo **Inter**, que ya está autoalojada, en pesos 400, 500 y 600.
  - Escala: 13 · 14 · 16 · 20 · 24 px.
  - Cifras tabulares en importes y km.
  - **Se quita Space Grotesk:** una fuente menos que descargar.
- **Radios:**
  - 6 px en botones y campos;
  - 10 px en las cajas de sección;
  - el radio de 24 px desaparece.
- **Densidad:**
  - filas de 44‑48 px;
  - contenido centrado a un máximo de 1.000 px en particular;
  - una caja blanca por sección, nunca una dentro de otra.
- **Sombras.** Ninguna, salvo en menús y diálogos (`0 8px 24px rgb(0 0 0 / .08)`).
- **Tono de los textos.** Tuteo, frases cortas y descriptivas, sin lemas. Ejemplos:
  - "1 aviso vencido y 2 próximos";
  - "Marcar hecho";
  - "pasado en 443 km".
- **El lima.** Desaparece de la interfaz. El verde de marca pasa a verde bosque. Si Alberto quiere conservarlo, como mucho en el logotipo.
- **Qué cambia en la app:**
  - los tokens de `index.css` (los dos temas);
  - `--fg-warm` se quita, porque basta un color de texto;
  - `font-display` pasa a Inter;
  - `--radius-card` pasa de 16 a 10 y `--radius-hero` se quita;
  - el foco pasa a un anillo verde bosque;
  - los gráficos pasan a gris + acento;
  - el visor 3D pasa a un estudio claro (lo ajusta `experto-3d`);
  - el informe imprimible ya usa casi esta paleta.
- **Esfuerzo y riesgo.** Es el más bajo. No añade dependencias; es cambiar tokens y quitar la fuente. El modo oscuro sigue disponible para quien lo prefiera.

### Dirección B · "Grafito tranquilo" (evolución del aspecto actual)

- **La idea.** Mantener el oscuro y el lima, que son la identidad que Alberto eligió al principio, pero callarlos: grises neutros sin el tinte azul de `#111518`, el lima solo en 3 sitios y sin adornos.
- **Inspiración:**
  - Linear y el panel de Vercel, por el oscuro neutro con el texto como protagonista;
  - los editores de código, porque el color solo marca lo importante.
- **Modo.** Oscuro por defecto y claro opcional.

| Token (`index.css`) | Oscuro | Claro | Peor contraste |
|---------------------|--------|-------|----------------|
| `--base` | `#151617` | `#F6F6F5` | — |
| `--surface` | `#1C1E1F` | `#FFFFFF` | — |
| `--surface-2` | `#242628` | `#EFEFED` | — |
| `--line` | `#2D3032` | `#E2E2DF` | decorativo |
| `--line-strong` | `#6E7377` | `#878783` | 3,17:1 / 3,13:1 sobre `--surface-2` |
| `--fg` | `#ECECEA` | `#18191A` | 12,8:1 / 15,3:1 |
| `--fg-muted` | `#A3A6A8` | `#55585B` | 6,20:1 / 6,22:1 |
| `--fg-subtle` | `#8B8F92` | `#62666A` | 4,66:1 / 5,03:1 |
| `--accent` (relleno del botón primario) | `#BFE07A` (lima apagada) | `#BFE07A` | texto encima 12,2:1 / 11,9:1 |
| `--accent-ink` (foco; los enlaces van en `--fg` subrayados) | `#BFE07A` | `#3D6B00` | 11,3:1 / 5,88:1 |
| `--on-accent` | `#151617` | `#18191A` | ver arriba |
| `--danger` · `--warning` · `--ok` · `--info` | `#F2766B` · `#E2AA4F` · `#6CC79B` · `#83B4E8` | `#B42318` · `#8A5300` · `#1E6B43` · `#2556A3` | ≥ 6,04:1 |
| Barra neutra de gráfico | `#666B6F` | `#8D8E8A` (mes actual `#3D6B00`) | 3,11:1 / 3,30:1 |

- **Tipografía.** Solo Inter, con la escala 13 · 14 · 15 · 18 · 22 px. Se quita Space Grotesk.
- **Radios.** 6 px en controles y 8 px en contenedores.
- **Densidad.** La mayor de las tres: secciones **sin caja**, separadas por el título y una línea; filas de 40‑44 px.
- **Tono de los textos.** El mismo que en A.
- **El lima.** Solo 3 usos: el botón primario, el anillo de foco y el mes actual en los gráficos.
  - Nunca en enlaces (que van en texto subrayado), ni en iconos activos, puntos o pasos.
  - El tono baja de `#C7F36B` (neón) a `#BFE07A`.
- **Qué cambia en la app:**
  - los tokens;
  - la tipografía;
  - quitar los usos del lima como texto (`text-accent-ink` en enlaces, iconos y puntos de actividad);
  - quitar las cajas de sección.
- **Esfuerzo y riesgo.**
  - **Esfuerzo:** bajo.
  - **Riesgo:** el oscuro con un acento verde‑amarillo sigue recordando a muchas plantillas de 2024‑2026. Parece "menos IA", pero no del todo.

### Dirección C · "Libro de mantenimiento" (cálida, editorial)

- **La idea.** Que la app se parezca al libro de mantenimiento en papel del coche y a una factura de taller bien hecha:
  - papel cálido y tinta;
  - títulos en una serif sobria;
  - una línea gruesa bajo cada sección, como en una ficha.

  Es la más "humana" y la que más se aleja de lo genérico.
- **Inspiración:**
  - el libro de revisiones de un coche;
  - Basecamp y HEY, por el texto y las listas con tono humano;
  - iA Writer, por el papel y la tipografía cuidada;
  - el propio informe imprimible de CarCare.
- **Modo.** Papel (claro) por defecto y "tinta" (oscuro cálido) opcional.

| Token (`index.css`) | Papel | Tinta | Peor contraste |
|---------------------|-------|-------|----------------|
| `--base` | `#F3F0E8` | `#1A1814` | — |
| `--surface` | `#FBF9F4` | `#221F1A` | — |
| `--surface-2` | `#ECE7DC` | `#2A2620` | — |
| `--line` | `#DAD3C5` | `#3A352D` | decorativo |
| `--line-strong` | `#857E70` | `#7E7667` | 3,27:1 / 3,35:1 sobre `--surface-2` |
| `--fg` | `#24211C` | `#EDE8DD` | 13,0:1 / 12,3:1 |
| `--fg-muted` | `#5B554B` | `#B3AB9C` | 5,98:1 / 6,60:1 |
| `--fg-subtle` | `#6A6458` | `#9C9485` | 4,76:1 / 5,00:1 |
| `--accent` = `--accent-ink` | `#1F4D3A` (verde inglés) | `#8DBFA3` | texto 8,46:1 / 7,91:1 |
| `--on-accent` | `#FBF9F4` | `#1A1814` | 9,15:1 / 8,54:1 |
| `--danger` · `--warning` · `--ok` · `--info` | `#A3271B` · `#855000` · `#2B6A44` · `#2B4F86` | `#E8806F` · `#D9A55A` · `#8CC79F` · `#8FB0E0` | ≥ 6,06:1 |
| Barra neutra de gráfico | `#8F8676` | `#756D5F` | 3,42:1 / 3,21:1 |

- **Tipografía:**
  - **títulos** en **Source Serif 4** (variable, autoalojada con `@fontsource-variable/source-serif-4`, unos 45 KB solo en latín), en peso 400;
  - **texto y cifras** en Inter.
  - En el boceto, Georgia hace de sustituta porque la fuente no está instalada.
  - **Es una dependencia nueva:** se justifica solo si Alberto elige esta dirección, y a cambio se quita Space Grotesk.
- **Radios.** 4 px en todo.
- **Sombras y separación.** Sin sombras. Línea de 2 px en color de texto bajo cada título de sección y líneas finas entre filas.
- **Densidad.** Media, sin cajas.
- **Tono de los textos.** Un poco más cercano:
  - "Último registrado";
  - "Lo que toca pronto" en vez de "Pendiente".

  Sin caer en lemas.
- **El lima.** Desaparece.
- **Qué cambia en la app:**
  - los tokens;
  - la fuente nueva en los títulos;
  - las líneas de sección;
  - los gráficos;
  - el visor 3D sobre fondo papel (lo ajusta `experto-3d`).
- **Esfuerzo y riesgo.**
  - **Esfuerzo:** medio, por la fuente nueva y porque hay que afinar la serif en el móvil y en los títulos largos.
  - **Riesgo:** gusta mucho o no gusta. Es la menos "de software" de las tres.

### Comparación y recomendación

| | A · Claro y sobrio | B · Grafito tranquilo | C · Libro de mantenimiento |
|---|---|---|---|
| Sensación | Herramienta seria, limpia | Producto técnico, nocturno | Cuaderno cálido, cercano |
| Modo por defecto | Claro | Oscuro | Papel (claro) |
| Lima | Fuera (verde bosque) | Sí, en 3 usos | Fuera (verde inglés) |
| Fuentes | Inter | Inter | Inter + Source Serif 4 |
| Dependencias | −1 (Space Grotesk) | −1 | ±0 (se cambia una por otra) |
| Cuánto se aleja de "hecho con IA" | Mucho | Algo | Mucho |
| Esfuerzo | Bajo | Bajo | Medio |
| Legibilidad de tablas e impresión | La mejor | Buena | Muy buena |

**Recomiendo la A.** Las razones:

1. **Es la que más se aleja de lo "artificial".** El lima neón sobre carbón es justo la señal de IA más reconocible, y la A la quita.
2. **Ya funciona en la app.** El informe imprimible usa casi esta paleta y es la pantalla que mejor se ve hoy.
3. **Lee mejor los datos**, que es casi todo lo que hace CarCare: tablas, fechas, kilómetros e importes.
4. **Es barata:** solo tokens, sin dependencias nuevas.

Si Alberto quiere mantener el oscuro como identidad, la segunda opción es la B. Si quiere que se note una mano detrás, la C.

**Pregunta para Alberto:** es la número 4 del [tablero](../TABLERO.md#preguntas-para-alberto). **No hace falta que decida hoy.** Mientras tanto, los agentes simplifican con los tokens actuales, porque las reglas del apartado 4 valen para cualquiera de las tres. Cuando elija, se aplica el paso 3 del apartado 8.

---

## 8. Tareas listas para encargar

### 8.1 Ya encargado (paso 2 de la tarea 16, en marcha desde el 24/10)

| Agente | Qué aplica | Cómo se comprueba |
|--------|------------|-------------------|
| `frontend-react` (particular) | 5.1 Inicio, 5.2 ficha, 5.5 (pantallas del particular) y 5.6 (navegación del particular), con las reglas R1‑R14 | Volver a pasar [`auditoria-densidad.cjs`](2026-10-23-disenador-ux-simplificacion/auditoria-densidad.cjs) y comparar con [`metricas-antes.json`](2026-10-23-disenador-ux-simplificacion/metricas-antes.json): presupuestos de 5.1/5.2 y métricas de R2, R3, R5‑R7 y R13 |
| `frontend-react` (taller) | 5.3 centro de control, 5.4 órdenes, la portada y la navegación del taller, con R1‑R14 | Lo mismo, con la cuenta `taller@` y la `mecanico@` |
| `experto-3d` | 5.7 y R11 | En la pestaña Red, ningún chunk `three*`/`react-three*`/`drei*` en las 14 pantallas de I7, ni en la cabina, el centro o la portada al cargar |

**Condición común del paso 2.** Ni colores, ni sombras, ni degradados fuera de los tokens. Así, la dirección visual que elija Alberto más adelante se aplica solo con tokens.

- **Cómo se comprueba.** `grep -rnE "#[0-9a-fA-F]{6}|rgb\(|bg-\[|text-\[#" src/features src/components` no da resultados nuevos.
- **Excepción.** El color propio de cada vehículo (`color_hex`) y las paletas del 3D.

### 8.2 Falta encargar

| # | Para | Tarea | Criterio de aceptación |
|---|------|-------|------------------------|
| 1 | `frontend-react` (particular), añadir a su encargo | Hallazgos que el plan no cubre:<br>• **I2** (tabla `sr-only` en `Charts.tsx`);<br>• **I3** (`--line-strong`: `#6B777D` en oscuro y `#85837B` en claro);<br>• **C4** (la causa del vencido, primero);<br>• **M1‑M4** y **M6** | • La ficha mide lo mismo que su contenido (sin hueco al final).<br>• Los bordes de campo dan ≥ 3:1 sobre `--surface` y `--surface-2`.<br>• "Vencido · pasado en 443 km".<br>• "viernes, 23 de octubre".<br>• Los encabezados siguen h1 → h2 → h3 |
| 2 | Los dos `frontend-react`, al cerrar | Comprobar que **C1, C2, C3, I4 e I5** han desaparecido con el plan | Capturas a 360 y 1280. `scrollWidth` = ancho de la ventana y ningún elemento de `main` pasa del borde. Ningún destino del menú vacío. Como mucho 1 acción primaria a la vista |
| 3 | `arquitecto` → `backend-laravel` | **`Activity.summary` sin el nombre de quien lo hizo cuando el espacio es personal:** "54.000 km en Kia Sportage" o "Anotaste 54.000 km…" (M5). Es un cambio del texto del contrato, así que lo aprueba el arquitecto y se anota en su historial | Test del backend: en un espacio `personal`, `summary` no contiene el nombre del usuario. En un `workshop` sigue con el nombre ("Ana movió OT‑…") |
| 4 | `backend-laravel` (dentro de la tarea 19) | **I8:** que la demo no tenga registros de pruebas ("Prueba QA frontend…") | La actividad de `demo@` solo tiene registros de la siembra |
| 5 | `qa-tester` (después del paso 2) | Medición antes/después con el mismo script. Pasada de `@axe-core/playwright` por Inicio, ficha, agenda, centro, tablero y detalle de orden a 360 y 1280. Si sale bien, convertir R1, R2, R11 y R13 en una prueba E2E de "presupuesto" para que no vuelvan | Informe con la tabla del apartado 2 rellena con el "después". 0 fallos *serious*/*critical* de axe |
| 6 | **Paso 3**, más adelante, cuando Alberto elija (pregunta 4, sin prisa): `frontend-react` | Poner los tokens de la dirección elegida en `index.css` (los dos temas y el bloque `.paper` del informe):<br>• quitar `--fg-warm`;<br>• `font-display` → Inter (o Source Serif 4 en títulos si elige C);<br>• radios;<br>• foco;<br>• colores de los gráficos | Los mismos pares de contraste que `contraste-paletas.cjs` (0 fallos). Sin Space Grotesk en la red, salvo si se elige B y se decide mantenerla |
| 7 | **Paso 3**: `experto-3d` | Adaptar el estudio del visor y de Taller 3D al fondo elegido, sin reflejos lima en los cristales si se quita el lima | Capturas del visor en los dos temas |
| 8 | **Paso 3**: `disenador-ux` | Revisión final con capturas y axe frente a los bocetos | Informe de revisión |

---

## 9. Archivos tocados, evidencias, limitaciones y siguiente paso

### Archivos tocados

- **Informe:** `docs/equipo/informes/2026-10-23-disenador-ux-simplificacion.md` (nuevo).
- **Carpeta** `docs/equipo/informes/2026-10-23-disenador-ux-simplificacion/` (nueva, 2,0 MB):
  - `metricas-antes.json`: 68 mediciones, 34 pantallas × 2 anchos;
  - `auditoria-densidad.cjs`: el script de medición;
  - `contraste-paletas.cjs`: el contraste de las 6 paletas;
  - `boceto-inicio.html` y 9 `boceto-*.png`;
  - 12 capturas `actual-*.png`.
- **Tablero:** `docs/equipo/TABLERO.md`, con mi fila, la pregunta 4 y las peticiones 9, 10 y 11.
- **Corrección en 5.7.** Cambié una cifra: "12 pantallas dejan de descargar three.js" pasa a "14", porque es lo que salió al terminar de medir. No cambié nada más de los apartados 4‑6.
- **No he tocado código de la app, ni `index.css`.** Los scripts de trabajo y las capturas sin usar se quedan en el scratchpad de la sesión, fuera del repositorio.

### Evidencias (comandos y resultado)

| Comando | Resultado |
|---------|-----------|
| `node audit.cjs guest\|personal\|workshop\|mechanic`, el 23/10: `:5173`/`:8000` hasta las 23:13 y después `:5181`/`:8020` | 68 mediciones correctas (tabla 2.1 y `metricas-antes.json`). Las 5 que salieron vacías por la caída de `:8000` (ajustes e informe en los dos anchos y analítica a 360) se repitieron en `:5181` |
| `curl -m 10 http://127.0.0.1:8000/api/v1/me`, 20 veces, de 23:14 a 23:20 | `000` (sin respuesta) las 20 veces. `:8020` respondía `401` en 0,1 s |
| `UX_BASE=http://localhost:5178 node extra.cjs`, el 24/10 a las 09:00, en instancia propia `:8035`/`:5178` | Cabina a 360: `right=505` con `vw=360` (C1). Ficha: `doc=3763`, `mainBottom=2387`, el elemento más bajo es `TABLE.sr-only` (I2). Agenda a 360: filtro con `right=483`. Lista de zonas: `right=428` (I4) |
| `node contraste-paletas.cjs` | 6 paletas, `FALLOS: 0` |
| `grep` en `frontend/src` (`.tsx`) | `uppercase` 36 · `font-display` 69 · `rounded-hero` 21 · `<StatCard` 22 · `backdrop-blur` 16 · `gradient` 11 · `<Badge`/`<StatusPill` 35 |
| `node shoot-boceto.cjs` | 9 bocetos PNG |

No he lanzado tests, typecheck ni build, porque no he cambiado código.

### Limitaciones

- **Tiempos poco fiables.** Están medidos en desarrollo y con WebGL por software. Algunos valores salieron disparados porque otros agentes cargaban la máquina (ver las notas de 2.1). **No he medido el bundle de producción** ni he pasado axe-core: tiene más sentido después del paso 2 (8.2, tarea 5).
- **Bocetos limitados.** Solo hay boceto de "Inicio". Las siluetas están dibujadas a mano. En C, Georgia hace de Source Serif 4. La fuente Inter se carga desde `node_modules` con una ruta absoluta, así que en otro equipo el boceto cae a la fuente del sistema.
- **Sin verificar:**
  - si la portada respeta `prefers-reduced-motion` (I1);
  - el modo mecánico, salvo el centro, las órdenes y el detalle.
- **Inventario largo.** El inventario pantalla por pantalla se queda en la tabla 2.1 y en el JSON, como pidió la sesión principal.

### Siguiente paso

1. Los agentes del paso 2 terminan, y cada uno comprueba su parte con el script (8.1) y los hallazgos (8.2, tareas 1 y 2).
2. `qa-tester` mide el "después" y pasa axe (8.2, tarea 5).
3. El arquitecto decide sobre `Activity.summary` (8.2, tarea 3).
4. Cuando Alberto quiera, sin fecha, elige la dirección en la pregunta 4 y se aplica el paso 3 (8.2, tareas 6‑8), que es solo de tokens.
