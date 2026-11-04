# Informe · frontend-react · Portada atractiva (tarea 36)

| Campo | Valor |
|-------|-------|
| Petición de Alberto (literal, 29/10) | "la página principal ha empeorado un poquito, dale un diseño bacano y bueno como el que diste antes y mejóralo" |
| Encargo | Piloto automático, 03/11/2026 01:45 (la sesión del 29/10 no llegó a empezar: `LandingPage.tsx` no cambiaba desde el 27/10). Siguió el 03/11 10:14 y lo cerró el 04/11 10:00 (las dos primeras ejecuciones se cortaron) |
| Estado | **Hecho (04/11)**. Los 5 criterios en verde: "Saltar al contenido" arreglado (y el foco tapado con Shift+Tab que salió al repasarlo), comprobación a 360/768/1280 en oscuro y claro con 105 OK y 0 FALLOS, mediciones de antes y después, typecheck/lint/test/build en verde. Queda una limitación medida (el arranque del 3D bloquea ~1,4 s el hilo principal en escritorio) con petición a experto-3d |
| Instancia aislada | API :8060 (SQLite `carcare-sqlite/demo-8060.sqlite`) · builds de antes/después servidas con `vite preview` en :5185/:5186 · web de desarrollo :5184 (solo para el diagnóstico). Todo parado al terminar |

## Objetivo

Recuperar el coche 3D en el héroe (como la primera portada, a3c417c) sin perder la primera pintura rápida: imagen fija
primero y escena 3D en reposo, contenido siempre visible, secciones con capturas reales de la app (particular, taller y
solicitudes a talleres de E16) y un diseño más rico dentro de la dirección visual actual.

## Qué se hizo

**Héroe con el coche 3D (`HeroVisual.tsx`, `hero.ts`)**
- En escritorio (≥ 1024 px con ratón o trackpad) el héroe ocupa dos pantallas: a la izquierda el titular y, al bajar,
  "El coche, por zonas"; a la derecha un escenario fijo (`sticky`) con el coche. Primero se pinta `HeroImage` (la
  imagen fija de `@/three`: es el LCP y no descarga three.js) y, cuando esa imagen ha cargado, el hilo principal está en
  reposo (`requestIdleCallback`, 3 s como mucho) y la pestaña se ve, se monta `HeroScene` encima con un fundido de
  300 ms. La escena sigue el scroll de la sección (cámara, rayos X y puntos de zona de ejemplo).
- WebGL se comprueba después de la primera pintura (`useAfterFirstPaint`): crear el contexto de prueba puede bloquear
  el hilo si la GPU está ocupada (la ejecución del 03/11 vio más de 1 s, pero esa medición no quedó guardada; he
  corregido el comentario de `hero.ts`, que decía que estaba en este informe).
- En móvil, tableta, con `prefers-reduced-motion: reduce` o con ahorro de datos (`navigator.connection`) se queda la
  imagen y "Ver en 3D" carga la escena a petición. Sin WebGL, solo la imagen y sin botón. Si la escena no aparece en
  20 s (chunk caído, error de WebGL), lo dice en un `aria-live` y se queda la imagen.
- "Detener animación" (WCAG 2.2.2) quita la escena y se recuerda en `localStorage` (`carcare.landing3d = 'off'`,
  clave nueva en `src/lib/storage.ts`); "Ver en 3D" la borra. El foco se queda en el botón al cambiar de estado.
- La escena es decorativa (`aria-hidden`): lo que cuenta está en el texto. El pie dice "Modelo genérico, sin marca." y
  la sección de zonas aclara que los colores de la ilustración son de ejemplo y que el estado es "según tus
  intervalos, no medido" (regla 2).

**Secciones con capturas reales (`Screenshot.tsx`, `shots.ts`, `public/img/portada/`)**
- Particular (ficha con zonas y pestaña de gastos), Taller (tablero de órdenes y taller 3D) y "Pide presupuesto a un
  taller sin salir de CarCare" (E16) en tres pasos: directorio, solicitud recibida por el taller y presupuesto visto
  por el particular.
