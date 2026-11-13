# Rediseño «Apex Telemetry» · Fase 1: identidad, estructura y móvil

**Fecha:** 13/11/2026 · **Quién:** sesión principal (interactiva, con Alberto) · **Zona:** `frontend/` (incluye cambios pequeños en `frontend/src/three/`, zona de `experto-3d`, anotados abajo), `DESIGN.md`.

## Objetivo

Alberto pidió rediseñar CarCare en cuatro fases, sin reescribir el proyecto ni tocar lógica de negocio, rutas, autenticación ni base de datos. Esta es la Fase 1:

1. Identidad propia «Apex Telemetry» (colores, superficies de cristal, tres tipografías).
2. En escritorio (≥ 1024 px), la escena 3D como protagonista con el HUD en los márgenes; en móvil (< 1024 px), interfaz de botones con barra inferior fija y píldoras de vehículo.
3. Corregir textos dispersos y descuadrados.

Al aprobar el plan, Alberto añadió: **el tema debe cambiar a lo largo del día siguiendo al sol**; el resto de decisiones, a criterio de la sesión.

## Qué se hizo

### Identidad

- **Tokens** (`frontend/src/index.css`): paleta de noche con los valores exactos del encargo (`#0B0D13`, `#131722`, cristal `rgba(19,23,34,.80)` con `blur(16px)` y filo `rgba(255,255,255,.08)`, acento `#FF5500`, estados `#F59E0B` / `#10B981` / `#F43F5E` / `#38BDF8`) y una paleta de día derivada, con todos los contrastes calculados (ver Evidencias).
- **Tipografías**: Space Grotesk (encabezados), Plus Jakarta Sans (interfaz) y JetBrains Mono con cifras tabulares (datos). La clase `.tabular`, que ya estaba en unos 190 sitios, pasa a ser la tipografía de datos; además se pusieron en ella las matrículas, los números de orden y los ejes de las gráficas.
- **Texto oscuro sobre el naranja**: el blanco sobre `#FF5500` da 3,2:1 y no cumple AA; `--on-accent` es `#0B0D13` (6,1:1).
- **Botones** planos (fuera el «botón gordo»), marca nueva (placa naranja con la trazada de una curva) y favicon.

### Tema según el sol (pedido de Alberto)

- `frontend/src/lib/sun.ts` calcula la altura y el rumbo del sol con la hora y la zona horaria del dispositivo. **No pide la ubicación ni envía nada fuera.** Para España usa un punto fijo por zona horaria (Madrid, Canarias, Ceuta); para otras zonas, la longitud que corresponde a su hora de invierno.
- `ThemeProvider` pone el tema claro con el sol sobre el horizonte y el oscuro por debajo, y templa el lienzo (`--base`, que es también el fondo de las escenas 3D) en la hora dorada y el crepúsculo. Se revisa cada minuto. El cambio de tema es un fundido de 0,9 s.
- En **Ajustes → Apariencia** hay tres opciones: «Según el sol» (por defecto), «Claro» y «Oscuro». El control del menú de usuario, de la hoja «Más» y de la paleta recorre los tres modos y su texto dice lo que hará.

### Estructura

- **Corte en 1024 px** (antes 768): por debajo, barra inferior fija y sin carril lateral.
- **Escritorio**: el carril de navegación va recogido por defecto (76 px, iconos con tooltip; se puede desplegar y se recuerda). `AppShell` pierde dos `div` envolventes.
- **Inicio del particular** (`PersonalDashboard.tsx`): el garaje 3D ocupa la ventana; el HUD son una barra fina arriba, otra abajo con el vehículo elegido y la columna de misiones a la derecha. La escena encuadra en lo que queda libre.
- **Taller** (`WorkshopFloorPage.tsx`): la maqueta a pantalla completa desde 1024 px; cifras arriba, lista abajo, ficha o misiones a la derecha.
- **Móvil y tableta**: barra inferior fija (destinos de 56 px), píldoras de vehículo de 48 px bajo la cabecera (`VehiclePills.tsx`, solo particular; desde una pestaña de la ficha llevan a la misma pestaña del otro coche), controles táctiles de 48 px. **No se monta ninguna escena 3D**: los elevadores son una rejilla de botones y el garaje, tarjetas con miniatura.

### Descuadres corregidos

| Dónde | Qué pasaba | Arreglo |
|---|---|---|
| Toda la app | Palabras pegadas («Añadirgasto»): el espacio de Plus Jakarta Sans mide 0,17 em | `word-spacing: 0.06em` |
| Cabeceras con acciones (Analítica a 360 px) | El selector aplastaba el título en una columna de una palabra por línea | El título reserva 15 rem; las acciones bajan de línea |
| Cifras de Analítica e Inicio | Las cifras de una fila quedaban a distinta altura; en móvil, un borde suelto | Etiqueta arriba y cifra debajo; una columna en móvil |
| Ficha del vehículo | «· leído hoy ·» con el punto colgando al partir la línea | Sin puntos: separación por hueco, alineado por línea base |
| Tarjetas del garaje | Pies a distinta altura según tuvieran avisos | Dos filas de alto fijo: km y fecha; avisos |
| Tarjetas del tablero de órdenes | Mecánico y fecha recortados, número suelto en otra línea | Filas `justify-between items-baseline`: lo que se recorta a la izquierda, el dato entero a la derecha |
| Cifras del taller | «En elevador» partido en dos líneas; etiqueta arriba a la izquierda y cifra abajo a la derecha | Etiqueta sin partir, cifra alineada a la izquierda |
| Tabla «Coches en el taller» | La fecha de entrega se partía en dos líneas | Columna más ancha y sin salto |
| Frases enteras en monoespaciada | Clientes, misiones, «Elevador 1», «Ver lista» | Monoespaciada solo en el dato |
| Píldoras de vehículo | Desborde horizontal de 147 px a 360 px (un texto para lectores se salía de la fila) | Contenido dentro de la fila que se desplaza |

