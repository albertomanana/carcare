# Informe · experto-3d · Rendimiento del 3D (tarea 20) + cierre de las oleadas 1c/1d

| Campo | Valor |
|-------|-------|
| Agente | experto-3d |
| Fecha | 2026-10-23 23:20 → 2026-10-24 (cortado dos veces por el límite de uso) |
| Encargo | Tarea 20 de `docs/equipo/AUTOPILOTO.md`, ampliada el 24/10 con la decisión 5.7 / regla R11 del [informe de UX](2026-10-23-disenador-ux-simplificacion.md): miniaturas sin three.js, imagen fija para la portada, mapa de zonas y Taller 3D optimizados, 3 avisos de lint; informe final de 1c/1d |
| Estado | En curso (este informe se va completando durante el trabajo) |

## 1. Objetivo

1. Medir antes: chunks de three/R3F, tiempo hasta "listo" (ficha, taller, portada), `renderer.info` por escena, qué pantallas descargan three.js y fugas al navegar.
2. `CarThumbnail` y los exports ligeros de `@/three` no deben arrastrar three.js (R11).
3. Imagen fija de la portada generada con el coche procedural propio (la monta frontend-react en `LandingPage`).
4. Optimizar el mapa de zonas (ficha) y el Taller 3D: `frameloop="demand"` + `invalidate`, DPR ≤ 1,5 (1 en pantallas pequeñas), sombras de un fotograma, montaje al hacerse visible, pausa con la pestaña oculta, sin autorrotación con movimiento reducido, `dispose` al desmontar, sin `setState` por fotograma.
5. Arreglar los avisos de lint de `overlay.tsx:56` y `WorkshopCanvas.tsx:716/760`.
6. Medir después con las mismas pruebas.

## 2. Medición inicial (antes)

### 2.1 Método

- **Build aislado**: para no medir el trabajo a medias de otros agentes, las dos mediciones se hacen sobre una copia de `HEAD` (`git archive HEAD frontend`, commit `158a0e8`) en el scratchpad, con `node_modules` enlazado. "Después" = la misma copia + mi `src/three`. Se sirve con `vite preview` (build de producción) en **:5182** y API aislada en **:8040**.
- **Navegador**: Chromium de Playwright sin cabeza con `--use-gl=angle --use-angle=swiftshader` (WebGL por CPU). **Los tiempos y los FPS con SwiftShader NO son representativos de una GPU real** (compilar sombreadores y rasterizar se hace en la CPU y tarda de 5 a 20 veces más); sirven para comparar antes y después en la misma máquina.
- **Instrumentación sin tocar la app**: un `addInitScript` envuelve `WebGLRenderingContext`/`WebGL2RenderingContext` (draw calls, triángulos, buffers, texturas y programas vivos por contexto, contextos creados y perdidos, primer dibujo en el framebuffer visible) y lee `renderer.info` con el gancho oficial `__THREE_DEVTOOLS__` de three.js.
- **"Listo"** = primer dibujo de la escena 3D en el lienzo visible (ms desde el inicio de la navegación). "Fotogramas en reposo" = fotogramas pintados en 3 s sin tocar nada, a partir del segundo 9.
- Script: `scratchpad/3d-rendimiento/measure.mjs` (resultados en `antes.json` / `despues.json`).

### 2.2 Build (antes)

| Chunk | Tamaño | gzip | Qué es |
|-------|-------:|-----:|--------|
| `three-DtrbXAJd.js` | 1.005,3 kB | 272,0 kB | three.js + R3F + drei (+ `scheduler`, arrastrado por `manualChunks`) |
| `charts-BMXEC6kX.js` | 404,6 kB | 115,5 kB | recharts (+ **React**, arrastrado por `manualChunks`) |
| `three-BLmldCr5.js` | 33,0 kB | 12,6 kB | `src/three/index.tsx` (envoltorios, silueta, respaldos 2D) |
| `materials-*.js` | 29,3 kB | 11,2 kB | geometría procedural del coche y materiales |
| `WorkshopCanvas-*.js` | 19,8 kB | 6,8 kB | Taller 3D |
| `HeroCanvas-*.js` | 11,9 kB | 4,9 kB | portada |
| `Stage-*.js` / `CarViewerCanvas-*.js` / `overlay-*.js` / `renderThumbnail-*.js` | 5,7 / 4,6 / 4,5 / 3,5 kB | | escenario, visor, rótulos, miniaturas |

**Hallazgo principal: en producción three.js NO se carga de forma diferida.** El `index.html` hace `modulepreload` de `three-DtrbXAJd.js` y de `charts-BMXEC6kX.js` porque la entrada importa de ellos `scheduler` y React: el `manualChunks` de `vite.config.ts` mete en el chunk con nombre las dependencias de lo que captura (comportamiento documentado de Rollup/Rolldown). Resultado: **las 17 pantallas medidas, incluida `/entrar`, descargan 1,0 MB de three.js y 0,4 MB de recharts** (2,07 MB de JS sin comprimir en la pantalla de entrar). Está fuera de mi zona: lo pido en el tablero con el parche exacto (apartado 3).