- 7 capturas de la app con las cuentas demo (datos ficticios, se dice en cada sección), en WebP de 1200 y 640 px (14
  ficheros, 456 KB en total), con `srcset`/`sizes`, `loading="lazy"`, ancho y alto fijos (sin saltos de maquetación) y
  un texto alternativo que describe lo que se ve.
- Después, "Cómo trata tus datos" (seis principios, también el de compartir el historial con un taller) y el registro.
  Todo el texto está en el HTML desde el principio: nada aparece al hacer scroll.

**Arreglos del 04/11**
- "Saltar al contenido": nuevo `src/components/layout/SkipLink.tsx`, usado en la portada y en `AppShell` (tenía el
  mismo fallo). Antes era `sr-only focus:not-sr-only focus:fixed`, y `not-sr-only` pone `padding: 0` al recibir el foco
  (en el CSS de la build: `.focus\:not-sr-only:focus{…padding:0;position:static…}`): el enlace salía apretado, 130×20 px,
  encima del logo. Ahora está fijo y fuera de la pantalla hasta recibir el foco; entonces baja en 150 ms (sin
  movimiento con `prefers-reduced-motion`) con su relleno: 162×36 px.
- Foco tapado por la cabecera fija al volver con Shift+Tab (WCAG 2.4.11). Lo encontró el recorrido hacia atrás que
  añadí a la comprobación: a 768 y 360 px, "Ver capturas" y "Crear cuenta" quedaban debajo de la cabecera, tapados del
  todo. Arreglo: `scroll-padding-top: 4.5rem` en `html` solo mientras está la portada (`:root:has([data-portada])` en
  `index.css`) y `-scroll-mt-2` en las secciones (antes `scroll-mt-16`) para que las anclas sigan llegando justo bajo la
  cabecera.

## El FALLO de "Saltar al contenido" del 03/11

`comprobar-1.txt` (03/11 10:52) decía `obscured: true` para "Saltar al contenido" a 1280, 768 y 360. No se reproduce:
con la misma build (`dist-despues`, 10:49) y el mismo script, `elementFromPoint` en el centro del enlace devuelve el
propio enlace (3 ejecuciones, a 768 y 1280). En aquella ejecución devolvió `null` (por eso no sale el campo `over`) y no
he podido saber por qué. Lo trato como falso positivo del script, pero el enlace sí tenía el fallo del relleno (arriba),
y el script nuevo mira 5 puntos de cada parada (centro y esquinas) y dice qué hay encima de cada uno.

## Capturas diferidas con el 3D montado (falso fallo de la comprobación)

En la primera comprobación del 04/11, a 1280 en oscuro, las 3 capturas de "Pide presupuesto" no habían cargado 1,5 s
después de bajar hasta ellas. Medido aparte (`lazy.cjs`, `lazy2.cjs`, 1280×800, build final):

| Cómo se baja hasta las capturas | 3D montado | Se piden | Cargadas |
|---------------------------------|------------|----------|----------|
| `locator.scrollIntoViewIfNeeded()` de Playwright (CDP), una tras otra | sí | sin `currentSrc` hasta pasados 6 s, con las imágenes ya dentro de la ventana | entre los 6 y los 10 s (3 de 3 cargas) |
| Lo mismo | no | — | antes de 0,5 s |
| `element.scrollIntoView()` (como un ancla) | sí | a los 18 ms | a los 54 ms |
| Rueda del ratón | sí | a los 160 ms | a los 206 ms |
| Teclado (PageDown ×6) | sí | a los 157 ms | a los 186 ms |

Es el método de desplazamiento del script, no la portada: la comprobación final baja con `element.scrollIntoView` y
espera a cada imagen (5 s como mucho).

## Evidencias

### Comandos (desde `frontend/`, código final del 04/11)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | `tsc -b` sin errores (código de salida 0) |
| `npm run lint` | `oxlint src`: 0 errores y 74 avisos, los mismos 74 que ya había (informes de E16); ninguno en `features/landing/`, `SkipLink.tsx` ni `AppShell.tsx` |
| `npm run test` | Vitest: 14 ficheros, 117 tests, todos pasan (2,4 s) |
| `npm run build` | OK en 3,09 s; repetido al final (tras corregir un comentario de `hero.ts`) en 1,56 s con los mismos ficheros que la build comprobada y medida (`LandingPage-DC6vZVyz.js`, `index-U952dBMt.js`). Chunks de la portada: `LandingPage` 24,11 KB (8,33 KB gzip), `index` 190,20 KB (58,86 KB gzip), CSS 84,39 KB (15,96 KB gzip). `three` 1.001,56 KB (270,38 KB gzip) va aparte y solo se pide cuando se monta el 3D; el aviso de "chunk > 500 KB" es ese chunk y ya salía antes |

