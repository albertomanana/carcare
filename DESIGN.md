---
name: CarCare
description: Diorama; una maqueta isométrica clara tipo juego de estrategia, con paneles de cristal que flotan sobre un lienzo azul pastel, botones gordos y el color de cada vehículo como ficha.
colors:
  lienzo: "#e9f0fa"
  panel: "#ffffff"
  panel-2: "#f1f5fb"
  panel-3: "#e2eaf5"
  linea: "#d3deed"
  linea-fuerte: "#7384a1"
  tinta: "#14213a"
  tinta-honda: "#0c1730"
  tinta-media: "#45536f"
  tinta-tenue: "#53627e"
  azul-electrico: "#2559e8"
  azul-electrico-tinta: "#1d4cd0"
  azul-electrico-canto: "#1a3fae"
  sobre-azul: "#ffffff"
  azul-electrico-suave: "rgb(37 89 232 / 0.1)"
  estado-vencido: "#b32119"
  estado-vencido-canto: "#7c130d"
  estado-vencido-suave: "rgb(179 33 25 / 0.1)"
  estado-proximo: "#7d4e00"
  estado-proximo-suave: "rgb(214 150 20 / 0.16)"
  estado-en-plazo: "#0f6a49"
  estado-en-plazo-suave: "rgb(15 106 73 / 0.11)"
  estado-info: "#1b5fa8"
  estado-info-suave: "rgb(27 95 168 / 0.1)"
  canto-neutro: "#c2d0e5"
  noche-lienzo: "#0e1a30"
  noche-panel: "#162540"
  noche-panel-2: "#1c2e4d"
  noche-panel-3: "#263c61"
  noche-linea: "#2b3f63"
  noche-linea-fuerte: "#7189b3"
  noche-tinta: "#e9effc"
  noche-azul: "#3b69f0"
  noche-azul-tinta: "#a4bdff"
  pintura-sin-color: "#9aa0a6"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 108"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 108"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 108"
  figure:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: "2rem"
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
    fontVariation: "'wdth' 108"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-lg:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 750
    lineHeight: "1rem"
    letterSpacing: "0.06em"
rounded:
  control: "12px"
  card: "20px"
  hero: "28px"
  dock: "20px"
  pildora: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  seccion: "40px"
components:
  button-primary:
    backgroundColor: "{colors.azul-electrico}"
    textColor: "{colors.sobre-azul}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  button-ghost:
    textColor: "{colors.tinta-media}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.azul-electrico-suave}"
    textColor: "{colors.tinta}"
  button-danger:
    backgroundColor: "{colors.estado-vencido}"
    textColor: "{colors.sobre-azul}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "40px"
  input:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  hud-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip-vencido:
    backgroundColor: "{colors.estado-vencido-suave}"
    textColor: "{colors.estado-vencido}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
    padding: "0 12px"
    height: "28px"
  chip-proximo:
    backgroundColor: "{colors.estado-proximo-suave}"
    textColor: "{colors.estado-proximo}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
    padding: "0 12px"
    height: "28px"
  dock-item:
    textColor: "{colors.tinta-media}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  dock-item-active:
    backgroundColor: "{colors.azul-electrico-suave}"
    textColor: "{colors.azul-electrico-tinta}"
---

# Design System: CarCare

> **Mundo «Diorama» (11/11/2026).** Sustituye al mundo «Carta de colores» (10/11/2026), por pedido expreso de Alberto: «quiero que sea como un juego TODA la página en TODOS los usuarios, no solo el taller». La referencia es el estilo de una maqueta isométrica de arcilla / juego de estrategia limpio (tipo WareTrack), no un vídeo concreto que se haya podido ver. La decisión no se reabre; este documento recoge cómo se aplica.

## Overview

**Creative North Star: "El diorama"**

CarCare es una maqueta: un lienzo azul pastel muy tenue sobre el que está construido el mundo, y sobre el que flotan los paneles de la interfaz como en el HUD de un juego de estrategia. El entorno 3D y el fondo de la app son el mismo color (`--base`), de modo que las escenas (el coche, la nave del taller) se funden con la página y no parecen «una caja con un modelo dentro». Los paneles son blancos, de esquinas muy redondeadas, con cristal sutil y una sombra larga y suave que los despega del suelo; los botones son piezas gordas con volumen, que se hunden al pulsarlos; la navegación es un dock flotante de pestañas redondeadas y la cabecera es una barra de estado, no una franja a sangre.

Hay **juego en la forma, no en los datos**. La regla 2 del proyecto sigue mandando: ningún punto, nivel, logro ni cifra sin fuente real. Los avisos y recordatorios pueden presentarse como «misiones» (tarjetas con estado, icono y plazo) porque son datos reales; nada más se inventa para que parezca un juego.

