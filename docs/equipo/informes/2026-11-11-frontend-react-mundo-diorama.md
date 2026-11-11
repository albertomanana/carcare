# Informe · frontend-react · Mundo «Diorama» (fase A: el sistema)

Fecha: 11/11/2026 · Encargo de la sesión principal, pedido por Alberto · Sin commits.

## 1. Objetivo

Alberto pidió que **toda** la página, para todos los usuarios, parezca un juego, y que el perfil del taller quede «como el vídeo» (maqueta isométrica de arcilla, estilo juego de estrategia limpio). Esto sustituye el mundo «Carta de colores» por **«Diorama»**. Esta fase A deja el sistema (tokens, primitivas, estructura, lienzo a sangre y documentación) para que otros dos agentes apliquen el mundo a las pantallas del particular y del taller. No se reabre la decisión.

## 2. Qué hice

### Tokens y utilidades (`frontend/src/index.css`, reescrito)
- Claro «día de diorama»: lienzo `--base #e9f0fa` (es también el fondo del 3D), paneles `#ffffff`, tintas azul marino, acento **azul eléctrico `#2559e8`**. Oscuro «noche de diorama»: `#0e1a30` / `#162540`, mismos acentos (`#3b69f0`, tinta `#a4bdff`).
- Los nombres de variables que lee el 3D (`--base --surface --surface-2 --surface-3 --line --line-strong --fg --fg-muted --fg-subtle --accent --danger --warning --ok --info`) **no cambian**; `three/env.ts` (FALLBACK) sigue con los valores del mundo anterior, así que si falla la lectura el 3D usará gris en vez de azul pastel: **petición 29 a experto-3d** (§7).
- Esquinas: `rounded-control` 12 px, `rounded-card` 20 px, `rounded-hero` 28 px. Pesos remapeados en el tema (`font-medium` 600, `semibold` 700, `bold` 800) y `.font-display` a anchura 108 %: toda la app sube un escalón de peso sin tocar pantallas. Sin fuente nueva ni dependencia nueva.
- Sombras en capas (`--shadow-card`, `-lift`, `-hud`, `-pop`).
- Utilidades nuevas: `.hud-panel`, `.hud-bar`, `.hud-pop`, `.chunky` (+ `.chunky-accent`, `.chunky-danger`), `.chip` (+ `-accent -ok -warning -danger -info`), `.mission` (+ `data-tone`), `.segbar`, `.pop-in`, `.canvas-bleed`/`.canvas-layer`/`.canvas-hud`, `.clay`.
- `.stagger` y `.enter` pasan de «rise con desenfoque y perspectiva» a **pop-in con muelle corto** (280 ms, escalón 40 ms). `prefers-reduced-motion` y `prefers-reduced-transparency` respetados.
- **Retirado:** `.fan*` (el abanico), `.rail*`/`--rail*` (la barra grafito). **Heredado, se mantiene y hay que quitar después:** `.lacquer` (alias de `.clay`, lo usan `VehicleCard`, `VehicleVisuals`, `PersonalDashboard`, `Showroom`, `VehicleDetailPage`), `.paint-wipe` (`Showroom`, `PaintFan` ya no), `.scene`, `.z-near`, `.z-far`, `.tilt`/`Tilt` (decorativo), `.link-draw`, `.zoom`, `.glass` (portada), `.surface-card` y `.list-panel` (siguen vigentes, ahora con el estilo nuevo).

### Primitivas (`components/ui/`)
Todas heredan el estilo sin tocar las pantallas: `Button`/`IconButton`/`ButtonLink` (botón gordo con canto; primaria azul, secundaria ficha blanca, peligro, outline y ghost planos), `Badge`/`StatusPill` (píldora), `Plate` (usa `.tag-label`), `Card`, inputs (relleno hundido, borde `--line-strong` 3:1, `SearchInput` que ya no se encoge hasta desbordar), `Tabs` y `SegmentedControl` (píldora hundida con pieza activa elevada), `Dialog`, `DropdownMenu`, `Tooltip`, `Toaster`, `Skeleton`, `EmptyState`/`ErrorState`, `Avatar`, `Checkbox`/`Switch`, `PageHeader`, `Section`, y **`Progress` ahora segmentado** (10 piezas, relleno proporcional exacto, mismo API más `segments?`).
Nuevos en `components/ui/Hud.tsx`: **`Panel`**, **`Chip`** y **`Mission`**.

