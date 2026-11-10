---
name: CarCare
description: Carta de colores de carrocería; cada vehículo es su muestra de pintura sobre el gris neutro de una cabina de igualación.
colors:
  gris-cabina: "#e4e4e1"
  cartulina: "#f7f7f4"
  cartulina-2: "#efefeb"
  cartulina-3: "#e2e2dd"
  linea: "#d3d3cd"
  linea-fuerte: "#7d807c"
  tinta: "#17191b"
  tinta-honda: "#101214"
  tinta-media: "#4d5155"
  tinta-tenue: "#5c6064"
  azul-calibracion: "#1f4fd8"
  azul-calibracion-tinta: "#1a45c2"
  sobre-azul: "#ffffff"
  azul-calibracion-suave: "rgb(31 79 216 / 0.11)"
  estado-vencido: "#b3261e"
  estado-vencido-suave: "rgb(179 38 30 / 0.11)"
  estado-proximo: "#855600"
  estado-proximo-suave: "rgb(214 150 20 / 0.2)"
  estado-en-plazo: "#17694a"
  estado-en-plazo-suave: "rgb(23 105 74 / 0.11)"
  estado-info: "#1f5f99"
  estado-info-suave: "rgb(31 95 153 / 0.1)"
  grafito: "#232528"
  grafito-2: "#2f3236"
  grafito-linea: "#3b3f44"
  grafito-tinta: "#f1f1ee"
  grafito-tinta-tenue: "#b6b9bc"
  grafito-azul: "#8fb0ff"
  pintura-sin-color: "#9aa0a6"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 112"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 112"
  figure:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.015em"
    fontFeature: "\"tnum\" 1"
    fontVariation: "'wdth' 112"
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
    fontWeight: 650
    lineHeight: "1rem"
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 78"
rounded:
  etiqueta: "5px"
  control: "8px"
  muestra-abanico: "10px"
  card: "16px"
  hero: "24px"
  muestra-redonda: "9999px"
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
    backgroundColor: "{colors.azul-calibracion}"
    textColor: "{colors.sobre-azul}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.cartulina}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.cartulina-2}"
  button-ghost:
    textColor: "{colors.tinta-media}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.cartulina-2}"
    textColor: "{colors.tinta}"
  button-danger:
    backgroundColor: "{colors.estado-vencido}"
    textColor: "{colors.sobre-azul}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.cartulina}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.cartulina}"
    rounded: "{rounded.card}"
    padding: "16px"
  badge-vencido:
    backgroundColor: "{colors.estado-vencido-suave}"
    textColor: "{colors.estado-vencido}"
    typography: "{typography.label}"
    rounded: "{rounded.etiqueta}"
    padding: "0 8px"
    height: "24px"
  badge-proximo:
    backgroundColor: "{colors.estado-proximo-suave}"
    textColor: "{colors.estado-proximo}"
    typography: "{typography.label}"
    rounded: "{rounded.etiqueta}"
    padding: "0 8px"
    height: "24px"
  nav-rail-item:
    textColor: "{colors.grafito-tinta-tenue}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-rail-item-active:
    backgroundColor: "{colors.grafito-2}"
    textColor: "{colors.grafito-tinta}"
  fan-chip:
    backgroundColor: "{colors.pintura-sin-color}"
    textColor: "{colors.tinta-honda}"
    rounded: "{rounded.muestra-abanico}"
    width: "184px"
---

# Design System: CarCare

## Overview

**Creative North Star: "La carta de colores"**

CarCare se presenta como la carta de colores de un taller de pintura: cada vehículo es su muestra lacada, con la pintura real del coche (`color_hex`), y todo lo demás es el gris neutro de una cabina de igualación, donde los colores se leen sin trampa. La pantalla es la cartulina en la que van grapadas las muestras; la barra lateral grafito es el armazón de la carta, y el abanico de muestras que sale de ella es la firma del mundo. El usuario reconoce sus coches por el color antes de leer el nombre.

La densidad es de herramienta, no de folleto: listas en panel con filas finas, cifras tabulares pegadas al margen derecho, pocas tallas de letra y un único azul de calibración para la acción principal. La profundidad es física y pequeña: la cartulina tiene filo de luz y canto, la muestra lacada tiene brillo de barniz, y las cartas se inclinan un poco hacia el puntero. El coche 3D procedural vive en un solo lienzo por pantalla, dentro de la cabina de la placa de muestra, y siempre tiene su silueta 2D y su información en HTML.

