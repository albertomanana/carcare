# Taller 3D «táctico»: equipo sin duplicados, almacén, diagnóstico, vistas, bloom e indicadores

**Fecha:** 16/11/2026 · **Quién:** sesión principal (interactiva, con Alberto) · **Zonas:** `frontend/src/three/` (de `experto-3d`), `frontend/src/features/workshop/` (de `frontend-react`) y `frontend/vite.config.ts` y `package.json` (dependencia nueva). Sin cambios de backend ni de contrato.

## Objetivo

Alberto pegó un encargo para convertir el taller en un «dashboard 3D tipo RTS». Pedía:

- un pool único de mecánicos (prohibido duplicarlos con `bays.map()`);
- bahías con elevador que sube según el estado;
- zonas de diagnóstico y almacén;
- presets de cámara;
- bloom y viñeta;
- KPIs y filtros en el HUD;
- una ficha de «telemetría» al pulsar.

Decidió (16/11):

1. Evolucionar la escena real, no un prototipo aparte.
2. Usar equivalentes con fuente real en lugar de OEE, OBD‑II, «ingresos proyectados» o stock de almacén.
3. Añadir solo `@react-three/postprocessing`, sin Zustand.
4. Mantener su cambio a azul de `kit.ts`, que tiene sin confirmar.

## El error real que corrige

`WorkshopCanvas` dibujaba **un mecánico por elevador**, con `key = orderId`. La demo lo reproduce: Andrés tiene órdenes en curso en los elevadores 1, 2 y 3, y salía **tres veces**. Ahora cada persona es una figura única (`key = userId`).

## Qué se hizo

### Equipo (lógica pura, `three/scenes/workshop/crew.ts` + 9 tests)

- **Origen del equipo.** Sale de `GET /members`, que es `view` y lo pueden pedir todos los roles. Sin esa lista (cargando o error), solo se usa a quien está asignado a una orden en curso.
- **Persona trabajando.** Tiene alguna orden en diagnóstico o reparación. Su figura va al elevador cuya orden cambió de estado más tarde. En los demás elevadores con órdenes suyas aparece una baliza «Andrés está en el elevador 3».
- **Orden en curso sin elevador.** También es trabajo: el texto dice «Reparando OT‑… sin elevador» y su figura se queda en la zona del equipo. Este caso salió al probar con la demo (Marcos tiene una así). La primera versión lo habría etiquetado «Sin orden en curso», que era falso.
- **Coche sin técnico.** Un coche en un elevador sin persona asignada (recibido, en diagnóstico o en reparación) lleva la baliza «En espera de técnico».
- **Sin orden en curso.** Quien no tiene ninguna orden en marcha aparece así, no como «libre»: no hay fichaje.

### Escena (`WorkshopCanvas.tsx`, `workshop/*`)

- **Planta (`layout.ts`).** Hay un lateral reservado a la izquierda de los elevadores (`SIDE_W = 5,4 m`) para el almacén, el terminal de diagnóstico y el banco del equipo. Ningún coche pasa por ahí. Un test lo comprueba con 1, 3, 4, 8 y 12 elevadores.
- **Kit (`kit.ts`).** Estantería del almacén (neumáticos, baterías y cajas), armario y marco del terminal, banco del equipo y borde peatonal ámbar. Se respeta el azul de Alberto.
- **Mecánico (`Mechanic.tsx`).**
  - pose de reposo;
  - al cambiar de sitio camina por el pasillo entre los elevadores y la calzada;
  - aro de selección y atenuación por filtro;
  - un clic elige a la persona (antes elegía su orden);
  - con movimiento reducido, cambia de sitio directamente.
- **Elevadores.** `LIFT_HEIGHT.diagnosing` pasa de 0,5 m a 0: en diagnóstico, el coche está a pie de suelo. En reparación y esperando piezas sigue arriba, como pedía el encargo.
- **Balizas.** Luz ámbar intermitente sobre la columna, para coches sin técnico o con su técnico en otro elevador. El almacén tiene su propia luz, que parpadea si alguna orden espera piezas. Con movimiento reducido, las luces quedan fijas. La pantalla del terminal se enciende si hay coches en diagnóstico.
- **Rótulos (`labels.tsx`), con el sistema de rótulos sin solapes que ya existía.**
  - «Almacén»: N órdenes esperan piezas, con sus piezas anotadas;
  - «Diagnóstico»: coches y el texto `diagnosis` de cada orden, o «Sin diagnóstico anotado»;
  - nombre de cada persona fuera de un elevador;
  - baliza dentro del rótulo del elevador.