Cada vehículo conserva su pintura (`--paint`, `lib/colors.ts`) como ficha de color: la muestra de la tarjeta, la ficha del dock, el cuadrado de la fila. Fuera de esas fichas, el color es el del mundo: lienzo, blanco, un azul eléctrico para lo activo y rojo/ámbar/verde solo como estado.

El tema claro («día de diorama», el predeterminado) es el de uso diario. El oscuro («noche de diorama») es el mismo mundo con la luz apagada: azul marino profundo, paneles azul noche, los mismos acentos. Ambos están calculados para contraste AA.

**Rasgos clave:**
- Un lienzo (`--base`) compartido por la página y por el 3D; paneles de cristal que flotan encima.
- Esquinas muy redondeadas: 12 px en controles, 20 px en paneles, 28 px en piezas grandes, píldoras en etiquetas.
- Botones «gordos» con canto, brillo y sombra blanda; respuesta física al pulsar.
- Dock flotante a la izquierda (escritorio) o abajo (móvil) y barra de estado arriba.
- Archivo variable llevado a pesos 700–800 y anchura 108 % en títulos, que da carácter de juego.
- Movimiento con muelle corto (≤ 300 ms, salida fuerte), escalonado, que se queda quieto con `prefers-reduced-motion`.

## Colors

Una paleta de maqueta: un lienzo azul pastel casi blanco, paneles blancos, tintas azul marino (nunca negro puro), un azul eléctrico para actuar y colores de estado solo para el estado. Todos los pares de texto se han calculado (relación de contraste WCAG) con `docs/equipo/informes/2026-11-11-frontend-react-mundo-diorama/contraste.cjs`.

### Primary
- **Azul eléctrico** (`--accent` `#2559e8`; en noche `#3b69f0`): el botón primario, lo activo (pestaña del dock, segmento seleccionado, chip filtrado), el anillo de foco y los enlaces de acción. Texto blanco encima (5,7:1 en claro, 4,7:1 en noche). Su variante de texto (`--accent-ink` `#1d4cd0`; en noche `#a4bdff`) colorea enlaces y estados activos sobre fondo claro (7,0:1 sobre panel). Su **canto** (`--accent-edge`) es el borde inferior del botón gordo.

### Secondary
- **Pintura del vehículo** (`--paint`, dato del usuario, no de la interfaz): rellena las fichas. La tinta encima (`--paint-ink`) la calcula `paintVars` y es `#101214` o blanco, la de mayor contraste. Sin color registrado: `pintura-sin-color`.

### Neutral
- **Lienzo** (`--base` `#e9f0fa`; noche `#0e1a30`): fondo de la página y color de fondo del entorno 3D (`three/env.ts` lo lee de aquí).
- **Panel** (`--surface` `#ffffff`; noche `#162540`), **panel 2** (campos, hover; `#f1f5fb`) y **panel 3** (etiqueta neutra, esqueleto; `#e2eaf5`).
- **Línea** (`--line`): separadores y bordes de panel, discreta. **Línea fuerte** (`--line-strong` `#7384a1`): bordes de campo y de controles que lo necesitan; 3,3:1 sobre el lienzo y 3,8:1 sobre el panel (WCAG 1.4.11).
- **Tinta**: `--fg` (`#14213a`, 16:1 sobre panel), `--fg-warm` para títulos y cifras, `--fg-muted` (`#45536f`, 7,7:1) y `--fg-subtle` (`#53627e`, 6,2:1).
- **Cristal** (`--glass`): el panel al 94 % de opacidad con desenfoque; con `prefers-reduced-transparency` pasa a opaco.

### Estados
- **Vencido** `#b32119`, **Próximo** `#7d4e00`, **En plazo** `#0f6a49` e **Info** `#1b5fa8`, cada uno con su fondo suave (10–16 %). Todos ≥ 4,9:1 también sobre el lienzo. Solo marcan el estado de un aviso, una zona o una orden, siempre con icono y palabra.

### Named Rules
**La regla de la ficha de color.** El color del vehículo solo vive dentro de sus fichas (la tarjeta, la ficha del dock, el cuadrado de la fila, la cabecera de la ficha). Fuera de ahí: lienzo, blanco, azul eléctrico y estados.

**La regla de la voz azul.** El azul eléctrico significa «activo» o «actúa aquí». Hay una sola acción primaria rellena de azul a la vista por pantalla; lo activo de la navegación va en azul suave, no relleno.

