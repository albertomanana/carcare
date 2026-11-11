# Taller 3D: maqueta a sangre con interfaz flotante (frontend-react, taller)

**Fecha:** 10/11/2026 · **Agente:** frontend-react (taller) · **Encargo:** sesión principal, pedido por Alberto · **Sin commits**

## 1. Objetivo

Convertir `WorkshopFloorPage` en una maqueta isométrica a toda la pantalla con la interfaz 2D flotando encima. Arriba van las cifras, que filtran la lista. A la derecha, la ficha de lo elegido. Abajo, la lista de la flota, que se puede plegar y es la alternativa HTML de la escena. La selección se sincroniza con la URL y se le pasan `selectedOrderId` y `focusInset` a la escena que rehace experto-3d en paralelo. Solo datos reales (regla 2).

## 2. Qué hice

### Disposición según el ancho

| Ancho | Disposición |
|---|---|
| ≥ 1280 px (con WebGL) | Lienzo a sangre, `calc(100dvh - 4rem - 1px)`. Encima flotan la cabecera (título, «Tablero» y «Nueva orden»), las cifras, la lista abajo y la ficha a la derecha (380 px). Al abrirse la ficha, la lista se aparta de ella. |
| 768–1279 px (con WebGL) | Igual, pero las cifras van en una fila desplazable y la ficha es una **hoja inferior** (como mucho el 50 % del alto) que cubre la lista. |
| < 768 px, o sin WebGL | Todo apilado y nada encima del lienzo: cabecera, cifras (fila desplazable), escena (45dvh, mínimo 260 px), lista y ficha. Al elegir algo, la ficha se acerca a la vista. |

- **Cristal sutil** (`features/workshop/floor.css`, clase `.floor-glass`): la cartulina `--surface` al 95 % con `backdrop-filter: blur(12px)`, filo de luz y la sombra «elevada» de DESIGN.md. El fondo pasa a opaco si el navegador no tiene `backdrop-filter` o si el usuario pide `prefers-reduced-transparency`. Solo usa tokens, así que vale para el tema oscuro sin más.
- **Entrada de la ficha**: 260 ms desde la derecha o 280 ms desde abajo, con `cubic-bezier(0.23,1,0.32,1)`. Con `prefers-reduced-motion` no hay animación (comprobado: `animationName: none`).
- **Clics**: la capa de arriba lleva `pointer-events: none`, así que los huecos entre paneles siguen dejando arrastrar y pulsar la maqueta.

### Cifras (`components/FloorStats.tsx`)

- Las cifras son **En taller** (órdenes abiertas), **En elevador** (`3 de 4`), **Esperando** (sin elevador y sin estar listas), **Listos para entregar** y **Con retraso**. Esta última solo aparece si hay alguna y lleva icono y palabra.
- Cada cifra es un botón con `aria-pressed` que filtra la lista. Pulsar la activa vuelve a «En taller». La activa se marca con un fondo y una regla inferior, no solo con color.
- Si fallan las órdenes, las cifras que dependen de ellas muestran «—» («sin datos» para el lector) y no se pueden pulsar: nunca un 0 inventado. «En elevador» sale de `bays` y sigue funcionando.
- Si se aplica «Con retraso» y dejan de existir órdenes tarde, el filtro vuelve solo a «En taller» (`effectiveFilter`).

### Lista de la flota (`components/FleetTable.tsx`)

- Una fila por orden abierta, en el mismo orden en que se recorre la maqueta: elevadores 1…n, después la espera (tarde y urgentes primero) y al final las listas.
- **Columnas**: matrícula, vehículo (muestra lacada `VehicleSwatch` + nombre + número de orden), cliente, estado (icono + texto, con «Tarde» o «Urgente» si aplica), elevador, mecánico y entrega prometida (alineada a la derecha y en rojo si va tarde).
- Las columnas secundarias se esconden con consultas de contenedor (`@container`), nunca con desplazamiento lateral.
- **Elegir una fila**: con un clic en cualquier punto de la fila, o con Enter o espacio en el botón de la celda del vehículo (`aria-pressed`). La escena recibe `selectedOrderId` y enfoca el coche.
- **Plegable** con «Ocultar lista» / «Mostrar lista» (`aria-expanded`). La preferencia se guarda en `localStorage` (`carcare.taller.lista`). Al pulsar una cifra con la lista plegada, la lista se abre.
- **Estados**:
  - carga con esqueleto;
  - error con «Reintentar»;
  - **taller vacío**: «No hay coches en el taller» y «Nueva orden» solo si `can('operate')`;
  - **filtro sin resultados**: «Ningún coche en "…" ahora mismo» con «Ver todos».

### Ficha (`components/FloorPanel.tsx`, reescrito)

