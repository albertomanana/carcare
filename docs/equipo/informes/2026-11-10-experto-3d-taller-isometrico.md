# Taller 3D: maqueta isométrica de arcilla (experto-3d)

**Fecha:** 10‑11/11/2026 (con una pausa por el límite de uso) · **Agente:** experto-3d · **Encargo:** sesión principal, a petición de Alberto.

## Objetivo

Convertir la escena de «Taller 3D» del modo taller en una maqueta isométrica de arcilla, al estilo de un juego de estrategia. La cámara tiene un ángulo fijo, se desplaza arrastrando y se acerca con zoom. Los coches tienen el color real del vehículo en tono mate y solo se mueven con GSAP cuando cambia el estado real de su orden. Al hacer clic, la cámara enfoca lo elegido. El resto de la app sigue en el mundo «Carta de colores».

## Qué se hizo

### Escena (`WorkshopCanvas.tsx`, reescrita)

- **Cámara isométrica.** Es una `OrthographicCamera` con azimut de 45° y elevación de 35°.
  - `OrbitControls` tiene el giro desactivado. El paneo va en el plano del suelo (botón izquierdo o derecho, o un dedo) y está acotado a la maqueta con holgura.
  - El zoom va con la rueda o pellizcando, entre 0,7× y 5× el encuadre general.
  - El encuadre general se calcula con `fitOrtho` (nuevo en `fit.ts`). Proyecta la caja de la nave, devuelve `zoom` y un objetivo en el suelo, y respeta `focusInset`.
- **Foco.** Se enfoca al hacer clic en un coche o en un elevador, al pulsar un rótulo o cuando llega `selectedOrderId`/`selectedBay` desde la página.
  - GSAP mueve el objetivo y el zoom en 0,8 s con `power3.out`. El acercamiento máximo es 3,2× el general.
  - Si la página cambia el margen en pleno vuelo (por ejemplo, al abrirse el panel), el vuelo se reencamina sin saltos.
  - Un clic en el vacío, la tecla Escape o el botón «Ver toda la nave» vuelven al encuadre general y llaman a `onSelectBay(null)`. Escape se ignora si hay un diálogo, un menú o un campo activos.
  - Un arrastre de más de 6 px no cuenta como clic.
- **Luz de estudio.**
  - `HemisphereLight`, sin negros puros.
  - Un `DirectionalLight` con sombras PCF: mapa de 2048 (1024 en pantallas pequeñas), `bias` −0,0004, `normalBias` 0,03 y `radius` 3. Su cámara de sombra se ajusta proyectando las esquinas de la nave.
  - Proyectan sombra: la nave estática (muros, columnas y atrezo), los carros de los elevadores y la carrocería y las lunas de los coches. Las ruedas y los pilotos no.
  - Una `ShadowMaterial` bajo la losa da la sombra de la maqueta sobre la «mesa».
  - Mapa de tonos `NeutralToneMapping`, para que los colores planos no se apaguen. No hay `MeshReflectorMaterial`.
- **Material de arcilla.** Todo es `MeshStandardMaterial` con roughness 0,7 y metalness 0,1. Las lunas usan 0,32 para que se distingan.
  - Los coches llevan el color real (`clayColor`): un 15 % menos saturado y con la luminosidad entre 0,2 y 0,88.
  - Si el vehículo no tiene color registrado, se usa azul, amarillo, blanco o rojo, fijo según el id del vehículo.
- **Escenario.** La distribución sale de `workshop/layout.ts`:
  - entrada con pórtico a la derecha;
  - calzada con línea discontinua;
  - espera (órdenes sin elevador que no están «Listo»);
  - elevadores numerados, uno por cada `bays[i]`, con un piloto del color del estado;
  - entrega («Listo» sin elevador), junto a la salida.
  - Los rótulos del suelo (números, ESPERA, ENTREGA, ENTRADA) van en un único atlas de textura.
  - El fondo es gris claro con un tinte azul pastel, y en oscuro, la cabina apagada. Ambos salen de los tokens de `env.ts`.
- **Movimiento con GSAP.** Cada coche tiene una plaza estable: un coche no se mueve porque otro se vaya (`assignSpots` conserva las plazas).
  - Cuando cambia su plaza, una línea de tiempo baja el elevador si estaba subido, sale marcha atrás girando hacia el destino y recorre una `CatmullRomCurve3` centrípeta por la calzada (`power2.inOut`, unos 8 m/s, entre 1 y 3 s). El coche va orientado a la tangente y entra de morro. Al final sube el elevador a la altura del estado.
  - Si solo cambia el estado dentro del mismo elevador, solo cambia la altura.
  - Al montarse la escena, los coches entran desde la entrada escalonados (0,14 s entre uno y otro). La entrada espera a `renderer.compileAsync`: si no, en equipos lentos transcurría mientras el hilo estaba bloqueado compilando shaders.
  - Cada coche crea sus animaciones dentro de un `gsap.context` que se cierra con `kill()` al cambiar de destino o al desmontarse.
  - No hay `requestAnimationFrame` propio: cada paso de la animación llama a `invalidate()`.
  - Con `prefers-reduced-motion` no hay trayectos, entrada ni vuelos de cámara: todo va directo a la posición final.
