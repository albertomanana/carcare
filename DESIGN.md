---
name: CarCare
description: Apex Telemetry; un panel de telemetría sobre asfalto y carbono, con superficies de cristal en los márgenes de una escena 3D, un solo acento naranja papaya, los datos en monoespaciada y un tema que sigue al sol.
colors:
  noche-asfalto: "#0b0d13"
  noche-carbono: "#131722"
  noche-carbono-2: "#1a1f2d"
  noche-carbono-3: "#232a3b"
  noche-linea: "#262b38"
  noche-linea-fuerte: "#6b7590"
  noche-tinta: "#e8ecf4"
  noche-tinta-viva: "#f7f9fc"
  noche-tinta-media: "#a7b0c2"
  noche-tinta-tenue: "#8892a6"
  noche-acento-tinta: "#ff7733"
  noche-cristal: "rgb(19 23 34 / 0.8)"
  noche-filo: "rgb(255 255 255 / 0.08)"
  noche-atardecer: "#1b1216"
  dia-asfalto: "#eef0f4"
  dia-panel: "#ffffff"
  dia-panel-2: "#f4f5f8"
  dia-panel-3: "#e6e9ef"
  dia-linea: "#d9dde6"
  dia-linea-fuerte: "#6f788c"
  dia-tinta: "#131722"
  dia-tinta-viva: "#0b0d13"
  dia-tinta-media: "#454d60"
  dia-tinta-tenue: "#566076"
  dia-acento-tinta: "#b83c00"
  dia-cristal: "rgb(255 255 255 / 0.86)"
  dia-filo: "rgb(19 23 34 / 0.1)"
  dia-amanecer: "#f6e8da"
  papaya: "#ff5500"
  sobre-papaya: "#0b0d13"
  piloto-en-taller: "#f59e0b"
  piloto-listo: "#10b981"
  piloto-alerta: "#f43f5e"
  piloto-info: "#38bdf8"
  dia-estado-alerta: "#c81e3f"
  dia-estado-en-taller: "#8a5300"
  dia-estado-listo: "#0b7a55"
  dia-estado-info: "#0b6ca8"
  pintura-sin-color: "#9aa0a6"
typography:
  display:
    fontFamily: "Space Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    wordSpacing: "0.06em"
  label:
    fontFamily: "Plus Jakarta Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "0.01em"
  data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontFeature: "\"tnum\" 1"
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2rem"
    fontFeature: "\"tnum\" 1"
rounded:
  control: "10px"
  card: "14px"
  hero: "18px"
  pildora: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.papaya}"
    textColor: "{colors.sobre-papaya}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.noche-carbono-2}"
    textColor: "{colors.noche-tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  input:
    backgroundColor: "{colors.noche-carbono-2}"
    textColor: "{colors.noche-tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  hud-surface:
    backgroundColor: "{colors.noche-cristal}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.noche-carbono-3}"
    textColor: "{colors.noche-tinta-media}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
    padding: "0 12px"
    height: "28px"
---

# Design System: CarCare

> **Identidad «Apex Telemetry» (13/11/2026).** Sustituye al mundo «Diorama» (11/11/2026) por pedido expreso de Alberto: una identidad propia inspirada en la *mecánica* de los paneles espaciales (cámara cinemática, todo pulsable, HUD periférico), no en su aspecto. Este documento está escrito desde el código (`frontend/src/index.css` manda).

## Overview

**Norte creativo: la hoja de telemetría.**

CarCare se lee como el panel de un ingeniero de pista: fondo de asfalto, superficies de carbono, un solo color que señala lo activo y los datos en una tipografía de instrumento. La escena 3D (el garaje del particular, la nave del taller) es la protagonista en escritorio; la interfaz se retira a los márgenes y deja ver lo que pasa detrás a través de un cristal oscuro.

Tres decisiones lo sostienen:

1. **Un acento, no una paleta.** El naranja papaya `#FF5500` marca la acción principal y lo activo. Todo lo demás es neutro, salvo los cuatro estados.
2. **Los datos hablan con otra voz.** Importes, fechas, matrículas, porcentajes, kilómetros y números de orden van en JetBrains Mono con cifras tabulares. El texto corriente, no.
3. **El tema sigue al sol.** De día la app es clara (asfalto al sol); de noche, oscura (los valores exactos del encargo). Cerca del amanecer y del atardecer el lienzo se templa.