### Estructura (`components/layout/`)
- `AppShell` reescrito: **dock flotante** a la izquierda (`hud-panel`, a 12 px de los bordes; 76 px en tableta y plegado, 240 px en escritorio), **barra de estado** (HUD) flotante arriba y contenido desplazado por `--shell-left`. Se conservan los grupos, los nombres, las migas de pan (`PageHeader`/`Breadcrumbs`), el atajo Ctrl+K, la paleta, «Saltar al contenido» y los tooltips del dock estrecho.
- `MobileNav`: dock inferior flotante con «Registrar» como botón redondo elevado (sigue sin pintarse de azul si la pantalla ya tiene primaria).
- `WorkspaceSwitcher`: pastilla con ficha azul (icono de garaje o taller), nombre y tipo.
- `Logo`: marca nueva (ficha azul con plataforma isométrica y bloque). `NotificationBell`, `UserMenu` y `CommandPalette` con `hud-pop`.
- **`PaintFan` retirado** y sustituido por **`VehicleDock`** («fichas» de vehículo en el dock): un cuadrado de arcilla con la pintura real del coche, nombre, matrícula y lo vencido o próximo con icono y texto; anillo azul en el que estás viendo; en el dock estrecho solo la ficha con un punto de estado (icono) y tooltip. Motivo: el despliegue 3D del abanico no encaja en un dock plano y compacto, y las fichas dan el mismo reconocimiento por color en menos espacio.
- **Lienzo a sangre:** `CanvasBleed` + `useCanvasBleed` + `canvas-context.ts`. Verificado con una pantalla de prueba temporal (borrada) a 1440 claro y 390 oscuro.
- `index.html` y `ThemeProvider` (meta `theme-color`): colores nuevos (archivos fuera de mi zona estricta, cambio de dos valores).

### Documentación
`DESIGN.md` reescrito («Diorama»; la «Carta de colores» queda marcada como sustituida el 11/11/2026 por pedido de Alberto, con el motivo) y `.impeccable/design.json` regenerado.

## 3. Archivos tocados

Nuevos: `components/layout/{CanvasBleed.tsx, canvas-context.ts, VehicleDock.tsx}`, `components/ui/Hud.tsx`.
Borrado: `components/layout/PaintFan.tsx` (sustituido por `VehicleDock`).
Modificados: `index.css`, `index.html`, `app/ThemeProvider.tsx`, `components/layout/{AppShell, MobileNav, WorkspaceSwitcher, Logo, NotificationBell, UserMenu, CommandPalette}.tsx`, `components/ui/{variants.ts, Badge, Progress, Tabs, SegmentedControl, Dialog, DropdownMenu, Tooltip, Toaster, Skeleton, States, Avatar, Checkbox, PageHeader, Section, inputs}.tsx`, `DESIGN.md`, `.impeccable/design.json`, `docs/equipo/TABLERO.md`. No toqué `features/*` ni `three/`.

## 4. Evidencias

**Contraste (cálculo WCAG, `contraste.cjs` en la carpeta del informe).** Todos los pares de texto ≥ 4,5:1 en claro y oscuro: `--fg` 16,1:1 sobre panel, `--fg-muted` 7,7:1, `--fg-subtle` 6,2:1 (5,4:1 sobre el lienzo), `--accent-ink` 7,0:1; blanco sobre `--accent` 5,7:1 (claro) y 4,7:1 (noche); texto de estado sobre su fondo suave ≥ 4,9:1 incluso sobre el lienzo. No-texto ≥ 3:1: `--line-strong` 3,3:1 sobre el lienzo y 3,8:1 sobre el panel, el acento 5,7:1 sobre el panel (3,3:1 en noche). Dos pares fallaban en la primera propuesta (texto de estado sobre su fondo suave sobre el lienzo, 4,0–4,4:1) y se corrigieron oscureciendo los estados y aligerando el fondo suave.

**Comandos (desde `frontend/`, 11/11/2026).** `npm run typecheck` 0 errores · `npm run lint` 0 errores (los avisos que quedan son anteriores: `CommandPalette`, `router`, `LineItemsEditor`, `RecordsView`, `VehicleFormPage`, `three/car/CarModel`; ninguno en archivos nuevos) · `npm run test` 19 archivos, 168 tests en verde (en dos ejecuciones intermedias fallaron un test «dbg» y dos más de `three/`, de experto-3d mientras editaba; en la ejecución final pasan) · `npm run build` correcto (`vite build` en 6,8 s; el chunk de three.js sigue aparte).