**La regla del estado con palabra.** Rojo, ámbar y verde solo dicen estado, y nunca solos: cada estado lleva icono y texto. La pintura de un coche rojo no es un aviso.

## Typography

**Display y cuerpo:** Archivo Variable (autoalojada, pesos 100–900, anchura 62–125 %). No se añade ninguna fuente nueva: el carácter de juego sale de llevarla a pesos 700–800 y a anchura 108 % en títulos y cifras.

Los pesos están remapeados en el tema (`--font-weight-medium: 600`, `semibold: 700`, `bold: 800`): todo el producto sube un escalón sin tocar las pantallas.

### Hierarchy
- **Display** (700, 1.5rem en móvil y 1.875rem desde 768 px, anchura 108 %): el nombre del vehículo en su ficha.
- **Headline** (700, 1.5rem / 1.875rem, anchura 108 %): el título de cada pantalla.
- **Title** (700, 1.125rem, anchura 108 %): títulos de sección y de diálogo; 1rem en tarjetas.
- **Figure** (800, 1.75rem/2rem, tabulares, anchura 108 %): cifras del mes, kilometraje.
- **Body** (400, 0.875rem/1.25rem; 1rem en campos de móvil). Los controles y enlaces van en 600–700.
- **Label** (`.tag-label`, 750, 0.75rem, 0.06em, versalitas): matrículas, códigos y rótulos de dato.

### Named Rules
**La regla de las pocas tallas.** El rango lo dan el peso y la anchura, no una escalera de tamaños.

**La regla de la cifra al margen.** Importes, kilómetros y plazos con cifras tabulares (`.tabular`) y pegados al margen derecho de su fila, sin partirse de su unidad.

**La regla de la etiqueta.** Las versalitas rotulan datos (matrícula, código, rótulo de cifra). Nunca van como antetítulo encima de un título.

## Layout

Rejilla de 8 px con medios pasos de 4 px. Todo flota con un margen de 12 px al borde de la ventana.

- **Dock (escritorio):** `aside.hud-panel` fijo a la izquierda, a 12 px de los bordes (arriba, abajo e izquierda). 76 px con iconos de 768 a 1023 px (y plegado) y 240 px desde 1024 px. Lleva marca, secciones por grupos, las **fichas de vehículo** (particular) y, abajo, Ajustes y «Contraer».
- **Barra de estado (HUD):** `header` pegajosa de 4 rem con su margen (barra de 56 px + 8 px), con el selector de espacio, la búsqueda, los avisos y la cuenta. Las barras fijas de las pantallas cuelgan de `top-16`.
- **Dock móvil:** barra flotante inferior (`hud-bar`) a 12 px de los bordes, con Inicio, Garaje, «Registrar» (botón redondo elevado), Agenda y «Más».
- **Contenido:** centrado, máximo 1240 px en el particular y 1440 px en el taller, desplazado por `--shell-left` (6,25 rem en tableta, 16,5 rem con el dock ancho).
- **Contenedores:** consultas de contenedor (30, 32, 34, 40 y 50 rem) para las piezas que cambian según su ancho.

Los objetivos táctiles miden 44 px en móvil y 36–40 px con puntero fino. Se comprueba a 360, 768 y 1280 px.

### Lienzo a sangre (escenas 3D de fondo)
Una pantalla puede poner su escena 3D detrás de todo: el diorama ocupa toda la ventana (también bajo el dock y la barra) y los paneles flotan encima.

```tsx
import { CanvasBleed } from '@/components/layout/CanvasBleed'

<CanvasBleed scene={<MiEscena />} hudClassName="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
  <aside className="hud-panel p-4">…</aside>
</CanvasBleed>
```

- `CanvasBleed` llama a `useCanvasBleed()`, que avisa a `AppShell`: el `<main>` pasa a `data-canvas="bleed"` (sin márgenes ni ancho máximo) y la cabecera se vuelve `fixed` flotando sobre la escena. Sin él, `data-canvas="page"`.
- `scene` va en `.canvas-layer` (fija, `inset: 0`, `z-index: 0`). El fondo de la escena debe ser `--base`. Un solo `<Canvas>` por pantalla, con respaldo 2D y HTML accesible.
- Los hijos van en `.canvas-hud` (`z-index: 1`, `padding` que respeta cabecera, dock y barra inferior; `pointer-events: none` salvo en `.hud-panel`, `.hud-bar`, `.mission`, enlaces, botones, campos y `[data-hud]`). La escena recibe el puntero (orbitar, hacer clic) donde no hay paneles.
- `--shell-left` es la variable CSS con el hueco del dock; úsala si necesitas alinear algo con él.
- Heredado: la ruta `/taller` antigua se sigue tratando como `data-canvas="flush"` (sin márgenes, cabecera en el flujo) hasta que se migre a `CanvasBleed`.

