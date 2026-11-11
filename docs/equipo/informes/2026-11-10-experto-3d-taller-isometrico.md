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

---

## 11/11 · Entrada sin choques, carrocerías reales de arcilla y `GarageScene`

Pedido de Alberto tras ver la maqueta: «me gustaba, más el de antes; me gusta cómo entran los coches pero se acaban juntando; quiero que sea como un juego toda la página, en todos los usuarios». Zona: `frontend/src/three/` (más este informe y el tablero). Sin commits.

### 1. Choques en la entrada: arreglados con un planificador y con tests

**Causa.** Antes cada coche arrancaba con un retardo fijo por índice (0,14 s) y todos iban por el mismo carril: con coches de 4-5 m y trayectos de 20 m se solapaban. Además, las plazas eran demasiado estrechas para girar y la entrada al elevador acababa con el morro ya entre las columnas.

**Qué se hizo.**
- `scenes/workshop/motion.ts` (puro, sin WebGL): trayectorias, `poseAt`, planificador `planTraffic` y análisis `analyzePlans`.
  - Cada coche sale en la primera hora en la que su trayecto completo, **simulado con el mismo `poseAt` que se ve en pantalla**, no choca con nada: coches parados o en marcha, columnas de los elevadores y pilares del pórtico. El retardo sale de la simulación, no del índice del coche.
  - Orden de salida (cola FIFO): primero los que dejan una plaza que otro necesita; después los que ya estaban; por último los que entran. Entre iguales, el de ruta más corta primero («el que llega antes al destino sale antes»).
  - Reglas que se garantizan en cada instante (muestreo cada 0,05 s): R1 caja contra caja a ≥ 0,30 m; R2 coche contra obstáculo fijo a ≥ 0,12 m; R3 dos coches en marcha en el mismo sentido y carril, a una distancia entre centros ≥ la longitud del mayor (+0,2 m).
  - Los easings son los de GSAP (`power2.inOut`, `power1.inOut`, `power2.out`) y las curvas, `CatmullRomCurve3` centrípetas con los tramos largos subdivididos. La animación sigue como antes: los coches entran por el pórtico, recorren la calzada orientados a la tangente y giran con un arco hasta su plaza.
- `workshop/traffic.ts`: controlador con **un único tween de GSAP** (`ease: 'none'`) que avanza un reloj; en cada paso evalúa `poseAt`. Se limpia con `gsap.context`.
  - Los cambios que llegan con coches en marcha se **encolan** y se planifican desde el reposo al terminar (no se replanifica a medio trayecto).
  - Con movimiento reducido o antes de compilar los shaders (`compileAsync`): posición final directa.
  - Corregido un fallo que encontré al medir en el navegador: `ctx.revert()` pinta el tween una vez en t = 0 y devolvía todos los coches a la entrada; ahora se vacían los planes antes de revertir.
- Geometría (`workshop/layout.ts`): calzada de **dos carriles** (N para los elevadores, S para espera y entrega) y cada coche aparece ya en el carril de su destino. Plazas de 3,3 × 5,8 m. Giro de entrada con arco de radio fijo (3,4 m; 2,6 m para elevadores) que termina alineado. Hueco de 1,5 m entre la boca de los elevadores y la calzada, y de 0,9 m hacia las plazas. Pórtico adelantado a la explanada, fuera de la zona de giro. La nave es algo más grande (≈ 36 × 21 m).

**Tests** (`workshop/layout.test.ts`, 22 tests, y `garage/layout.test.ts`, 10):
- Cajas de coches parados en cada destino, con 4, 8 y 12 coches (4 elevadores) y con 8 y 12 elevadores llenos, hasta 20 coches: ninguna se solapa (distancia > 0,6 m) ni toca una columna (> 0,2 m). Con el coche más grande en todas las plazas, > 0,4 m.
- Simulación sin WebGL de la entrada inicial de 4, 8 y 12 coches (carrocerías repartidas entre las 9): distancia mínima entre cajas ≥ 0,24 m en todas las muestras (a 0,02 s) y ≥ 1 longitud entre coches en marcha en el mismo sentido y carril. Todos llegan a su plaza, alineados.
- Reubicaciones reales: elevador → entrega, espera → elevador (que espera a que se libere) y solo cambio de altura, con el resto parado; y **cada coche a cada plaza libre** con las 9 carrocerías.
- Medido con el planificador (4 elevadores): 4 coches acaban en 7,5 s; 8, en 8,8 s; 12, en 10,2 s. Con 8 elevadores, 20 coches en 14,3 s; con 12 elevadores, 20 coches en 17,1 s. La planificación tarda entre 4 y 230 ms.
- Medido **en el navegador** (taller con 12 coches, swiftshader): distancia mínima real entre cajas durante toda la entrada, 0,445 m. Es orientativo: con la máquina cargada se muestrea poco; la garantía es la simulación.