El tema claro («cabina», el predeterminado) es el de uso diario. El oscuro («cabina apagada») es la misma cabina con la luz apagada: grafito, sin acento neón. El mundo rechaza expresamente el panel oscuro con acento neón y el SaaS blanco de tarjetas iguales.

**Rasgos clave:**
- Gris cabina y cartulina neutros; el color del vehículo solo dentro de sus muestras lacadas.
- Barra lateral grafito en los dos temas y en los dos modos (particular y taller).
- Un solo azul de calibración para la acción principal, los enlaces de acción y el foco.
- Archivo variable: ancho para títulos, normal para el texto, estrecho y en versalitas para etiquetas, matrículas y códigos.
- Cifras tabulares alineadas a la derecha; lo que falta se dice con su acción, nunca con un cero inventado.
- Movimiento corto y con salida fuerte; con `prefers-reduced-motion` todo queda quieto y legible.

## Colors

Una paleta de cabina de igualación: grises neutros casi sin tinte, un azul de calibración para actuar, colores de estado solo para el estado y, por encima de todo, la pintura real de cada vehículo, que entra en la interfaz únicamente como muestra lacada.

### Primary
- **Azul de calibración** (`azul-calibracion`): el botón primario lacado («Registrar», «Añadir vehículo»), el anillo de foco y la guía luminosa. Su variante de texto (`azul-calibracion-tinta`) colorea los enlaces de acción («Ver la agenda», «Anotar km»). En oscuro sube a `#3b66f0` y su tinta a `#9db8ff`.

### Secondary
- **Pintura del vehículo** (variable `--paint`, dato del usuario, no de la interfaz): rellena las muestras lacadas. Su tinta (`--paint-ink`) se calcula en `paintVars` y es `tinta-honda` o blanco, la de mayor contraste. Sin color registrado, la muestra usa `pintura-sin-color`.

### Neutral
- **Gris cabina** (`gris-cabina`): el fondo de página y de la cabecera fija; el gris N8 de referencia.
- **Cartulina** (`cartulina`, `cartulina-2`, `cartulina-3`): tarjetas, paneles de lista, campos y botón secundario; los dos tonos inferiores para hover, celdas alternas y esqueletos.
- **Línea** (`linea`): separadores entre filas y bordes de tarjeta. **Línea fuerte** (`linea-fuerte`): bordes de campo y bordes al pasar el ratón; llega a 3:1 sobre gris cabina y cartulina (WCAG 1.4.11).
- **Tinta** (`tinta`, `tinta-honda`): texto principal; la honda para títulos y cifras grandes. **Tinta media** y **tenue** (`tinta-media`, `tinta-tenue`): descripciones, matrículas en lista y fechas relativas.
- **Grafito** (`grafito`, `grafito-2`, `grafito-linea`, `grafito-tinta`, `grafito-tinta-tenue`, `grafito-azul`): la barra lateral, igual en los dos temas (en oscuro baja a `#141618`). El activo de la barra es `grafito-2` con una regla de 3 px en `grafito-azul`, que también es el color del foco dentro de la barra, porque el azul de calibración no llega a 3:1 sobre grafito.

### Estados
- **Vencido** (`estado-vencido`), **Próximo** (`estado-proximo`), **En plazo** (`estado-en-plazo`) e **Info** (`estado-info`), cada uno con su fondo suave. Solo marcan el estado de un aviso, una zona o una orden, siempre con icono y palabra.

### Named Rules
**La regla de la cabina neutra.** El color del vehículo solo vive dentro de sus muestras lacadas (la carta del abanico, la placa del escaparate, la cabecera de la tarjeta, la muestra de la fila y la placa de la ficha). La única fuga permitida es el reflejo en el suelo de la cabina, dentro de la misma placa o tarjeta y mezclado al 16–18 % con la cartulina. Fuera de ahí, grises neutros y estados.

**La regla de la voz azul.** El azul de calibración significa «actúa aquí»: el botón primario, los enlaces de acción y el foco. Nunca decora, nunca rellena una superficie y hay un solo botón primario a la vista por pantalla.