## Archivos tocados

- **Nuevos:** `frontend/src/lib/sun.ts`, `frontend/src/lib/sun.test.ts`, `frontend/src/components/layout/VehiclePills.tsx`.
- **Identidad y tema:** `frontend/src/index.css`, `frontend/index.html`, `frontend/package.json` (+ lock), `frontend/public/favicon.svg`, `frontend/src/app/ThemeProvider.tsx`, `frontend/src/app/theme-context.ts`, `frontend/src/lib/storage.ts`, `frontend/src/components/layout/Logo.tsx`, `frontend/src/components/ui/variants.ts`.
- **Estructura:** `AppShell.tsx`, `MobileNav.tsx`, `UserMenu.tsx`, `CommandPalette.tsx`, `SettingsPage.tsx`, `PersonalDashboard.tsx`, `WorkshopFloorPage.tsx`.
- **Alineación:** `components/game/kit.tsx`, `components/ui/Hud.tsx`, `VehicleCard.tsx`, `ReminderItem.tsx`, `VehicleDetailPage.tsx`, `analytics/parts.tsx`, `OrderCard.tsx`, `FloorStats.tsx`, `FleetTable.tsx`, `FloorPanel.tsx`, `CustomersPage.tsx`.
- **Tamaños táctiles** (cambio mecánico `md:` → `lg:` y 44 → 48 px): 28 archivos de `components/ui` y `features`.
- **Zona de `experto-3d`** (cambios pequeños, sin tocar escenas): `three/env.ts` (valores de respaldo y caché por paso del sol), `three/types.ts` y `three/index.tsx` (prop `flat` de `WorkshopScene`), `three/fallbacks.tsx` (rejilla de botones de 48 px), y el color del anillo de foco en los archivos de `three/` que lo fijaban a mano.
- **Documentación:** `DESIGN.md` reescrito desde el código.

**Dependencias (regla 8):** +`@fontsource-variable/space-grotesk`, +`@fontsource-variable/plus-jakarta-sans`, +`@fontsource-variable/jetbrains-mono`; −`@fontsource-variable/archivo`. Son las tres tipografías que pide el encargo, autoalojadas como ya lo estaba Archivo: sin peticiones a terceros y funcionan sin red (defensa).

## Evidencias

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores; los avisos son anteriores y están en archivos no tocados |
| `npx vitest run` | 23 archivos, **196 tests pasan** (188 anteriores + 8 nuevos de `sun.test.ts`) |
| `npm run build` | Correcto (12,9 s) |
| Capturas con Playwright en instancia aislada (API :8020, web :5181) | Cuentas `demo` y `taller`; 360, 768 y 1280 px; de noche y de día; Inicio, Garaje, ficha, Gastos, Analítica, Agenda, Taller, Órdenes, Clientes, portada y acceso |
| Consola del navegador | Sin errores, salvo el 401 esperado de `/me` antes de iniciar sesión |
| Desborde horizontal | Ninguno en las pantallas capturadas (se detectó y corrigió uno de 147 px) |

Contrastes calculados (WCAG): tinta de noche 15,1:1; tinta media 8,2:1; tenue 5,7:1; texto sobre naranja 6,1:1; acento como texto 6,8:1 de noche y 5,7:1 de día; estados entre 4,9:1 y 8,4:1; líneas fuertes ≥ 3,9:1.

Capturas: [`2026-11-13-apex-telemetry-fase-1-capturas/`](2026-11-13-apex-telemetry-fase-1-capturas/).

**Nota sobre los tests:** lanzados desde una consola cuya ruta empieza por `c:` en minúscula, Vitest falla al cargar los 22 archivos (`Cannot read properties of undefined (reading 'config')`). No es un fallo del código: desde `C:\` pasan todos.

## Limitaciones

- **Las escenas 3D se han visto con WebGL por software** (Chromium sin GPU). Falta verlas en la GPU real de Alberto, sobre todo la luz de la maqueta de noche, que queda algo apagada: su rediseño es la Fase 2.
- **Las escenas no siguen todavía al sol con su luz**: solo cambia el fondo. `lib/sun.ts` ya da altura y rumbo para usarlos en la Fase 2.
- **Fechas e importes dentro de frases** (avisos, ayudas, toasts) siguen en la tipografía de texto; los datos sueltos, en monoespaciada.
- **`.impeccable/design.json`** sigue describiendo «Diorama». Hay que regenerarlo con el documentador de Impeccable.
- **Las capturas de la portada pública** (`features/landing/shots.ts`) son del aspecto anterior. Se rehacen al acabar la Fase 4.
- Sin pruebas E2E (no existe `frontend/e2e`) ni auditoría axe en esta fase.
- `scripts/servidor-api.cmd` aparece borrado en el árbol de trabajo desde antes de esta sesión; no se ha tocado ni incluido en los commits.

## Siguiente paso

Revisión de Alberto en el navegador. Después, **Fase 2** (taller 3D con color, mecánicos y cronómetro). Antes de programarla hay que decidir el contrato: `work_orders` no guarda cuándo empieza el trabajo ni el tiempo estimado, así que el cronómetro no tiene fuente real (regla 2). Las fases 3 y 4 también piden cambios de contrato (vínculo particular ↔ orden de taller; periodicidad de gastos y alcance del ADR‑0003).