La regla 2 del proyecto sigue mandando: ninguna cifra sin fuente real. La estética de telemetría no autoriza a inventar medidas.

## Colors

### El tema sigue al sol

`app/ThemeProvider.tsx` calcula la posición del sol con la hora y la zona horaria del dispositivo (`lib/sun.ts`), **sin pedir la ubicación**:

| Sol | Tema (`data-theme`) | Lienzo (`--base`) |
|---|---|---|
| Alto (más de 12° sobre el horizonte) | `light` | `#eef0f4` |
| Hora dorada (0° a 12°) | `light` | de `#eef0f4` hacia `#f6e8da` |
| Crepúsculo (0° a −12°) | `dark` | de `#1b1216` hacia `#0b0d13` |
| Noche cerrada | `dark` | `#0b0d13` |

Solo se templa `--base` (página y fondo de las escenas 3D); superficies y tintas no cambian dentro de un tema, así el contraste está comprobado una vez por tema. El cambio de tema es un fundido de 0,9 s (anulado con movimiento reducido). En Ajustes se puede fijar «Claro» u «Oscuro»; por defecto, «Según el sol».

### Noche (los valores del encargo)

- **Obsidian Asphalt** `#0b0d13`: lienzo. **Carbon Slate** `#131722`: superficies. Escalones `#1a1f2d` y `#232a3b`.
- **Cristal del HUD**: `rgb(19 23 34 / 0.80)` con `backdrop-filter: blur(16px)` y filo `1px solid rgb(255 255 255 / 0.08)`.
- Tinta `#e8ecf4` (15,1:1 sobre carbono), media `#a7b0c2` (8,2:1), tenue `#8892a6` (5,7:1).

### Día

- Lienzo `#eef0f4`, superficies `#ffffff`, `#f4f5f8`, `#e6e9ef`. Cristal `rgb(255 255 255 / 0.86)`, filo `rgb(19 23 34 / 0.10)`.
- Tinta `#131722`, media `#454d60` (8,5:1 sobre blanco), tenue `#566076` (6,3:1).

### Acento

- **Papaya Telemetry Orange** `#ff5500` (`--accent`): relleno de la acción primaria, sección activa, mes elegido en una gráfica.
- **El texto sobre el naranja es oscuro** (`--on-accent: #0b0d13`, 6,1:1). El blanco se queda en 3,2:1 y no cumple AA.
- **El acento como texto o trazo** usa `--accent-ink`: `#ff7733` de noche (6,8:1 sobre carbono) y `#b83c00` de día (5,7:1 sobre blanco). El anillo de foco usa esta tinta.

### Estados

| Estado | Piloto (relleno, punto, luz 3D) | Texto de noche | Texto de día |
|---|---|---|---|
| En taller | `#f59e0b` | `#f59e0b` | `#8a5300` |
| Operativo / listo | `#10b981` | `#10b981` | `#0b7a55` |
| Alerta / gasto | `#f43f5e` | `#f43f5e` | `#c81e3f` |
| Info / seguro | `#38bdf8` | `#38bdf8` | `#0b6ca8` |

Los pilotos (`--lamp-*`) son iguales de día y de noche y **nunca se usan como texto sobre claro**. El estado va siempre además con icono y texto, nunca solo con color.

### Reglas

- Ningún hex suelto en un componente: tokens (`bg-surface`, `text-fg`, `border-line`, `bg-accent`…).
- La pintura del vehículo (`--paint`) es un dato del usuario, no un color de interfaz: vive solo en su ficha (`.clay`).

## Typography

- **Space Grotesk**: encabezados (`h1`–`h3` y `.font-display`), con `letter-spacing: -0.02em`.
- **Plus Jakarta Sans**: interfaz. Su espacio mide 0,17 em y las palabras se pegan en tamaños pequeños, así que `html` lleva `word-spacing: 0.06em`.
- **JetBrains Mono** con `font-variant-numeric: tabular-nums`: los datos. Se aplica con la clase `.tabular` (también `tabular-nums` de Tailwind y los ejes de las gráficas).

### Reglas

- `.tabular` va **en el dato, no en la frase**: `Elevador <span class="tabular">3</span>`, no la celda entera.
- Las etiquetas (`.tag-label`) son rótulos cortos en peso 600, **sin mayúsculas forzadas**.
- Las tres familias van autoalojadas (`@fontsource-variable/*`): sin peticiones a terceros, funcionan sin red.