**La regla del estado con palabra.** Rojo, ámbar y verde solo dicen estado, y nunca solos: cada estado lleva icono y texto («Vencido», «2 próximos»). La pintura de un coche rojo no es un aviso.

## Typography

**Display Font:** Archivo Variable, autoalojado (con ui-sans-serif, system-ui)
**Body Font:** Archivo Variable
**Label/Mono Font:** Archivo Variable al 78 % de anchura, en versalitas

**Character:** una sola familia variable hace de rotulación de carta de pintura: ensanchada al 112 % para títulos y cifras, normal para leer, y estrecha y espaciada para las etiquetas que en una carta real llevarían el código de la muestra.

### Hierarchy
- **Display** (700, 1.5rem en móvil y 1.875rem desde el contenedor de 50rem, anchura 112 %): el nombre del vehículo sobre su muestra lacada.
- **Headline** (600, 1.5rem en móvil y 1.875rem desde 768 px, anchura 112 %): el título de cada pantalla.
- **Title** (600, 1.125rem, anchura 112 %): títulos de sección («Pendiente», «Vehículos») y de diálogo; 1rem en títulos de tarjeta.
- **Figure** (700, 1.75rem/2rem, tabulares, anchura 112 %): las cifras del mes y el kilometraje de la placa; 1.25rem para los totales de gasto.
- **Body** (400, 0.875rem/1.25rem): filas de lista, descripciones y controles. 1rem en campos de formulario en móvil (evita el zoom de iOS) y en la línea de estado bajo el título desde 768 px, con un máximo de 42rem.
- **Label** (650, 0.75rem/1rem, 0.08em, versalitas, anchura 78 %): matrículas, códigos de pintura, rótulos de dato («Kilometraje», «Gasto del mes»), estados y el título del abanico.

### Named Rules
**La regla de las pocas tallas.** El rango lo dan el peso, la anchura y las versalitas, no una escalera de tamaños. Siete papeles y ninguno más.

**La regla de la cifra al margen.** Importes, kilómetros y plazos van con cifras tabulares y pegados al margen derecho de su fila o celda, sin partirse de su unidad.

**La regla de la etiqueta de muestra.** Las versalitas estrechas rotulan datos (matrícula, código, estado, rótulo de una cifra). Nunca van como antetítulo encima de un título.

## Layout

Rejilla de 8 px con medios pasos de 4 px: los huecos entre bloques son de 12, 16, 24, 32 y 40 px, y las secciones de Inicio se separan 40 px. La barra lateral grafito es fija: 76 px con solo iconos desde 768 px y 256 px desde 1024 px, plegable a 76 px; por debajo de 768 px desaparece y entra la barra inferior móvil (Inicio, Garaje, «Registrar», Agenda, Más). La cabecera es opaca, fija y de 64 px.

El contenido se centra con un máximo de 1240 px en el particular y 1440 px en el taller, con márgenes de 16, 24 y 32 px según el ancho. En Inicio, desde 1280 px, el escaparate ocupa el resto y «Pendiente» una columna de 25rem; debajo, tres cifras del mes en una fila de tres celdas (apiladas en móvil); después, vehículos y una columna de 22rem para gasto y actividad desde 1024 px. Los componentes se adaptan con consultas de contenedor (30, 32, 34, 40 y 50rem): la placa del escaparate pasa de apilada a muestra lateral de 13rem y de 16rem, y las filas de aviso sacan el plazo al margen derecho cuando caben.

Los objetivos táctiles miden 44 px en móvil y bajan a 36–40 px con puntero fino desde 768 px. Se comprueba a 360, 768 y 1280 px.

## Elevation & Depth

Profundidad física y corta, de objeto sobre una mesa: la cartulina es una losa con filo de luz arriba, una línea de canto abajo y una sombra proyectada suave; la muestra lacada añade brillo de barniz y un canto oscuro. La sombra se tiñe con `--shadow-color` (gris frío en claro, negro en oscuro) y nunca es dura ni desplazada. Al pasar el ratón por una tarjeta enlazada, sube 2 px y gana la sombra `lift`; los menús y diálogos usan `pop`. Las cartas se inclinan hacia el puntero (como mucho 6–8°) con perspectiva CSS; el único WebGL es el coche.