- **Coche de arcilla** (`workshop/clayCar.ts`). Está hecho de bloques redondeados por carrocería (las 9), con el habitáculo extruido con bisel, ruedas con tapacubos, parachoques y pilotos.
  - Son tres geometrías memorizadas por carrocería (pintura, lunas y detalles con color por vértice), compartidas por todos los coches.
  - Los materiales se comparten por color.
- **Accesibilidad.** Hay un botón HTML por elevador (`BayLabel`) y otro por coche aparcado (`CarLabel`, que dice si está «En espera» o en la «Zona de entrega»). Todos tienen `aria-pressed` y un `aria-label` completo con la orden, el vehículo, la matrícula, el estado y si va con retraso.
  - Los rótulos de los coches siguen al coche mientras se mueve.
  - El lienzo tiene `role="img"` y un `aria-label` resumen (elevadores ocupados y libres, en espera y listas).
  - El respaldo 2D (`Workshop2D`) separa ahora «En espera» de «Listas para entregar», refleja `selectedOrderId` y muestra todas las órdenes (antes, 8).

### Contrato (`types.ts`)

`WorkshopSceneProps` mantiene `bays`, `waiting`, `selectedBay`, `onSelectBay`, `onSelectOrder` y `className`, y añade:

- `selectedOrderId?: number | null`: la cámara enfoca su coche. Tiene prioridad sobre `selectedBay`.
- `focusInset?: { right?: number; top?: number; bottom?: number }`: px tapados por paneles. El encuadre, los rótulos, la leyenda y el botón se ajustan a la parte libre.

`onSelectBay(null)` significa «deseleccionar». No hay más cambios. `WorkshopFloorPage.tsx` (frontend-react) ya pasa los dos props nuevos: lo he comprobado en el código y en las capturas.

### Otros cambios

- `overlay.tsx`: el anclaje admite `track` (seguir un objeto que se mueve, y ocultar el rótulo si el objeto está oculto) y el proyector admite `inset`. Sin `inset`, el comportamiento es el de antes (lo usa también la ficha del vehículo).
- `package.json` y el lock: `gsap@^3.15.1`. Justificación:
  - Lo pidió Alberto expresamente.
  - Pesa unos 72 kB minificado (unos 28 kB gzip) y vive **solo** en el chunk diferido `WorkshopCanvas`; he comprobado que no aparece en ningún otro chunk.
  - Sin él habría que escribir a mano la línea de tiempo con retardos, el escalonado y los eases.

## Archivos

- Nuevos:
  - `frontend/src/three/scenes/workshop/layout.ts`
  - `frontend/src/three/scenes/workshop/layout.test.ts` (8 tests)
  - `frontend/src/three/scenes/workshop/clayCar.ts`
  - `frontend/src/three/scenes/workshop/diorama.ts`
  - `frontend/src/three/scenes/workshop/labels.tsx`
- Modificados:
  - `frontend/src/three/scenes/WorkshopCanvas.tsx` (reescrito)
  - `frontend/src/three/scenes/fit.ts` (+`fitOrtho`)
  - `frontend/src/three/scenes/overlay.tsx`
  - `frontend/src/three/types.ts`
  - `frontend/src/three/fallbacks.tsx`
  - `frontend/package.json` y `frontend/package-lock.json`
- Capturas: [2026-11-10-taller-isometrico-capturas/](2026-11-10-taller-isometrico-capturas/) (12 PNG).

No he editado nada fuera de `frontend/src/three/`, salvo `package.json`/lock y este informe.

## Evidencias

Comprobaciones desde `frontend/`, en el estado final (11/11):

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0: 0 errores y 74 avisos, ninguno en los archivos que he tocado (los de `HeroCanvas`, `CarModel` y similares ya estaban) |
| `npm run test` | 19 archivos y **154 tests OK** (incluye los 8 nuevos de `layout.test.ts`) |
| `npm run build` | exit 0 |

Tamaños del build:

| Chunk | Tamaño | gzip |
|---|---|---|
| `three` | 1.005,32 kB | 271,34 kB (sin cambios) |
| `WorkshopCanvas` | 105,68 kB | 40,88 kB (incluye gsap) |
| `visor3d` | 22,46 kB | — |
| `index` | 339,47 kB | — |