**Capturas** (carpeta `docs/equipo/informes/2026-11-11-frontend-react-mundo-diorama/`): `antes-*` y `despues-*` de Inicio del particular, Garaje, Ficha de un coche y Órdenes del taller a 1440 y 390 px, en claro y oscuro (32 imágenes). Las «antes» están hechas con el código de `HEAD` en un `git worktree` temporal (ya retirado). Además `rev-*` (768 y 360, claro) para revisar el responsive. `capturar.cjs` las genera.

**Revisión a 360/768/1280.** Revisé Inicio, Garaje, Ficha y Órdenes a 360, 390, 768 y 1440. Encontré y corregí dos cosas: (a) en Órdenes a 768 el buscador se encogía y se salía de su caja (ya pasaba antes, sin solaparse, pero el dock más ancho lo empeoró): `SearchInput` lleva ahora `min-w-28` y en una fila con `flex-wrap` pasa a la línea siguiente; (b) la matrícula junto al título de la ficha se partía en dos líneas a 360 px (`h1 .tag-label { white-space: nowrap }`). También corregí un fallo mío: el anillo del vehículo actual en el dock no salía (barra invertida mal escapada en la expresión regular).

## 5. Guía de uso del sistema (para los agentes de pantallas)

### Qué heredáis gratis
Todo lo que ya usa `Button`, `Card`, `Badge`, `Tabs`, `SegmentedControl`, inputs, `Dialog`, `DropdownMenu`, `Progress`, `EmptyState`… y las clases `list-panel`, `surface-card`, `tag-label`, `tabular`, `lift`, `stagger` ya está en el mundo nuevo. Los títulos y los pesos ya son más gruesos.

### Reglas rápidas
1. **Sobre el lienzo, todo flota:** un panel (`hud-panel`) o una tarjeta (`Card`/`list-panel`), nunca una caja plana con borde. Sin fondos de color decorativos ni degradados.
2. **Una sola primaria azul** por pantalla (`<Button variant="primary">`); lo demás, secundaria/ghost.
3. **Estado = icono + palabra + color.** Rojo/ámbar/verde solo como estado.
4. **Nada inventado:** misiones, chips y barras solo con datos de la API. Si falta un dato, dilo con su acción (`available:false` → `reason`).
5. **Pintura del vehículo** solo en su ficha: `style={paintVars(v.color_hex)}` + clase `clay`.
6. **Sin `Canvas` extra:** uno por pantalla; el resto, miniaturas.

### Clases
| Clase | Para qué | Ejemplo |
|---|---|---|
| `hud-panel` | Panel de cristal que flota (lateral de ficha, resumen, filtros). Radio 20 px, sombra HUD | `<aside className="hud-panel p-4">…</aside>` |
| `hud-bar` | Barra flotante compacta (cabecera de una escena, barra de herramientas) | `<div className="hud-bar flex h-12 items-center gap-2 px-3">` |
| `hud-pop` | Menús, tooltips, popovers | (ya lo usan `DropdownMenu` y `Tooltip`) |
| `chunky` + `chunky-accent` / `chunky-danger` | Dar volumen de botón gordo a un elemento propio (la clase `Button` ya la usa) | `<a className="chunky chunky-accent rounded-control bg-accent px-5 py-2 text-on-accent">` |
| `chip` + `chip-accent/ok/warning/danger/info` | Píldora de estado o filtro. Pulsable: `button.chip` con `aria-pressed="true"` se rellena de azul | `<button className="chip" aria-pressed={on}>Solo tarde</button>` |
| `mission` + `data-tone="danger"` | Tarjeta de aviso/tarea con barra de color a la izquierda. Si es `a`/`button`, sube al pasar el ratón | `<Link className="mission flex items-center gap-3" data-tone="danger" to={…}>…</Link>` |
| `segbar` (hijos `<span style="--f:.4">`) | Barra segmentada. Casi siempre usa `<Progress>` | `<Progress value={0.64} tone="warning" label="Intervalo" />` |
| `pop-in` con `--i` | Entrada con muelle corto escalonada (45 ms) | `<li className="pop-in" style={{ '--i': i } as CSSProperties}>` |
| `stagger` | Los hijos directos entran en cascada | `<div className="stagger">…</div>` |
| `clay` | Ficha de pintura del vehículo (brillo de arcilla). Texto con `--paint-ink` | `<span className="clay rounded-xl" style={paintVars(hex)}>` |
| `lift` | Tarjeta enlazada: sube 3 px y gana sombra (solo ratón) | `<Link className="lift surface-card …">` |
| `tag-label` | Rótulo corto en versalitas gruesas (matrícula, código, rótulo de cifra). Nunca sobre un título | `<span className="tag-label">Kilometraje</span>` |