### Shadow Vocabulary
- **Losa** (`box-shadow: 0 1px 0 0 var(--sheen) inset, 0 1px 0 0 var(--line), 0 14px 24px -18px hsl(var(--shadow-color) / 0.55)`): tarjetas y paneles de lista en reposo.
- **Elevada** (`box-shadow: 0 10px 28px -12px hsl(var(--shadow-color) / 0.55), 0 2px 6px hsl(var(--shadow-color) / 0.2)`): tarjeta enlazada al pasar el ratón.
- **Flotante** (`box-shadow: 0 18px 48px -16px hsl(var(--shadow-color) / 0.6), 0 4px 12px hsl(var(--shadow-color) / 0.25)`): menús, paleta de órdenes y diálogos.
- **Laca** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4), inset 0 -2px 0 rgb(0 0 0 / 0.2), 0 10px 18px -12px hsl(var(--shadow-color) / 0.7)` sobre un degradado de barniz a 158°): toda muestra de pintura.

### Named Rules
**La regla de la losa.** Cada superficie de cartulina es una losa con su filo de luz y su canto, no una caja plana con borde. La laca queda reservada a la pintura del vehículo y a los botones primario y de peligro.

**La regla del lienzo único.** Un solo `<Canvas>` 3D por pantalla, cargado de forma diferida y con silueta 2D de respaldo; los listados usan miniaturas estáticas, nunca un WebGL por tarjeta. Toda la profundidad de interfaz es CSS.

## Shapes

Esquinas de carta de muestra: redondeadas y firmes, más grandes cuanto mayor es la pieza. Controles y campos, 8 px; cartas del abanico, 10 px; tarjetas y paneles de lista, 16 px; la placa del escaparate, 24 px. Las etiquetas de estado son rectángulos de esquina corta (5 px), no píldoras. Las muestras de la fila son cuadrados de 40 px con 8 px de radio; las que eligen vehículo en el escaparate son círculos de 32 px. La placa de la ficha se gira 12° sobre su eje vertical para enseñar el canto. El remache del abanico, un círculo de 10 px en `grafito-tinta-tenue`, es la geometría que firma tanto el abanico como el logotipo.

## Components

### Buttons
Lacados y táctiles: responden al pulsar con `scale(0.97)` en 100 ms.
- **Shape:** esquina de control (8px); 44 px de alto en móvil, 40 px (36 px en pequeño) desde 768 px.
- **Primary:** muestra de azul de calibración con brillo de barniz arriba (degradado blanco al 18 %), canto oscuro abajo y sombra corta. Al pasar el ratón, `brightness(1.1)`; al pulsar, la sombra se recoge.
- **Hover / Focus:** transición de 200 ms con salida fuerte; foco con anillo de 2 px en azul de calibración y 2 px de separación.
- **Secondary:** cartulina con borde de línea, filo de luz y sombra mínima; al pasar el ratón, `cartulina-2` y borde fuerte. **Ghost:** solo texto en tinta media, con fondo `cartulina-2` al pasar. **Outline:** borde fuerte sin fondo. **Danger:** la misma laca en rojo de estado.

### Chips
- **Style:** etiqueta de muestra: rectángulo de 5 px, versalitas estrechas al 78 %, fondo suave del estado y texto del estado, con icono de 12–14 px (24 px de alto, 20 px en pequeño).
- **State:** solo se pinta píldora para lo que pide atención (Vencido, Próximo, Archivado); «En plazo» y «Sin datos» van como texto con icono.

### Cards / Containers
- **Corner Style:** 16px; la placa del escaparate, 24px.
- **Background:** cartulina sobre gris cabina.
- **Shadow Strategy:** losa en reposo, elevada al pasar el ratón (ver Elevation & Depth).
- **Border:** 1 px en `linea`, `linea-fuerte` al pasar.
- **Internal Padding:** 16 px; las filas de un panel de lista llevan 16 px laterales y 10–12 px verticales, separadas por una línea fina.
- **Tarjeta de vehículo:** cabecera lacada con su pintura, nombre y marca; debajo, la cabina con la miniatura estática y el reflejo de la pintura en el suelo; al pie, matrícula en etiqueta, km tabulares y estados.

### Inputs / Fields
- **Style:** cartulina, borde de 1 px en `linea-fuerte`, 8 px de radio, 44 px en móvil (texto de 16 px) y 40 px desde 768 px.
- **Focus:** el borde pasa a azul de calibración y el anillo de foco se pega al campo; el cursor de texto es azul.
- **Error / Disabled:** con `aria-invalid` el borde pasa a rojo de estado; deshabilitado al 60 % de opacidad.

### Navigation
- **Barra lateral grafito:** enlaces de 44 px con icono de 20 px y texto de 14 px en `grafito-tinta-tenue`; al pasar, fondo `grafito-2` y tinta clara. El activo lleva una pastilla `grafito-2` que se desliza entre secciones (muelle de 350 ms, rebote 0,12) con la regla izquierda de 3 px y el icono en `grafito-azul`.
- **Cabecera:** opaca en gris cabina, 64 px, con el espacio, la búsqueda, los avisos y la cuenta.
- **Móvil:** barra inferior con tres secciones, «Registrar» en un círculo azul y «Más».

### Abanico de muestras (firma)
Una carta lacada por vehículo (hasta tres), de 184 px de ancho, con nombre y modelo sobre la pintura y, en una franja de cartulina, matrícula y estado en versalitas. Las cartas giran sobre el remache de abajo a la izquierda: en reposo se escalonan 72 px y 2°, y al pasar el ratón o llegar con el teclado se abren en abanico (76 px y 7°) en 320 ms con salida fuerte; la que está bajo el puntero sale 14 px hacia delante. El vehículo que estás viendo va delante con anillo `grafito-azul`. Cada carta es un enlace a su ficha. Con movimiento reducido el abanico queda abierto y quieto.

### Placa de muestra (escaparate y ficha)
En Inicio, una placa de 24 px de radio con la carta lacada a la izquierda (nombre, kilometraje en cifra, matrícula y pintura con su nombre y su código) y, a la derecha, la cabina de igualación con el coche 3D girando despacio. Las muestras redondas cambian de vehículo; la nueva pintura barre la carta de arriba abajo en 380 ms. En la ficha, la misma muestra en pequeño (112 × 80 px, 144 × 96 px desde 768 px) junto al título.

## Do's and Don'ts

### Do:
- **Haz** que todo lo de un vehículo lleve su muestra lacada con `paintVars(color_hex)`, y el texto encima con `--paint-ink`, comprobando 4,5:1 en el texto pequeño.
- **Haz** las cifras con números tabulares y alineadas a la derecha; si falta un dato, dilo y ofrece la acción («Faltan lecturas de este mes. Anotar km»).
- **Haz** que cada estado lleve icono y palabra, y que el aviso «según tus intervalos, no medido» aparezca una vez por sección.
- **Haz** las entradas con `cubic-bezier(0.23, 1, 0.32, 1)` y duraciones de 100 a 520 ms, animando solo `transform`, `opacity`, `clip-path`, color y sombra.
- **Haz** que todo movimiento se quede quieto y completo con `prefers-reduced-motion`: el abanico abierto, la pintura sin barrido, las cartas sin inclinación.
- **Haz** el foco visible con 2 px de azul de calibración (o `grafito-azul` dentro de la barra) y 2 px de separación.

### Don't:
- **No** uses la pintura del vehículo fuera de sus muestras: ni en fondos de página, ni en bordes, ni en botones, ni en texto.
- **No** conviertas la interfaz en un panel oscuro con acento neón ni en un SaaS blanco de tarjetas iguales; el oscuro es la cabina apagada en grafito.
- **No** pongas más de un `<Canvas>` 3D por pantalla ni un WebGL por tarjeta; el 3D nunca va sin su silueta 2D y su HTML accesible.
- **No** uses rojo, ámbar o verde como decoración ni el azul de calibración como relleno de superficie.
- **No** dibujes la matrícula como una placa de matrícula: va como texto en etiqueta de muestra.
- **No** pongas etiquetas en versalitas como antetítulo encima de un título.
- **No** enseñes cifras, puntuaciones de salud ni desgastes que no salgan de datos reales.