## Elevation & Depth

Profundidad de maqueta: sombras en capas (contacto, cuerpo y proyección larga y suave), tintadas con `--shadow-color` (azul marino en claro, casi negro azulado en noche). Nunca duras. Los paneles de cristal llevan además un filo de luz arriba (`--sheen`).

### Shadow Vocabulary
- **Card** (`--shadow-card`): `0 1px 0 sheen inset, 0 1px 2px /.07, 0 6px 14px -4px /.09, 0 20px 36px -20px /.16`: tarjetas y paneles de lista en reposo.
- **Lift** (`--shadow-lift`): tarjeta enlazada al pasar el ratón (sube 3 px) y misión pulsable.
- **HUD** (`--shadow-hud`): dock, barra de estado y paneles flotantes.
- **Pop** (`--shadow-pop`): menús, tooltips, avisos, paleta y diálogos.
- **Canto del botón gordo:** `0 3px 0 0 <canto>` (1 px al pulsar) más una sombra blanda del color del botón.

### Named Rules
**La regla del panel flotante.** Todo lo que está por encima del lienzo es un panel: blanco/cristal, esquina grande, sombra larga. Nada de cajas planas con borde de 1 px sobre el lienzo.

**La regla del lienzo único.** Un solo `<Canvas>` 3D por pantalla, diferido y con silueta 2D de respaldo; los listados usan miniaturas estáticas. Toda la profundidad de interfaz es CSS.

## Shapes

- Controles y campos: 12 px (`rounded-control`). Paneles y tarjetas: 20 px (`rounded-card`). Piezas grandes y diálogos: 28 px (`rounded-hero`). El dock y la barra de estado: 20 px; el dock móvil: 24 px.
- Etiquetas, chips, pestañas y control segmentado: **píldora** (`rounded-full`).
- Las fichas de vehículo (dock, filas) son cuadrados de 36–40 px con 12 px de radio; los iconos de misión, de 40 px con 12 px.

## Components

### Buttons (`.chunky`)
- **Primary:** azul eléctrico con brillo arriba, **canto** de 3 px en `--accent-edge` y sombra blanda azul. Al pasar el ratón (puntero fino) sube 1 px y el canto crece a 4 px; al pulsar baja 2 px, `scale(.97)` y el canto se recoge a 1 px. Una por pantalla.
- **Secondary:** ficha blanca con borde `--line` y canto `--neutral-edge`; hover `--surface-2` y borde fuerte.
- **Danger:** la misma pieza en rojo de estado. **Outline** y **Ghost**: planos, sin canto; hover en azul suave.
- 44 px en móvil; 40 px (36 en pequeño) desde 768 px. Deshabilitado: plano, 50 %.

### Chips y badges (`.chip`, `<Badge>`, `<Chip>`)
Píldora gruesa (28 px de alto, 20–24 en `Badge`) con icono de 14 px y texto. Tonos `chip-accent | -ok | -warning | -danger | -info`. Un chip pulsable (`button.chip`) con `aria-pressed="true"` se rellena de azul con su canto. El estado nunca va solo en color.

### Paneles (`.hud-panel`, `.hud-bar`, `.hud-pop`, `<Card>`, `.list-panel`)
- `hud-panel`: cristal (`--glass` al 94 %, `blur(12px)`), borde claro, radio de tarjeta, sombra HUD. `hud-bar`: lo mismo con 20 px de radio (barras). `hud-pop`: lo mismo con sombra pop (menús y avisos).
- `Card` / `.surface-card` / `.list-panel`: panel sólido para el contenido de lectura (listas, formularios). Las filas llevan 16 px laterales y se separan con una línea fina; al pasar el ratón se tiñen de azul al 5 %.

### Misiones (`.mission`, `<Mission>`)
Tarjeta de un aviso o tarea con **datos reales**: barra de color a la izquierda según `data-tone` (más icono y texto del estado), título, descripción y, a la derecha, plazo o importe. Si es un enlace o un botón, sube 2 px al pasar el ratón.

### Progreso (`.segbar`, `<Progress>`)
Barra segmentada de 10 piezas redondeadas; cada pieza se rellena en proporción (`--f`), de modo que la cifra es exacta (la última puede quedar a medias). Entra con un escalón de 28 ms por pieza. Lleva `role="progressbar"` con `aria-valuenow`.