- **Vistas (`view`).** General, Elevadores, Almacén y equipo, y Lo elegido. Al elegir algo se pasa a «Lo elegido». Escape o «Ver toda la nave» vuelven a la general. El damping de la cámara es 0,05, como pedía el encargo.
- **Filtros.** Lo que no coincide con el filtro de la página se atenúa: los coches se funden con el fondo, las figuras se oscurecen y los rótulos se apagan.
- **Bloom y viñeta (`workshop/Effects.tsx`).**
  - Bloom por luminancia con umbral 1: solo florecen las líneas, las lámparas, las balizas y la pantalla, que se pintan por encima de 1 cuando el bloom está activo.
  - El tone mapping Neutral se aplica al final.
  - Se carga en un chunk aparte y solo se usa con 640 px o más y sin movimiento reducido. Si falla, la escena sigue con los halos pintados que ya había.
- **Vista 2D (`fallbacks.tsx`).** Muestra las balizas en cada elevador y una lista «Equipo». Es la misma información, en HTML.

### HUD (`features/workshop/`)

- **Barra de vistas** (`FloorViewBar`), con las teclas 1‑4 y el filtro **«Sin orden en curso N»**, que resalta a esas personas y abre su lista en la columna.
- **Cifra «Atascadas»** (`floorFleet.ts`): esperan piezas, o están en un elevador y van con retraso. Filtra la lista y atenúa la maqueta.
- **Indicadores** (`FloorKpis`), calculados con las órdenes abiertas:
  - **Días en taller**: media desde la recepción de las abiertas;
  - **Listo para cobrar**: suma con IVA de las órdenes listas para entregar, en céntimos enteros. Solo la ven el propietario y el gerente.
  - No hay OEE: no hay fuente.
- **Ficha de la orden** (`FloorPanel`):
  - «Lo que dice el cliente» y «Diagnóstico», o «Sin diagnóstico anotado» con un enlace para anotarlo;
  - botón **«Esperar piezas»** en diagnóstico o reparación;
  - el nombre del mecánico abre su ficha.
  - Propietario, matrícula, piezas y «Marcar como lista» ya existían.
- **Ficha de una persona** (`CrewPanel`, `?tecnico=ID`): lo que está haciendo y sus órdenes abiertas, que se pueden pulsar. La selección sigue en la URL.

### Dependencia (regla 8)

- **Qué:** `@react-three/postprocessing@3.2.2` + `postprocessing@6.39.6`. Compatibles con R3F 9, React 19 y three 0.186. Las dos versiones tienen más de dos semanas.
- **Para qué:** Alberto eligió el bloom real; sin esta librería habría que escribir el compositor a mano.
- **Peso:** el chunk `postfx` es de 42 KB gzip. Solo lo descarga el taller 3D, y solo cuando monta el bloom. `three` no cambia.
- **`vite.config.ts`:** grupo `postfx` nuevo, que también cubre el guardián de chunks pesados (R11).

## Archivos tocados

**3D:**
- nuevos: `three/scenes/workshop/{crew.ts, crew.test.ts, Effects.tsx}`;
- modificados: `three/scenes/WorkshopCanvas.tsx`, `three/scenes/workshop/{layout.ts, layout.test.ts, kit.ts, Mechanic.tsx, labels.tsx, IsoParts.tsx}`, `three/{types.ts, index.tsx, fallbacks.tsx}`.

**Página:**
- nuevos: `features/workshop/components/{CrewPanel.tsx, FloorKpis.tsx, FloorViewBar.tsx}`;
- modificados: `features/workshop/WorkshopFloorPage.tsx`, `features/workshop/components/{floor.ts, floorFleet.ts, floorFleet.test.ts, FloorStats.tsx, FloorPanel.tsx}`.

**Build:** `frontend/{package.json, package-lock.json, vite.config.ts}`.

**Documentación:** este informe y `2026-11-16-taller-tactico-capturas/` (script y capturas).

**Aviso:** `kit.ts` ya tenía cambios de Alberto sin confirmar (paleta azul). Mis cambios van encima, así que el commit de `kit.ts` incluye los dos. Los otros cambios suyos sin confirmar (`index.css`, `env.ts`, `GarageDioramaCanvas.tsx`, `AppShell.tsx`, `Logo.tsx`…) **no** se tocaron.

## Evidencias