- **Ficha de una orden**: número, título (enlaza a la orden), `StatusPill` del estado, «Tarde» y la prioridad alta o urgente, la muestra del vehículo con su nombre y la matrícula (`Plate`/`formatPlate`). Debajo, una lista con:
  - cliente, con teléfono `tel:`;
  - elevador y mecánico;
  - prioridad, con icono;
  - km de entrada y fecha de recepción;
  - entrega prometida, con el aviso «Con retraso» (icono y texto);
  - el **total con IVA solo con `can('manage')`**, como antes.
- **Acciones**: las mismas de antes con `useOrderActions` (paso siguiente, «Mover a…», subir a un elevador libre o bajar). Debajo, «Abrir orden» e «Historial del vehículo».
- **Elevador libre**: los coches que esperan, con «Subir». Ahora deja fuera los que están en «Listo».
- **Cerrar** con la X o con **Escape**. Escape no cierra la ficha si lo está usando un diálogo o un menú abierto: con «Mover a…» desplegado, el primer Escape cierra el menú y el segundo, la ficha.
- **Foco al cerrar**: si estaba en la ficha, vuelve a la fila de la orden en la lista (o al título de la lista si está plegada).
- **Lo que quité**: la vista general sin selección («Elevadores y espera»). La sustituye la lista de la flota, que tiene los mismos datos y además filtros. Me quedé las funciones `OrderSheet` y `FreeBaySheet` en vez de duplicarlas.

### Selección y escena

- `useFloorSelection` sigue igual (`?elevador=` / `?orden=`).
- A `WorkshopScene` le paso `selectedBay`, `selectedOrderId`, `onSelectBay`, `onSelectOrder` y `focusInset`. El `focusInset` se mide con `ResizeObserver` (hook `useBoxSize`):
  - `top`: lo que ocupan la cabecera y las cifras;
  - `bottom`: lo que ocupa la lista o, en tableta con la ficha abierta, la hoja;
  - `right`: el ancho real de la ficha más el margen, solo en escritorio y con la ficha abierta.
- Los valores están memorizados para no relanzar el encuadre en cada render. En la disposición apilada se pasa `undefined`.
- Cuando empecé, `selectedOrderId` y `focusInset` aún no estaban en `three/types.ts`. Al terminar ya las había añadido experto-3d, así que se pasan con el tipo real (`WorkshopSceneProps`). **No he tocado `frontend/src/three/`.**

### Accesibilidad

- Orden del DOM igual al de tabulación: cabecera → cifras → rótulos de la escena → lista → ficha. Lo he comprobado recorriendo 22 tabulaciones a 1280.
- Hay dos regiones `aria-live="polite"`. Una lee el resumen del taller («13 coches en el taller · 3 de 4 elevadores ocupados · 3 listos para entregar · 5 con retraso»). La otra lee lo que se elige («Seleccionada OT-…, …, elevador 1. Ficha abierta.»).
- La tabla tiene `<caption>` para el lector y `th scope="col"`. El foco visible es el del sistema.
- Rótulos en versalitas estrechas (`tag-label`) y cifras tabulares a la derecha, siguiendo DESIGN.md.

## 3. Archivos

| Archivo | Cambio |
|---|---|
| `frontend/src/features/workshop/WorkshopFloorPage.tsx` | Reescrito: disposición flotante o apilada, filtro, Escape, foco, `focusInset` |
| `frontend/src/features/workshop/floor.css` | **Nuevo**: cristal y entrada de la ficha. Lo importa la página, así que va en su propio fragmento de 1 KB y no toca `index.css`, que edita el otro frontend-react |
| `frontend/src/features/workshop/components/FloorPanel.tsx` | Reescrito como ficha de detalle (`FloorDetail`, `FloorDetailSkeleton`) |
| `frontend/src/features/workshop/components/FloorStats.tsx` | **Nuevo** |
| `frontend/src/features/workshop/components/FleetTable.tsx` | **Nuevo** |
| `frontend/src/features/workshop/components/floorFleet.ts` | **Nuevo**: cifras, filtros, orden de las filas y textos (funciones puras) |
| `frontend/src/features/workshop/components/floorFleet.test.ts` | **Nuevo**: 8 tests |
| `frontend/src/features/workshop/components/useFloorLayout.ts` | **Nuevo**: `useMediaQuery` y `useBoxSize` (en mi carpeta para no chocar con `hooks/`) |
| `frontend/src/features/workshop/components/floor.ts` | Añade `FLOOR_DETAIL_TITLE_ID` y `selectionAnnouncement` |

No he añadido dependencias ni he tocado `components/layout/`, `nav.ts`, los formularios, `three/` ni `api/types.ts`.