### Comprobación por ancho y tema (`comprobacion-2026-11-04.txt`: 105 OK, 0 FALLOS)

Script `comprobar-portada.cjs` (copiado junto a las capturas) con Playwright y Chromium sin cabeza (GPU real por
D3D11) contra la build final servida con `vite preview` en :5186 y la API en :8060. Registro completo:
[`2026-11-03-portada-capturas/comprobacion-2026-11-04.txt`](2026-11-03-portada-capturas/comprobacion-2026-11-04.txt).

| Comprobación | 1280 oscuro | 768 oscuro | 360 oscuro | 1280 claro | 768 claro | 360 claro |
|--------------|-------------|------------|------------|------------|-----------|-----------|
| Sin desbordes horizontales | OK | OK | OK | OK | OK | OK |
| Todo el texto visible desde el principio (98 bloques) | OK | OK | OK | OK | OK | OK |
| 3D al cargar | se monta solo, con "Detener animación" | no (ni three.js); "Ver en 3D" | no; "Ver en 3D" | se monta solo | no; "Ver en 3D" | no; "Ver en 3D" |
| 7 capturas cargan, con texto alternativo | OK | OK | OK | OK | OK | OK |
| Tab: paradas, foco visible y sin tapar (5 puntos) | 13 OK | 13 OK | 9 OK | 13 OK | 13 OK | 9 OK |
| Shift+Tab desde el final, sin tapar | 13 OK | 13 OK | 9 OK | 13 OK | 13 OK | 9 OK |
| "Saltar al contenido": oculto sin foco; 162×36 con foco; Enter ⇒ foco en `<main>` | OK | OK | OK | OK | OK | OK |
| "Ver capturas" (Enter) ⇒ título bajo la cabecera | OK | OK | OK | OK | OK | OK |
| Pie "Modelo genérico, sin marca." (12 px) | 8,28:1 | 8,28:1 | 8,28:1 | 6,49:1 | 6,49:1 | 6,49:1 |
| "Ver en 3D" (Enter) descarga la escena y el foco sigue en el botón | — | OK | OK | — | — | — |
| "Detener animación" (Enter) la quita, guarda `off` y el foco sigue | OK | OK | OK | OK | — | — |
| axe (WCAG 2.0/2.1/2.2 A y AA) | 24 pasan, 0 | 24, 0 | 24, 0 | 24, 0 | 24, 0 | 24, 0 |
| Cambio de tema con el teclado | OK | — | — | OK | — | — |
| Consola sin errores | OK | OK | OK | OK | OK | OK |

Además: con `carcare.landing3d = 'off'` guardado no se monta solo ni se pide three.js, y "Ver en 3D" lo vuelve a montar
y borra la preferencia · con `prefers-reduced-motion: reduce` a 1280 (oscuro y claro), a los 8 s sigue la imagen fija y
no se ha pedido three.js; el recorrido con Tab y Shift+Tab pasa igual y "Ver en 3D" (Enter) sí lo monta; axe en claro
24/0 · con los chunks del 3D bloqueados, el texto y la imagen siguen visibles y a los 20 s dice "No se ha podido cargar
el 3D; se queda la imagen." (los únicos errores de consola son los del chunk bloqueado a propósito) · sin WebGL
(`?sin3d`), solo la imagen, sin botón y sin three.js.

**"color-contrast (1) por revisar" de axe a 768**: es el pie "Modelo genérico, sin marca." (`p.px-2`); axe no sabe qué
fondo tiene ("overlapped by another element"). Revisado a mano: `document.elementsFromPoint` en su centro devuelve el
propio párrafo (nada lo tapa) y el párrafo tiene fondo opaco propio (`bg-canvas`). Contraste calculado con los colores
calculados del navegador: 8,28:1 en oscuro (`#a5b0b5` sobre `#111518`) y 6,49:1 en claro (`#4f5a60` sobre `#f6f5f1`);
AA pide 4,5:1. No es un incumplimiento.