**Instancia aislada** (API :8040, web :5195, MariaDB `carcare` con la demo, cuenta `taller@carcare.test`), con Playwright y Chromium usando WebGL por software (`--use-angle=swiftshader`):

- **1280 px, claro** (`main-*`): vista general, entrada en marcha y foco en un coche al hacer clic sobre la carrocería por raycasting (URL `?orden=22`). Escape vuelve a la URL limpia y Enter sobre el rótulo del elevador 2 da `?elevador=2`.
- **Oscuro** (`dark-*`): el mismo recorrido. He aclarado un poco la losa tras la primera captura.
- **360 px** (`mobile-2-general`): la maqueta cabe con rótulos compactos. El clic en un coche da `?orden=30` y la página abre su hoja.
- **Movimiento reducido** (`reduced-*`): 4 fotogramas en total, sin entrada ni vuelo, y foco directo.
- **Cambio real de estado:**
  - Por la API (`POST /work-orders/24/status {ready, bay:null}`): el coche bajó del elevador 4 y fue a la zona de entrega.
  - Por la interfaz de la página («Subir al 4» sobre OT‑2026‑0020): el coche fue de la espera al elevador 4 y se elevó a la altura de «Esperando piezas». Ver `ui-4-en-marcha` y `ui-final`.
- **Interacción** (`interact-*`):
  - Cursor `pointer` sobre un coche y `grab` en el vacío.
  - Un arrastre desplaza la vista sin seleccionar nada. La rueda acerca.
  - «Ver toda la nave» aparece tras mover la vista y desaparece al volver.
  - Un clic en la calzada vacía deselecciona.
  - `?sin3d` muestra el respaldo 2D con 13 botones.
- **Medición** (gancho solo de desarrollo `window.__workshop3d`, `renderer.info`):
  - Fotograma normal: **60 draw calls, 59,7 k triángulos**, 7 programas, 28 geometrías y 5 texturas.
  - Fotograma que recalcula sombras: 101 draw calls antes de quitar la sombra de los detalles; con el cambio debería bajar a unos 88, pero no lo he vuelto a medir.
  - En reposo: **0 fotogramas** (`frameloop="demand"`; el mapa de sombras solo se recalcula cuando algo se mueve).
  - En swiftshader (CPU, orientativo, no representa una GPU): unos 90 ms por fotograma sin la pasada de sombras y unos 224 ms con ella, es decir, de 4 a 11 fps durante los trayectos. En una GPU real no lo he medido.
- **Datos de la demo:** las pruebas cambiaron OT‑2026‑0020 y OT‑2026‑0022. Las he devuelto por la API a «Esperando piezas» sin elevador, como estaban. Quedan sus entradas en la actividad.
- **MariaDB:** estaba parada (el equipo se reinició durante la pausa). La arranqué con `C:\xampp\mysql_start.bat` y la dejo encendida. La instancia aislada (:8040 y :5195) está apagada.

## Limitaciones

- **Sin GPU real.** Los FPS medidos son de swiftshader. Queda pendiente medir en el equipo de Alberto (por ejemplo, con `__workshop3d.info` en `npm run dev`).
- **Rótulos en la vista general.** Con muchos coches en la espera, los rótulos tapan parte de los coches. Se pueden pulsar igual (hacen lo mismo que el coche) y, al acercarse, se separan.
- **Cámara durante los trayectos.** Al elegir un coche que se va a mover, la cámara enfoca su destino, no lo sigue durante el trayecto.
- **Coches que salen de la escena.** Si una orden se entrega o se cancela, su coche desaparece sin animación de salida. Es a propósito: si la lista de órdenes falla o está vacía, no se puede distinguir una entrega real.
- **Plazas limitadas.** El número de plazas depende del número de elevadores: con 4 elevadores, 6 de espera y 3 de entrega. Las que no caben se cuentan en la leyenda («se ven 6 de 7»).
- **Con más de 8 elevadores** la nave se alarga en una sola fila (hasta 12). Funciona, pero no lo he capturado.
- **Paneo en el móvil.** Con `touch-action: none`, arrastrar con un dedo sobre la escena desplaza la maqueta, no la página.
- **Sin animaciones de GSAP pausadas fuera de vista.** El lienzo deja de pintar (`frameloop="never"`) cuando no se ve, pero las líneas de tiempo, de pocos segundos, terminan en segundo plano.

## Siguiente paso propuesto

1. Medir FPS y draw calls en una GPU real.
2. Decidir con Alberto si quiere que la cámara siga al coche durante el trayecto.
3. Valorar ocultar los rótulos de los coches por debajo de cierto zoom y dejar la tabla de la página como alternativa accesible.
4. Añadir una prueba E2E del clic en un coche cuando exista `frontend/e2e`.