### 2.3 Pantallas con 3D (antes, 1280×800, SwiftShader)

| Pantalla | FCP | Listo (1er dibujo 3D) | Tareas largas (total / máx.) | Fotogramas en reposo (3 s) | `renderer.info`: draw calls · triángulos · geometrías · texturas · programas | Contextos WebGL |
|----------|----:|----:|----:|----:|----|----:|
| Ficha (mapa de zonas) | 368 ms | **10.410 ms** | 10.769 / 5.534 ms | 0 | 21 · 252.490 · 46 · 13 · 18 | 3 (visor + miniatura + detección) |
| Taller 3D | 556 ms | **7.488 ms** | 7.731 / 4.210 ms | **12** (no para: balizas girando) | **321** · **598.928** · 191 · 11 · 12 | 2 |
| Centro de control (taller embebido) | 680 ms | 12.718 ms | 11.263 / 4.928 ms | 13 | 321 · 598.928 · 191 · 11 · 12 | 2 |
| Cabina (coche girando) | 372 ms | 4.212 ms | 4.122 / 1.068 ms | 0 (*) | 17 · 227.146 · 42 · 12 · 14 | 2 |
| Portada | 720 ms | 3.259 ms | 4.715 / 1.786 ms | 1 (*) | 18 · 276.738 · 47 · 15 · 20 | 2 |
| Formulario (vista previa) | 512 ms | 2.664 ms | 2.149 / 689 ms | 0 (*) | 18 · 53.766 · 42 · 7 · 10 | 2 |
| Garaje (solo miniaturas) | 396 ms | — | 6.369 / **4.755 ms** | — | — (renderizador de miniaturas fuera de pantalla) | 2 |

(*) La cabina, la portada y la vista previa piden `frameloop="always"`, pero con SwiftShader el hilo principal está tan ocupado compilando sombreadores y renderizando miniaturas que apenas llega a pintar; en una GPU real irían a 60 fps sin parar mientras se ven.

Perfil de CPU de la ficha (CDP, 10 s): 4,9 s en el render de la **miniatura de la cabecera** (`renderThumbnail`: contexto WebGL propio, PMREM del estudio, compilar de nuevo todos los sombreadores y `toBlob`), 1,5 s esperando el enlazado de programas (`getProgramParameter`) y el resto en generar la geometría. Es decir: la miniatura de 192×112 px retrasaba el mapa de zonas.

### 2.4 Qué pantallas descargan three.js (antes)

Las 17: portada, entrar, cabina, garaje, ficha (resumen, diario, historial), formulario, agenda, analítica, centro de control, órdenes, nueva orden, detalle de orden, clientes, detalle de cliente y Taller 3D. Solo 5 tienen `<canvas>` (portada, cabina, formulario, centro de control, Taller 3D) y la ficha lo monta pasados los 5 s. Además, 9 de ellas cargan `renderThumbnail` + `materials` para pintar miniaturas con WebGL.

### 2.5 Fugas (antes)

Recorrido dentro de la SPA (sin recargar), 5 ciclos de *cabina → garaje → ficha → garaje → ficha → cabina*, forzando la recolección de basura (`--expose-gc`) antes de cada lectura:

| Momento | Heap JS | Contextos creados | Contextos vivos | Buffers / texturas vivos (GPU) | Renderizadores que siguen en memoria | Oyentes `dispose` en una geometría compartida |
|---------|-------:|----:|----:|----|----:|----:|
| Inicio (cabina) | 31,2 MB | 2 | 1 | 127 / 16 | 1 | 1 |
| Ciclo 1 | 59,3 MB | 6 | 1 | 127 / 16 | 5 | 2 |
| Ciclo 3 | 62,7 MB | 12 | 1 | 127 / 16 | 11 | 4 |
| Ciclo 5 | 65,6 MB | 18 | 1 | 127 / 16 | **17** | **6** |

- **GPU: sin fuga.** R3F pierde el contexto al desmontar y los buffers y texturas vivos no crecen.
- **JS: fuga de ~1,5 MB por ciclo.** Ningún `WebGLRenderer` desmontado se libera: las geometrías y materiales que se memorizan a nivel de módulo (coche por carrocería, materiales compartidos, piezas del elevador) guardan el oyente `dispose` que cada renderizador les añade, y ese oyente retiene al renderizador entero (programas, listas de render, estado). Se corrige llamando a `dispose()` de esos recursos al desmontar el lienzo (apartado 3).

## 3. Cambios

*(pendiente)*

## 4. Medición final (después)

*(pendiente)*

## 5. Qué hay en `src/three` (cierre de las oleadas 1c/1d)

*(pendiente)*

## 6. Evidencias

*(pendiente)*

## 7. Limitaciones

*(pendiente)*

## 8. Siguiente paso propuesto

*(pendiente)*