**Limitación.** Entrar 12 coches en cola dura unos 10 s (~0,8 s de separación). Es el precio de que no se toquen. Si se quiere más rápido: subir la velocidad media (`driveDuration`) o repartir las entradas.

### 2. «El de antes»: carrocerías reales con acabado mate de arcilla

- Interpretación: Alberto prefería los coches del taller anterior, las carrocerías reales de `getCarBuild` (ventanas, ruedas, faros), frente a los bloques de arcilla. Los coches de la maqueta usan ahora `resolveBody` + el color real (`clayColor`: algo menos saturado y sin negros ni blancos puros; sin color, azul, amarillo, blanco o rojo fijo por id).
- Coste: el nivel `'low'` de `getCarBuild` ya tenía unos 50 000 triángulos por coche. Añadí un nivel **`'clay'`** (`car/geometry.ts`, `car/build.ts`): malla gruesa, una de cada tres muestras del perfil, ruedas cilíndricas, sin interior ni bajos, sin discos ni pinzas. Quedan **9-10 mil triángulos por coche** con la misma silueta. Los otros niveles no cambian.
- `workshop/clayReal.ts`: cada carrocería se fusiona en **2 mallas** compartidas por todos los coches iguales: pintura (material `clayPaint(color)`, uno por color, roughness 0,7, metalness 0,1, sin reflejos) y resto (lunas, neumáticos, llantas, parachoques, faros y pilotos, con el color en los vértices, mismo acabado mate). Geometría centrada, morro a +z, ruedas en y = 0.
- Medido con `renderer.info` (taller de la demo, 12 coches, 1280 px): **48 draw calls** en un fotograma normal y 77 en el que recalcula sombras, con ambos estilos. Triángulos: **126,7 k** (reales) frente a **59,7 k** (bloques) en un fotograma normal; **252 k** frente a 118 k con la pasada de sombras. Los draw calls bajan respecto a la maqueta del 10/11 (60) porque ahora son 2 mallas por coche, no 3.
- Criterio visual: con las carrocerías reales el coche se lee mejor (parabrisas, ruedas con llanta, retrovisores, pickup con caja abierta), es más «el de antes» y la maqueta no parece de juguete. Los bloques son más limpios de lejos, pero todos parecen el mismo coche. Mi criterio es quedarse con las reales. Para comparar, en desarrollo se puede añadir `?coches=bloques` a la URL del taller (no existe en producción): capturas `desktop-1-general` y `desktop-2-coche` (reales) frente a `desktop-b-1-general` y `desktop-b-2-coche` (bloques), en la carpeta de capturas.

### 3. `GarageScene` (garaje isométrico para particulares)

Chunk diferido `scenes/GarageDioramaCanvas.tsx` (12,5 kB; gsap y la cámara y luz comunes están en `IsoParts`, 92 kB, que comparten el taller y el garaje; ninguno de los dos entra en el arranque: `index.html` no los precarga). Exportado desde `@/three` como `GarageScene`, con el mismo patrón que `WorkshopScene`: se monta al hacerse visible, un solo `<Canvas>`, `ThreeBoundary` y respaldo 2D (`Garage2D` en `fallbacks.tsx`: una tarjeta con silueta por vehículo y los mismos botones) si no hay WebGL, falla o mientras carga.

**Contrato final** (`three/types.ts`):

```ts
export interface GarageVehicle {
  id: number
  name: string              // display_name del vehículo
  plate?: string | null     // plate
  color?: string | null     // color_hex  (sin color: azul, amarillo, blanco o rojo de maqueta, fijo por id)
  body?: BodyType | null    // body_type  (sin carrocería: 'hatchback')
}
export interface GarageSceneProps {
  vehicles: GarageVehicle[]                     // una plaza por vehículo; máx. 6 visibles (leyenda «Se ven 6 de N»)
  selectedId?: number | null                    // enfoca su coche y lo sube a la plataforma giratoria
  onSelect?: (id: number | null) => void        // clic en coche o rótulo; null = deseleccionar
  focusInset?: { right?: number; top?: number; bottom?: number }   // px tapados por paneles
  compact?: boolean                             // cabecera ~260 px
  className?: string
}
```

Mapeo directo desde `Vehicle`: `{ id, name: display_name, plate, color: color_hex, body: body_type }`.