### Componentes
```tsx
import { Panel, Chip, Mission } from '@/components/ui/Hud'
import { Progress } from '@/components/ui/Progress'
import { CanvasBleed } from '@/components/layout/CanvasBleed'

<Chip tone="danger" icon={<OctagonAlert />}>Vencido</Chip>
<Mission as={Link} to={`${base}/agenda`} tone="danger" icon={<OctagonAlert />}
         title="Cambio de aceite" description="El rojo · 4821 KTB" trailing="pasado en 558 km" />
<Panel className="p-4">…</Panel>
```
`Mission` solo pinta lo que le pases; el estado va en `tone` **más** el icono y el texto del título/descripción.

### Lienzo a sangre (Inicio del taller, Inicio del particular, Garaje)
```tsx
<CanvasBleed
  scene={<MiEscena className="h-full w-full" />}            // un solo Canvas; fondo = --base
  hudClassName="grid content-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
  <aside className="hud-panel p-4">…</aside>                 // paneles encima de la escena
  <section className="hud-panel p-4">…</section>
</CanvasBleed>
```
- `AppShell` pone `main[data-canvas="bleed"]` (sin márgenes ni ancho máximo) y la cabecera pasa a `fixed` flotando sobre la escena. El dock sigue encima; la escena ocupa **toda** la ventana, por debajo.
- `scene` va fija (`inset: 0`) y recibe el puntero donde no hay paneles. Los paneles reciben el puntero (`.hud-panel`, `.hud-bar`, `.mission`, `a`, `button`, campos y `[data-hud]`); el resto de la capa lo deja pasar.
- La capa de paneles ya reserva cabecera (5 rem), dock (`--shell-left`) y barra inferior móvil (7 rem). Si necesitas alinear algo con el dock, usa `var(--shell-left)`.
- La escena debe tener la alternativa 2D y su HTML accesible; el 3D no debe pintar su propio fondo distinto de `--base`.
- La ruta `/taller` actual sigue en modo heredado (`data-canvas="flush"`, cabecera en el flujo). Al migrarla a `CanvasBleed` desaparece la expresión regular de `AppShell` (`flush`).

### Qué quitar luego
Cuando las pantallas dejen de usarlas: `.lacquer` (→ `.clay`), `.paint-wipe`, `Tilt`/`.scene`/`.z-near`/`.z-far`, `StatCard.emphasis`, `PageHeader.eyebrow`, `CardHeader.icon` (ya estaban en desuso), `AppShell.flush` y la prop `inverted` (ya retirada de `Logo`).

## 6. Limitaciones

- **Ninguna pantalla se ha rediseñado** (es la fase A). Las pantallas heredan forma, color y peso, pero conservan su maquetación (p. ej. el escaparate del Inicio mantiene su cabina gris del 3D, que lee el entorno por su cuenta).
- **No he podido ver el vídeo de referencia**; el estilo es el del prompt (maqueta clay / estrategia limpia). Las capturas «después» son del sistema, no del perfil final del taller.
- El anillo de foco, la navegación por teclado y los diálogos se conservan, pero **no he pasado axe** sobre el mundo nuevo (queda como siguiente paso).
- `backdrop-filter` bajo `hud-panel` no se ha medido en un equipo sin GPU; con `prefers-reduced-transparency` pasa a opaco. En el dock móvil hay un `backdrop-filter` encima de escenas WebGL a sangre: conviene medirlo con GPU real.
- Pesos 700–800 en toda la app: a 360 px algún título largo se parte antes que antes (visto en la ficha: «Kia / Sportage»). No lo he rebajado.
- Mi instancia de pruebas (PHP :8046 + Vite :5198, y un segundo par :8047/:5199 con el código antiguo para las capturas «antes») va con datos demo; la API se atiende de una petición en una y las capturas tardan.

## 7. Siguiente paso propuesto

1. **experto-3d:** actualizar `FALLBACK` de `three/env.ts` a los valores nuevos (`base #e9f0fa`, `surface #ffffff`, `fg #14213a`, `accent #2559e8`…, y los del oscuro si los tiene) y que el fondo del entorno use `--base`. Hasta entonces el 3D usa los tokens CSS al montarse (funciona), pero el respaldo sin DOM es gris.
2. **Agentes de pantallas:** Inicio del particular y del taller y Garaje sobre `CanvasBleed`; avisos/recordatorios como `Mission`; filtros como `chip`; retirar lo «heredado» de §5.
3. **qa-tester:** pasada de axe y de teclado sobre dock, barra de estado y diálogos; revisar contraste del cristal sobre escenas oscuras.