Comandos ejecutados desde `frontend/`:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | sin errores |
| `npx vitest run` | **29 archivos, 249 tests en verde**, entre ellos `crew.test.ts` (9), `layout.test.ts` (+1, el lateral) y `floorFleet.test.ts` (+3: «Atascadas» e indicadores) |
| `npx oxlint src` | 0 errores; ningún aviso nuevo en los archivos de esta sesión, salvo «only-export-components» en `three/index.tsx` (la misma advertencia que ya tenía por `useWebGLAvailable`) y «preserve-manual-memoization» en `WorkshopFloorPage.tsx` |
| `npm run build` | correcto: `WorkshopCanvas` 12,9 KB gzip, `postfx` 42,2 KB gzip (aparte) y `three` 271,4 KB gzip (sin cambios); el guardián de chunks pesados pasa |

### Prueba en la app real (instancia aislada)

- **Entorno:** API en :8020 y web en :5181, con base **`carcare_pruebas`** sembrada con `migrate:fresh --seed` y `LARAVEL_STORAGE_PATH` en el scratchpad. **No se tocó `carcare`** ni el almacenamiento real: `storage/app/private/documents/1` tiene los mismos 66 ficheros antes y después.
- **Escenario:**
  - la demo ya trae a Andrés en los elevadores 1, 2 y 3;
  - se subió OT‑2026‑0034 (recibida, sin asignar) al elevador 4;
  - Marcos tiene una orden en reparación sin elevador;
  - Elena no tiene ninguna orden en curso.
- **Script:** [`capturar.mjs`](2026-11-16-taller-tactico-capturas/capturar.mjs), con Playwright y swiftshader.

| Pasada | Resultado |
|---|---|
| 1280 oscuro | 3 figuras en escena y **ninguna repetida** (Andrés en el elevador 3, Marcos y Elena en el banco). Teclas 1/2 cambian la vista |
| 1280 claro, movimiento reducido | 1 baliza «En espera de técnico» (E4) y 2 «Andrés … está en el elevador 3» (E1 y E2). Almacén: «3 órdenes esperan piezas». Ficha de persona `?tecnico=3`. Ficha de orden con «Diagnóstico» y «Esperar piezas» |
| 1280 oscuro, rol mecánico | todo igual, **sin «Listo para cobrar»** (importes solo para propietario y gerente) |
| 768 y 360, movimiento reducido | vista 2D con las balizas en cada elevador, la persona asignada y los indicadores. La ficha de orden funciona |

En todas las pasadas, la consola solo muestra un 401 de `/me`, que es anterior al inicio de sesión y esperado.

**Capturas** (en [`2026-11-16-taller-tactico-capturas/`](2026-11-16-taller-tactico-capturas/)):
- `general-*`, `vista-lateral-*`, `vista-elevadores-*`;
- `sin-orden-en-curso-*`, `ficha-persona-*`, `atascadas-*`, `ficha-orden-*`.

## Limitaciones

- **GPU real:** el bloom, la viñeta y el parpadeo solo se han visto con WebGL por software (swiftshader). Las intensidades (umbral 1, refuerzo ×2,4) hay que confirmarlas en la GPU de Alberto.
- **Coste de render:** mientras hay una baliza o el almacén parpadea, la escena pide fotogramas continuos. Ya pasaba con los mecánicos animados. Con movimiento reducido no ocurre.
- **Posición de la figura:** se deduce de las órdenes, no de un fichaje ni de una localización real, y la ficha lo dice. El paseo entre puestos va en línea recta por el pasillo: puede cruzarse visualmente con un coche que gira.
- **Espacio:** se dibujan hasta unas 6 personas en la primera fila del banco; las demás, en una segunda fila.
- **Almacén:** no hay inventario. Muestra las órdenes «Esperando piezas» y las líneas de pieza que tengan anotadas.
- **Indicadores:** «Días en taller» mide la antigüedad de las órdenes abiertas, no el tiempo de ciclo de las entregadas. Ese ya está en la analítica (`avg_days_in_shop`).
- **Seguridad de dependencias:** `npm audit` avisa de una vulnerabilidad alta en `zod` (<4.6.6), que **ya estaba antes**. No es de esta sesión y no se ha tocado.

## Siguiente paso propuesto

1. Que Alberto vea el taller en su GPU, con tema claro y oscuro, y diga si el bloom está bien de intensidad.
2. Opcional: rótulos en el suelo («ALMACÉN», «EQUIPO») en el atlas de `buildDecals`.