La primera ejecución del 04/11 (`comprobar-final-1.txt`, build anterior a los arreglos del foco) dio 5 FALLOS: los 4
del foco tapado con Shift+Tab a 768 y 360 (oscuro y claro) y el de las capturas diferidas a 1280 explicado arriba. La
segunda, con la build final, 0.

### Mediciones de antes y después (04/11)

Mismo script que el 03/11 (`medir2.cjs`): Playwright con Chromium sin cabeza y GPU real (Intel UHD por D3D11), navegador
nuevo en cada carga, caché desactivada, 1 carga de calentamiento y mediana de 5; se cuenta lo descargado hasta 6 s
después de `load`. "Antes" es la build del 27/10 (`dist-antes`, :5185) y "después" la build final del 04/11 (:5186),
las dos en el mismo equipo y la misma sesión. A 768 y 360 la densidad de píxeles es 2. Datos crudos en
[`2026-11-03-portada-capturas/mediciones-2026-11-04/`](2026-11-03-portada-capturas/mediciones-2026-11-04/).

| Ventana | Portada | FCP | LCP | three.js | Lienzo 3D | Descargado en la primera carga | De eso, antes de `load` |
|---------|---------|-----|-----|----------|-----------|--------------------------------|-------------------------|
| 1280×800 | antes | 304 ms | 512 ms | no se descarga | — | 317 KB | 214 KB |
| 1280×800 | después | 248 ms | 436 ms | se pide a los 453-652 ms (486 en la mediana) | a los 793 ms | 704 KB: 283 del 3D y 114 de imágenes | 215 KB |
| 768×1024 | antes | 308 ms | 540 ms | no se descarga | — | 340 KB | 214 KB |
| 768×1024 | después | 240 ms | 440 ms | no se descarga | — | 579 KB: 272 de imágenes | 215 KB |
| 360×780, 4G lento (1,6 Mbps, 150 ms) + CPU ×4 | antes | 1.920 ms | 2.720 ms | no se descarga | — | 340 KB | 214 KB |
| 360×780, 4G lento + CPU ×4 | después | 1.928 ms | 2.812 ms | no se descarga | — | 387 KB: 80 de imágenes | 215 KB |

- El LCP es la imagen del héroe (`/img/portada-coche-1280.webp`) en las 30 cargas medidas. Lo que se descarga antes de
  `load` (lo que retrasa la primera pintura) no cambia: 214 → 215 KB.
- Las diferencias de FCP y LCP entre antes y después son ruido de la medición: en las 5 cargas de cada caso los valores
  se solapan (p. ej. a 360, LCP de 2.636 a 3.224 ms antes y de 2.720 a 3.236 ms después).
- A 768 se descargan las 7 capturas en la primera carga, después de `load`: están dentro de la distancia a la que
  Chromium adelanta las imágenes diferidas. A 360 con 4G lento solo se adelanta una.

**Hilo principal al montarse el 3D (1280, 5 cargas, primeros 8 s, `tareas-largas.cjs` y `clic-durante.cjs`)**

| Caso | Bloqueo (suma de lo que pasa de 50 ms, mediana) | Tarea más larga (mediana) |
|------|-------------------------------------------------|---------------------------|
| Antes, sin tocar nada | 0 ms | — |
| Antes, pulsando "Ver en 3D" nada más cargar | 1.977 ms | 1.320 ms |
| Después (el 3D se monta solo) | 2.340 ms | 1.413 ms |

La escena tarda lo mismo en arrancar que en la portada anterior; la diferencia es que ahora arranca sola en escritorio.
Las tareas largas caen entre ~0,9 y ~3 s después de entrar. Un clic en "Ver capturas" justo cuando aparece el lienzo
responde en 32-64 ms, pero 600 ms después tarda **728-1.976 ms** (mediana 1.248 ms; ver Limitaciones).

## Archivos tocados

Todos en la zona de frontend-react; nada en `frontend/src/three/` ni en `frontend/src/api/types.ts`.