## 4. Evidencias

Comandos ejecutados desde `frontend/` al terminar:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores (exit 0) |
| `npm run lint` | Exit 0 y **ningún aviso en mis archivos**; los que salen son de otras zonas, sobre todo `three/` y `layout/` |
| `npm run test` | **19 archivos, 154 tests, todos en verde** (8 nuevos en `floorFleet.test.ts`) |
| `npm run build` | En verde. `WorkshopFloorPage` ocupa 28,4 kB (8,7 kB gzip) más 1,05 kB de CSS |

Durante la sesión hubo un momento en que `typecheck` y `test` fallaban por `src/lib/firstSteps.test.ts`, que es trabajo en curso del otro frontend-react (primeros pasos). Al repetirlos ya pasaban.

**Prueba contra la API real** en una instancia aislada (API en `:8042` con OPcache, web en `:5196`). Usé Playwright con WebGL por software (`--use-angle=swiftshader`), viewport alto y una pestaña cada vez. Los scripts están en el directorio temporal de la sesión y las capturas, en [`2026-11-10-frontend-react-taller-isometrico/`](2026-11-10-frontend-react-taller-isometrico/).

**Cuentas** `taller@` (propietario), `mecanico@` y `gerente@`. **Anchos** 1280, 768 y 360, en claro y en oscuro.

Resultados:

- **Sin desplazamiento horizontal de página**: 0 px en los 12 casos (dos cuentas × tres anchos × dos temas).
- **Filtro por cifra**: «Listos para entregar» deja la lista en «3 coches listos para entregar», y pulsarla otra vez la quita.
- **Selección**:
  - un clic en una fila lleva a `?orden=27` y abre la ficha;
  - Enter en una fila lleva a `?orden=26`;
  - un clic en el rótulo «Elevador 4 · libre» de la escena lleva a `?elevador=4` y abre la ficha con «Sube un coche…».
- **Escape**: cierra la ficha y el foco vuelve a `floor-row-27` en los 12 casos. Con «Mover a…» abierto, Escape solo cierra el menú.
- **Importes**:
  - propietario y gerente ven «Total (con IVA)» (253,01 €);
  - **el mecánico no lo ve en ningún ancho ni tema** (0 apariciones en 6 casos).
- **Error de órdenes** (simulado devolviendo 500 al pedir `/work-orders`): la lista enseña «No se pudo cargar la lista de coches» con «Reintentar», y tres cifras quedan en «sin datos». «En elevador» sigue en «3 de 4».
- **Movimiento reducido**: la ficha aparece sin animación.
- **Consola**: solo sale el 401 de `/user` antes de iniciar sesión, que es lo esperado.

## 5. Limitaciones

1. **Taller sin órdenes**: este estado vacío no lo he probado contra la API, porque el taller de demostración tiene 13 órdenes abiertas. Está cubierto por el código (`total === 0`), pero falta verlo en pantalla.
2. **Retraso por el WebGL por software**: con swiftshader, la ficha tarda en aparecer y en cerrarse 2,0–3,7 s a 1280 y 0,3–1,2 s a 360. El retraso crece con el tamaño del lienzo, así que es el coste de renderizar por CPU y no de la interfaz. Hay que medirlo con una GPU real (sigue pendiente desde la sesión del 06/11).
3. **Tableta (768)**: con la ficha abierta, la franja de maqueta que queda a la vista es pequeña (unos 260 px entre las cifras y la hoja). La hoja se cierra con la X o con Escape. Si a Alberto le parece poco, la siguiente mejora sería poder plegar la hoja a una sola línea.
4. **Móvil, orden de las piezas**: las cifras van **encima** de la escena, no debajo como decía el encargo, para que el orden visual coincida con el de tabulación (cifras → escena → lista → ficha, WCAG 2.4.3). Las cifras son una fila de unos 76 px, así que la escena sigue casi arriba.
5. **El filtro de las cifras solo afecta a la lista**: la escena no atenúa los coches que quedan fuera, porque no tiene ninguna prop para ello. Si se quiere, habría que pedírselo a experto-3d (p. ej. una prop `highlightOrderIds`).
6. **Leyenda de la escena**: es de experto-3d y queda encima de la lista gracias a `focusInset.bottom`. No he comprobado cómo se ve con la lista plegada en todos los anchos.

## 6. Siguiente paso propuesto

- Que qa-tester añada a `e2e/` un caso del Taller 3D: filtro, fila → `?orden=`, Escape → foco, y que el mecánico no ve el importe. Los pasos de mi script valen como guion.
- Medir con GPU real la latencia de selección a 1280.
- Si se ve útil, pedir a experto-3d una prop para atenuar en la escena lo que el filtro deja fuera.