### Inputs
Campo de 12 px con relleno `--surface-2`, borde de 1 px en `--line-strong` (3:1) y sombra interior suave; 44 px en móvil (texto de 16 px) y 40 px desde 768 px. Foco: el borde pasa a azul, el fondo a blanco y aparece el anillo de 2 px. Error: borde rojo con `aria-invalid`.

### Pestañas y control segmentado
Pista hundida en píldora (`--surface-3`) con la pieza activa en blanco, elevada, con el texto en azul. `<Tabs>` y `<SegmentedControl>` comparten forma.

### Navegación
- **Dock:** pestañas de 44 px, icono de 20 px y texto 700. Activa: pastilla azul suave que se desliza entre secciones (muelle de 320 ms, rebote 0,18) con borde interior azul, icono más grueso y `aria-current="page"`. Estrecho: solo icono con tooltip.
- **Fichas de vehículo** (particular; sustituyen al abanico de muestras): una por coche (hasta 4), con su pintura como cuadrado de arcilla (`.clay`) con icono de coche, el nombre, la matrícula y lo que tiene vencido o próximo (icono + texto). El que estás viendo lleva anillo azul. Se retiró el abanico porque su despliegue en 3D CSS no encajaba con un dock plano y compacto, y porque las fichas dan el mismo reconocimiento por color en menos espacio.
- **Barra de estado:** selector de espacio (ficha azul con icono de garaje o taller, nombre y tipo), búsqueda en píldora, avisos y cuenta.
- **Móvil:** dock flotante con «Registrar» elevado (círculo azul de 44 px).

### Fichas de pintura (`.clay`)
El color del vehículo con un brillo de arcilla arriba (degradado a 160°), sombra interior abajo y sombra suave. `.lacquer` se mantiene como alias hasta que las pantallas lo cambien.

## Motion

- **Curva:** `cubic-bezier(0.23, 1, 0.32, 1)` (salida fuerte) para entradas y respuestas; `cubic-bezier(0.32, 0.72, 0, 1)` para hojas y cajones.
- **Entrada (`.pop-in`, `.stagger`, `animate-pop-in`):** sube 8–12 px desde 95–97 % de escala, se pasa un pelín y asienta; 240–280 ms, con 40–45 ms entre elementos. Las pantallas entran en cascada (`.stagger` en `AppShell`).
- **Pulsar:** `scale(.97)` en 100–140 ms; el botón gordo además baja 2 px.
- **Hover:** 150–220 ms, solo con puntero fino; las tarjetas suben 2–3 px.
- Solo se animan `transform`, `translate`, `scale`, `opacity`, color y sombra. Con `prefers-reduced-motion` todo queda quieto y completo (el bloque global deja las animaciones en 0,01 ms).

## Do's and Don'ts

### Do:
- **Haz** que todo lo de un vehículo lleve su ficha de pintura con `paintVars(color_hex)` y `.clay`, comprobando 4,5:1 del texto encima.
- **Haz** que un panel flote: `hud-panel` sobre el lienzo, `Card` o `.list-panel` para contenido de lectura.
- **Haz** los avisos y recordatorios como misiones (`<Mission>`), con su icono, su estado en palabras y su plazo real.
- **Haz** cifras tabulares alineadas a la derecha; si falta un dato, dilo y ofrece la acción («Faltan lecturas de este mes. Anotar km»).
- **Haz** que cada estado lleve icono y palabra, y que «según tus intervalos, no medido» aparezca una vez por sección.
- **Haz** el foco visible con 2 px de azul eléctrico (en noche, `--accent-ink`) y 2 px de separación.
- **Haz** que todo movimiento se quede quieto y completo con `prefers-reduced-motion` y que el cristal pase a opaco con `prefers-reduced-transparency`.

### Don't:
- **No** inventes puntos, niveles, logros, rachas ni «health score»: el juego es la forma, no los datos (regla 2).
- **No** uses la pintura del vehículo fuera de sus fichas: ni en fondos de página, ni en botones, ni en texto.
- **No** pongas más de un botón primario relleno de azul por pantalla ni uses el azul como fondo de superficies grandes.
- **No** uses rojo, ámbar o verde como decoración ni como única señal.
- **No** pongas más de un `<Canvas>` 3D por pantalla ni un WebGL por tarjeta; el 3D nunca va sin su silueta 2D y su HTML accesible.
- **No** pintes cajas planas con borde sobre el lienzo ni degradados de color decorativos; la profundidad sale de la sombra.
- **No** uses blanco ni negro puros para texto: las tintas son azul marino (`--fg`, `--fg-warm`).
- **No** dibujes la matrícula como una placa: va como texto en etiqueta (`<Plate>`).
- **No** pongas etiquetas en versalitas como antetítulo encima de un título.