| Archivo | Cambio |
|---------|--------|
| `frontend/src/features/landing/LandingPage.tsx` | Portada nueva (héroe en dos tiempos, secciones con capturas, pasos de E16, principios, registro); `SkipLink`; `data-portada`; `-scroll-mt-2` en las secciones |
| `frontend/src/features/landing/HeroVisual.tsx` (nuevo) | Imagen fija, escena 3D en reposo o a petición, "Ver en 3D" / "Detener animación", aviso si el 3D falla |
| `frontend/src/features/landing/hero.ts` (nuevo) | `heroMode`, `scrollProgress`, `prefersSavingData` y los hooks del héroe (sin three.js) |
| `frontend/src/features/landing/hero.test.ts` (nuevo) | 8 tests: cuándo se monta el 3D, progreso del scroll, que la portada no importa three.js y que las 14 capturas existen y pesan < 80 KB |
| `frontend/src/features/landing/Screenshot.tsx`, `shots.ts` (nuevos) | Captura con `srcset`, `lazy`, tamaño fijo y pie; manifiesto con el texto alternativo de cada una |
| `frontend/public/img/portada/*.webp` (nuevos) | 7 capturas × 2 anchos (1200 y 640 px), 456 KB en total |
| `frontend/src/lib/storage.ts` | Clave `carcare.landing3d` |
| `frontend/src/components/layout/SkipLink.tsx` (nuevo) | "Saltar al contenido" con su relleno al recibir el foco |
| `frontend/src/components/layout/AppShell.tsx` | Usa `SkipLink` (mismo fallo del relleno que la portada); nada más cambia |
| `frontend/src/index.css` | `:root:has([data-portada]) { scroll-padding-top: 4.5rem }` |
| `docs/equipo/informes/2026-11-03-portada-capturas/` | Capturas finales del 04/11 (sustituyen a las del 03/11) |

## Decisiones

- **El 3D solo se monta solo en escritorio con ratón.** En móvil y tableta son ≈ 270 KB comprimidos de three.js y la GPU
  del teléfono: ahí "Ver en 3D" es opcional. La imagen fija es la misma vista del coche, así que no se pierde contenido.
- **Imagen primero, 3D en reposo.** El LCP es siempre la imagen; three.js se pide cuando ya está pintada y el hilo está
  libre. Con `prefers-reduced-motion` no se monta solo, y si se pide, la escena no gira sola.
- **"Detener animación" se recuerda** en este navegador: quien lo para no tiene que volver a pararlo.
- **El arreglo del foco tapado va solo en la portada** (`:root:has([data-portada])`), no en `html` para toda la app: la
  app ya usa `scroll-mt-24`/`scroll-mt-32` en sus anclas y un `scroll-padding` global se les sumaría.
- **`SkipLink` compartido**: el mismo enlace en la portada y en la app, para no arreglar el relleno en dos sitios.
- Sin dependencias nuevas.

## Capturas finales (04/11, build final)

En [`2026-11-03-portada-capturas/`](2026-11-03-portada-capturas/) (sustituyen a las del 03/11, mismos nombres; las de
`768-claro`, `360-claro` y `1280-saltar` son nuevas):

| Captura | Qué se ve |
|---------|-----------|
| [`portada-1280-3d.webp`](2026-11-03-portada-capturas/portada-1280-3d.webp) | Escritorio, oscuro: titular y el coche 3D ya montado, con "Detener animación" |
| [`portada-1280-zonas.webp`](2026-11-03-portada-capturas/portada-1280-zonas.webp) | Al bajar a "El coche, por zonas": rayos X y puntos de zona de ejemplo, y la leyenda de estados con icono y texto |
| [`portada-1280-solicitudes.webp`](2026-11-03-portada-capturas/portada-1280-solicitudes.webp) | "Pide presupuesto a un taller": los tres pasos con sus capturas |
| [`portada-1280-claro.webp`](2026-11-03-portada-capturas/portada-1280-claro.webp) | Escritorio, claro, con el 3D |
| [`portada-1280-saltar.webp`](2026-11-03-portada-capturas/portada-1280-saltar.webp) | "Saltar al contenido" con el foco, ya con su relleno |
| [`portada-768-arriba.webp`](2026-11-03-portada-capturas/portada-768-arriba.webp), [`portada-768-claro.webp`](2026-11-03-portada-capturas/portada-768-claro.webp) | Tableta: imagen fija y "Ver en 3D" |
| [`portada-360-arriba.webp`](2026-11-03-portada-capturas/portada-360-arriba.webp), [`portada-360-claro.webp`](2026-11-03-portada-capturas/portada-360-claro.webp) | Móvil: imagen fija y "Ver en 3D" debajo, sin tapar el coche |
| [`portada-360-ver-en-3d.webp`](2026-11-03-portada-capturas/portada-360-ver-en-3d.webp) | Móvil tras pulsar "Ver en 3D" |
| [`portada-360-completa.webp`](2026-11-03-portada-capturas/portada-360-completa.webp) | La portada entera a 360 px |