- Diorama: nave con suelo claro, muro del fondo con ventanas, calzada y pórtico de entrada a la derecha, una plaza numerada por vehículo (el coche de morro hacia el espectador) y atrezo. Mismo encuadre isométrico, luz de estudio, materiales de arcilla y paleta (claro y oscuro) que el taller; fondo = `--base`.
- Plazas estables por id (ancladas a la izquierda: añadir un vehículo añade una plaza a la derecha sin mover a los demás). Entrada animada con el **mismo sistema sin choques**, con GSAP.
- Selección: GSAP mueve la cámara (0,8 s) y el coche sube 0,14 m sobre una **plataforma giratoria** (0,35 rad/s). Al soltar, vuelve al giro más cercano a 0 y baja. Con movimiento reducido: sube y baja sin girar, y sin vuelos. Escape, clic en el vacío o «Ver todo el garaje» deseleccionan.
- Accesibilidad: un botón HTML por vehículo (`aria-label` «Plaza N: nombre (matrícula)», `aria-pressed`), `useCanvasLabel` con el resumen y el seleccionado, foco visible.
- `compact`: se ve la fila de plazas y la calzada, sin paneo, zoom ni vuelos (el lienzo deja pasar el desplazamiento vertical), rótulos cortos y sin leyenda.
- Rendimiento (swiftshader, fotograma normal): 1 vehículo, 12 draw calls y 28 k triángulos; 4 vehículos, 16 y 42 k; 6 vehículos, 37 y 121 k.
- En reposo no pinta fotogramas; mientras gira la plataforma, un fotograma por vez.
- Tests (`garage/layout.test.ts`): una plaza por vehículo, plazas estables, que un coche girando sobre su plataforma no toque a los vecinos (en las 6 plazas), y la misma simulación sin choques de entrada para 1 a 6 coches con las 9 carrocerías.

### 4. Petición 29: tokens del mundo «Diorama»

`three/env.ts`: el `FALLBACK` de `ThemeTokens` pasa a los valores del tema claro de «Diorama» (`--base #e9f0fa`, `--surface #fff`, `--accent #2559e8`…). El fondo de las dos maquetas es **`--base` tal cual** (antes lo mezclaba con un azul), así que la escena se funde con la página en claro y oscuro.

### Archivos (11/11)

Nuevos: `scenes/workshop/{motion,traffic,iso,IsoParts,clayReal}.ts(x)`, `scenes/GarageDioramaCanvas.tsx`, `scenes/garage/{layout,diorama,labels}.ts(x)`, `scenes/garage/layout.test.ts`.
Modificados: `scenes/WorkshopCanvas.tsx` (rehecho sobre las piezas comunes), `scenes/workshop/{layout,layout.test,diorama,clayCar}.ts`, `car/{geometry,build}.ts` (nivel `'clay'`), `fallbacks.tsx` (`Garage2D`), `index.tsx` (`GarageScene`), `types.ts`, `env.ts`.
Capturas: [2026-11-11-taller-garaje-capturas/](2026-11-11-taller-garaje-capturas/) (12 PNG). Para probar el garaje usé una página suelta (`garage-lab.html` y `src/three/lab-tmp/`), ya **borrada**: no está versionada ni registrada en el router.
No he tocado nada fuera de `frontend/src/three/`, salvo este informe y el tablero.

### Evidencias (desde `frontend/`, 11/11)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, 0 errores y 75 avisos; 1 nuevo mío (`GarageDioramaCanvas.tsx:109`, `preserve-manual-memoization`: el compilador de React no optimiza ese componente; no afecta al funcionamiento) |
| `npm run test` | 22 archivos y **188 tests OK** (32 de maquetas y tráfico; el guardián de importaciones ligeras de `@/three` sigue pasando con `GarageScene`) |
| `npm run build` | exit 0. `three` 1.005 kB (271 kB gzip, sin cambios); `IsoParts` (gsap, cámara y luz) 92,6 kB; `WorkshopCanvas` 15,0 kB; `GarageDioramaCanvas` 12,5 kB. Ninguno se precarga en `index.html` |

Pruebas en navegador (Chromium con swiftshader; API :8040 y web :5195, cuenta `taller@carcare.test`): taller a 1280 px (vista general, entrada en marcha, foco en un coche, foco en un elevador) y garaje con 1, 4 y 6 vehículos, tema oscuro, 360 px, movimiento reducido, cabecera compacta, clic en un rótulo (selecciona), Escape (deselecciona) y consola sin errores. Los servidores de prueba están apagados; MariaDB sigue encendida. No probé el garaje dentro de una pantalla real de la app (aún no está montado), solo en la página suelta.