## Layout

El corte entre móvil y escritorio está en **1024 px**.

### Escritorio (≥ 1024 px)

- **Carril de navegación** a la izquierda: 76 px con iconos y tooltips; se despliega a 240 px (se recuerda). Es la alternativa de teclado a navegar por la escena.
- **Barra de estado** arriba: espacio, búsqueda, avisos y cuenta.
- En las pantallas con escena (`<CanvasBleed>`: Inicio del particular y Taller) el lienzo ocupa toda la ventana y el HUD se queda en los márgenes. `.canvas-hud` deja pasar el puntero (`pointer-events: none`) y solo las superficies y controles lo reciben. Cada pantalla le dice a la escena cuántos px tapa el HUD (`focusInset`) para que encuadre en lo que queda libre.
- Formularios, tableros, tablas y analítica son pantallas HTML normales sobre el lienzo: no llevan un WebGL detrás (reglas 6 y 7).

### Móvil y tableta (< 1024 px)

- **Barra inferior fija**: 3 secciones, «Registrar» y «Más»; cada destino mide 56 px de alto.
- **Píldoras de vehículo** bajo la barra de estado (solo particular): una por coche, de 48 px, con su pintura y su matrícula.
- **Sin escena 3D**: los elevadores son una rejilla de botones (`WorkshopScene flat`) y el garaje, tarjetas con miniatura. Nada depende del 3D para navegar.
- Controles táctiles de **48 px** de alto (botones, campos, filtros, filas de menú).

### Alineación

- Fila de dato: `flex items-baseline justify-between gap-3`; a la izquierda lo que puede recortarse (`min-w-0 truncate`), a la derecha el dato que debe leerse entero (`shrink-0`).
- Sin puntos separadores entre elementos que pueden partirse de línea: la separación la da el hueco.
- Tarjetas de una misma rejilla: filas inferiores de alto fijo para que todas cuadren.
- Una cabecera con acciones reserva 15 rem para el título; si no caben, las acciones bajan de línea en vez de aplastarlo.

## Elevation & Depth

Superficies planas con un filo de 1 px. La profundidad la dan el cristal y la escena que pasa por detrás, no las sombras: de noche las sombras apenas se ven y de día son cortas. Nada de «botones gordos» con canto.

## Shapes

Esquinas contenidas, de instrumento: controles 10 px, superficies 14 px, piezas grandes 18 px. Píldora solo para insignias, filtros y el selector de vehículo.

## Components

- **Botones** (`components/ui/variants.ts`): primario naranja con texto oscuro; secundario, superficie con filo; fantasma para acciones menores. Al pulsar se encogen un 3 %.
- **Superficies del HUD** (`.hud-panel`, `.hud-bar`, `.hud-pop`): cristal, desenfoque de 16 px y filo. `.hud-pop` (menús, paleta) es casi opaco para que se lea sobre cualquier fondo.
- **Insignias** (`.chip`, `<Chip>`): píldora con icono y texto; como filtro pulsable se rellena con el acento.
- **Misiones** (`.mission`, `<Mission>`): aviso real con barra de tono a la izquierda, icono y texto.
- **Cifras** (`<StatTile>`, `FloorStats`): etiqueta arriba y cifra debajo, alineadas a la izquierda; todas las cifras de una fila comparten línea base.
- **Ficha de pintura** (`.clay`): el color real del vehículo.
- **Marca**: placa naranja con la trazada de una curva y su vértice.

## Motion

Las curvas y duraciones de `index.css` no cambian. El movimiento responde a una acción (abrir, elegir, confirmar). El cambio de tema por el sol es un fundido lento, no un salto. Todo se anula con `prefers-reduced-motion`.

## Do's and Don'ts

### Do

- Usa el naranja para una sola cosa por pantalla: la acción principal o lo activo.
- Pon `.tabular` en cada importe, fecha, matrícula, porcentaje, kilometraje y número de orden.
- Comprueba cada pantalla a 360, 768 y 1280 px, de día y de noche.
- Di cuántos px tapa el HUD a la escena (`focusInset`).

### Don't

- No pongas texto blanco sobre el naranja.
- No uses los pilotos (`--lamp-*`) como color de texto sobre claro.
- No metas una frase entera en monoespaciada.
- No dependas de la escena 3D para navegar por debajo de 1024 px.
- No inventes medidas para que el panel «parezca» más técnico.