## Limitaciones

- **El arranque de la escena 3D bloquea el hilo principal unos 1,4 s** (tarea más larga, mediana de 5 cargas en este
  equipo), entre ~0,9 y ~3 s después de entrar en escritorio. Un clic en ese momento tarda en responder entre 0,7 y 2 s.
  Pasa igual en la portada anterior al pulsar "Ver en 3D" (1,3 s); ahora pasa sin pedirlo. La primera pintura y el LCP
  no se ven afectados (son anteriores y no cambian). Lo que tarda está dentro de `HeroScene` (zona de experto-3d): ver la
  petición abajo. En móvil y tableta no pasa, porque el 3D no se monta solo.
- Medido en un solo equipo (Intel UHD integrada, Chromium sin cabeza con GPU real); con otra GPU el arranque del 3D
  puede tardar más o menos. No he probado en Safari ni Firefox, ni en un móvil de verdad (360 y 768 son emulados).
- La comprobación con lector de pantalla real (NVDA) no se ha hecho; sí la estructura (axe, etiquetas, `aria-live`,
  `aria-hidden` en la escena, texto alternativo de las capturas).
- El recorrido con Shift+Tab solo lo he comprobado en la portada. La app (`AppShell`) también tiene cabecera fija y
  podría tener el mismo problema al volver con Shift+Tab; no lo he medido (el arreglo de aquí es solo de la portada).
- "Ver en 3D" y "Detener animación" con el teclado se comprobaron en oscuro a 768 y 360 y en los dos temas a 1280; en
  claro a 768 y 360 solo se comprobó que el botón está y se alcanza con Tab.
- La API de la instancia aislada solo se usó para `/api/v1/me` (visitante sin sesión ⇒ 401, que es lo esperado). Las
  capturas de la app son del 03/11, hechas contra la API con las cuentas demo; no las he rehecho.

## Peticiones

- **A experto-3d** (no he tocado `frontend/src/three/`): que el arranque de `HeroScene` no bloquee el hilo principal
  más de ~200 ms seguidos. Medido: una tarea de 1,3-1,8 s al crear la escena del héroe en escritorio (y de 1,2-1,6 s en
  la portada anterior al pulsar "Ver en 3D", así que también afecta a `CarViewer`/`CarPreview` si comparten el
  arranque). Ideas: compilar los materiales con `renderer.compileAsync(scene, camera)` antes del primer fotograma,
  repartir la creación de la escena en varios fotogramas o precalcular el entorno (PMREM). Para medirlo:
  `tareas-largas.cjs` y `clic-durante.cjs` en `mediciones-2026-11-04/` (los resultados) y en
  `C:/Users/Alberto/AppData/Local/Temp/carcare-portada/` (los scripts).

## Siguiente paso

1. experto-3d: la petición de arriba. Cuando esté, repetir `tareas-largas.cjs` y `clic-durante.cjs` a 1280.
2. Si hiciera falta antes, en `hero.ts` se puede esperar, además del reposo, a que la persona lleve ~1,5 s sin tocar
   nada (puntero, teclado, rueda) para montar el 3D: no quita el bloqueo, pero hace menos probable que coincida con un
   clic. Lo dejo propuesto, no hecho, porque retrasa la aparición del coche y es una decisión de experiencia.
3. qa-tester: pasar el recorrido con Shift+Tab por la app (cabecera fija de `AppShell`).