### Limitaciones (11/11)

- Los FPS reales no se han medido (sin GPU): con swiftshader y la máquina cargada, el fotograma con sombras tarda cientos de ms. El coste es mayor que el de los bloques (el doble de triángulos); en una GPU normal no debería notarse, pero queda por medir en el equipo de Alberto.
- Una fila de 5-6 plazas en un alto de 260 px (`compact`) queda con coches de unos 60 px de largo, porque en isométrico una fila larga ocupa mucha altura: va mejor con pocos vehículos o con ~320 px.
- Con coches en marcha, un cambio de estado se encola hasta que terminen (hasta ~10 s tras la carga inicial).
- El estilo de bloques (`?coches=bloques`) y `clayCar.ts` quedan solo para comparar en desarrollo.
- Sin capturas con más de 8 elevadores ni con las 6 plazas del garaje ocupadas por coches grandes (sí hay tests).

### Siguiente paso

1. `frontend-react` (Inicio del particular): usar `GarageScene` según el contrato de arriba.
2. Medir FPS en GPU real; si es poco, bajar el mapa de sombras a 1024 o simplificar aún más el nivel `'clay'`.
3. Decidir con Alberto si hace falta más movimiento en el garaje (ahora solo gira la plataforma del coche seleccionado).

### Pulido de la vista del taller (11/11, tras capturas a 1440×900)

Pedido: la maqueta ocupaba ~40 % del lienzo; la leyenda tapaba coches al enfocar; los rótulos de los coches en espera se amontonaban. Las props públicas de `WorkshopCanvas` no cambian.

- **Encuadre.** Medido en la demo a 1440×900, la maqueta ocupaba unos 450×275 px del hueco libre (~790×380) y ahora ocupa unos 530×340: llena el alto libre entre las tarjetas y la tabla (la limita la altura: una nave isométrica siempre proyecta ~1,7 veces más ancha que alta). Cambios: la nave es más compacta (plazas de 3,1 m en lugar de 3,3; explanada de 4,6 m en lugar de 5,4; menos margen delante), el encuadre reserva solo lo que sobresalen los rótulos arriba (10 px) y un respiro abajo (4 px), y se miden los bordes de la losa y el extremo de la explanada, de modo que no se recortan elevadores ni calzada de entrada. A 768 y 390 px la maqueta ocupa todo el ancho libre (capturas `pulido-768-general` y `pulido-390-general`).
- **Foco.** Al enfocar un coche, el zoom queda entre 1,3× y 2,6× el de la vista general (antes podía quedar más lejos que la general cuando el hueco libre era pequeño, como con la hoja de detalle a 768 px). Lo mismo en `GarageScene`.
- **Leyenda.** Ya no es una franja sobre el lienzo: es un chip «Leyenda» plegable (`aria-expanded`) en la esquina inferior izquierda, que es una esquina vacía de la maqueta isométrica, y despliega los estados, las plazas ocultas y cómo moverse. «Ver toda la nave» pasa a la esquina inferior derecha. Cerrada, no pisa ningún coche.
- **Rótulos de coches.** En la vista general (cuando los elevadores quedan a menos de ~105 px) los coches en espera y en entrega son un punto con el color del estado y un anillo rojo si van con retraso; el número sale al pasar el puntero o con el teclado y al seleccionarlos (pasan a píldora). El texto accesible sigue siendo el completo. Los elevadores mantienen su rótulo (E1…E4). Al acercarse, vuelven las píldoras con el número.
- **Entrada sin choques y tests.** Con la nave más compacta, los 34 tests de maquetas siguen pasando (parados con 4, 8 y 12 coches, simulación de entrada, reubicaciones y cada coche a cada plaza). En el navegador, distancia mínima real entre cajas durante la entrada: 0,445 m.
- **Verificación** (desde `frontend/`): `npm run typecheck` sin errores; `npm run lint` 0 errores y 75 avisos (el mismo aviso mío de `GarageDioramaCanvas.tsx`); `npm run test` 22 archivos y 188 tests OK; `npm run build` OK (`WorkshopCanvas` 16,6 kB, `IsoParts` 92,6 kB, `three` sin cambios). Capturas reales con swiftshader en la carpeta de capturas: `pulido-antes-1440-general` y `pulido-1440-general` (antes y después), `pulido-1440-coche`, `pulido-768-general`, `pulido-768-coche` y `pulido-390-general`.
- **Sin probar:** los FPS en GPU real y la leyenda desplegada con un lector de pantalla. A 390 px, al elegir un coche la página desplaza hasta su ficha (apilada bajo la maqueta), así que no hay captura del foco a ese ancho.
