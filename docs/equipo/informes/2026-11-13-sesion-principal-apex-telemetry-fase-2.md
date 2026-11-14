# Rediseño «Apex Telemetry» · Fase 2: taller 3D con color, mecánicos y cronómetro en vivo

**Fecha:** 13/11/2026 · **Quién:** sesión principal (interactiva, con Alberto) · **Zonas:** `frontend/src/three/` (de `experto-3d`), `frontend/` (de `frontend-react`), `backend/` (de `backend-laravel`) y el contrato (de `arquitecto`). Lo hizo la sesión principal en línea, sin agentes, por encargo directo de Alberto («ok, sigue», «quiero empezar a ver cambios», «sin pausa»).

## Objetivo

Fase 2 del encargo del 13/11: una vista 3D del taller más bonita y con color, mecánicos trabajando con un cronómetro en tiempo real frente al tiempo estimado, y todo pulsable (coches, mecánicos, elevadores y plazas) con la cámara que se acerca y la ficha de la orden.

## Decisión de contrato (delegada por Alberto: «por lo demás te dejo a ti las decisiones»)

El cronómetro no tenía fuente real: `work_orders` no guardaba cuándo empieza el trabajo ni el tiempo estimado (regla 2). Se añaden tres campos, de forma aditiva (contrato §3.11.1):

| Campo | Qué es |
|---|---|
| `status_changed_at` | Desde cuándo está la orden en su estado actual. Solo cambia al cambiar de estado. |
| `repair_seconds` | Segundos acumulados en «En reparación» en tramos ya cerrados. |
| `estimated_minutes` | Minutos de mano de obra que estima el taller (5…6000) o `null`. Se puede poner al crear o editar la orden. |

**Es tiempo en un estado, no trabajo medido**: cuenta también las horas en que nadie toca el coche. La interfaz lo dice («Cuenta el tiempo en este estado, no las horas trabajadas») y nunca lo llama horas trabajadas. Sin tiempo estimado no hay barra de avance, solo el reloj, y se ofrece ponerlo con un toque.

## Qué se hizo

### Backend
- Migración `2026_11_13_000001_add_timing_to_work_orders`: las tres columnas. Las órdenes anteriores toman como `status_changed_at` su último `work_order.status_changed` de la actividad o, si no hay, la recepción.
- `WorkOrderService`: al crear, `status_changed_at = ahora`; al cambiar de estado, si salía de «En reparación» suma ese tramo a `repair_seconds` y reinicia el reloj. Editar o cambiar de elevador no lo toca.
- `WorkOrderRequest` valida `estimated_minutes`; `WorkOrderResource` y `tests/Support/Contract.php` exponen los tres campos.
- `DemoSeeder`: el tiempo estimado sale de las horas de mano de obra de cada orden y el reloj de lo que se está trabajando cae en la jornada de hoy.

### Contrato
- `frontend/src/api/types.ts`: `WorkOrder.status_changed_at`, `repair_seconds`, `estimated_minutes` y `WorkOrderInput.estimated_minutes`.
- `docs/api/contrato-v1.md`: sección 3.11.1 y entrada en el historial.

### Escena 3D (`frontend/src/three/scenes/`)
- `workshop/kit.ts` (nuevo): paleta del taller y la nave con color. Suelo epoxi reflectante, líneas luminosas por zona (naranja en elevadores, ámbar en espera, esmeralda en entrega) con halo, elevadores con cilindro, remate y cuadro de mando, carros de herramientas rojos y naranjas, estantería de neumáticos, bidones, compresor, banco con panel de herramientas y conos. Todo fusionado: 1 geometría estática, 1 de pintura y 2 de líneas.
- `workshop/Mechanic.tsx` (nuevo): figura de arcilla junto al coche, **solo si la orden tiene persona asignada y está en diagnóstico o en reparación**. En reparación mueve la llave y hay un destello en la herramienta; en diagnóstico sostiene una tableta encendida. Aparece cuando el coche ya está colocado, nunca mientras maniobra. Con movimiento reducido, pose fija y sin fotogramas continuos.
- `WorkshopCanvas.tsx`: luz cálida por puesto (charco de luz y, en los 6 primeros elevadores, un punto de luz real; plena si se trabaja, tenue si el coche espera), realce con contorno blanco al pasar el puntero por coche, mecánico, elevador o plaza, desenfoque de maqueta arriba y abajo y algo más de saturación.
- `workshop/labels.tsx`: el rótulo de cada elevador ocupado muestra mecánico (con el color de su mono) y tarea, estado, cronómetro en vivo y barra de avance frente a lo estimado. En vista general, versión corta con el reloj.
- `workshop/layout.ts`: `mechanicSpot()`, con un test que comprueba que la figura no pisa el coche más ancho ni las bases de las columnas.

### Pantallas
- `lib/orderTiming.ts` (nuevo, con tests): cálculo del cronómetro, formato `HH:MM:SS` y frase accesible. `lib/mechanic.ts` (nuevo): color del mono por persona.
- `components/orders/OrderTimer.tsx` (nuevo): `LiveTimer`, con su propio intervalo de 1 s (solo se repinta el reloj) y oculto a los lectores de pantalla, que reciben la frase.
- Ficha lateral del taller (`FloorPanel.tsx`): bloque «Tiempo en reparación» con el reloj grande, la barra y, si falta, el tiempo estimado con un toque; lista de piezas y trabajos (con importes solo para quien puede verlos); el mecánico con su color.
- «Nueva orden» y detalle de la orden: campo «Tiempo estimado» por botones (`EstimatedTimeField.tsx`).
- Portada del taller: con maqueta, la lista de coches empieza **plegada** para que la escena sea la protagonista (se recuerda lo que elija cada persona). El cambio de estado optimista también mueve el reloj.

## Evidencias

| Comprobación | Resultado |
|---|---|
| `php artisan test --filter="WorkOrderTest\|ContractShapeTest\|DemoSeederTest"` | 125 pasan (2 tests nuevos de tiempos) |
| `php artisan test` (completa) | Ver «Batería completa» abajo |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Código de salida 0 (solo avisos anteriores) |
| `npx vitest run` | 24 archivos, **205 tests pasan** (196 anteriores + 8 de `orderTiming` + 1 del mecánico) |
| `npm run build` | Correcto; `WorkshopCanvas` 34 kB, `three` sin cambios (1.005 kB) |
| Navegador (Playwright, WebGL por software, API :8031 + web :5191, cuenta `taller@`) | De día y de noche a 1440×900: nave, líneas, mecánicos en los 3 elevadores ocupados, cronómetro corriendo, clic en elevador ⇒ la cámara se acerca y se abre la ficha con el reloj. Sin errores de consola salvo el 401 esperado de `/me` |

Capturas: [`2026-11-13-apex-telemetry-fase-2-capturas/`](2026-11-13-apex-telemetry-fase-2-capturas/).

### Batería completa del backend

Resultado al cierre de la fase: **938 tests pasan** (936 anteriores + 2 nuevos).

## Datos de Alberto tocados

- Se aplicó la migración nueva a la base `carcare` (aditiva).
- En el **taller de demostración** se rellenó el tiempo estimado de las órdenes abiertas a partir de sus horas de mano de obra y se puso en hoy el reloj de las que están en diagnóstico o reparación (5 órdenes), para que la demo enseñe el cronómetro. No se tocó nada más.
- MariaDB estaba parada y se arrancó (sigue encendida).

## Limitaciones

- **Sin ver en GPU real.** Todo se comprobó con WebGL por software. El suelo reflectante dibuja la escena dos veces y, con mecánicos trabajando, la maqueta pinta fotogramas de forma continua (antes solo al cambiar algo): hay que medirlo en el equipo de Alberto. Si fuera lento, lo primero es bajar `resolution` del reflejo en `WorkshopCanvas.tsx`.
- La luz de la escena todavía no sigue al sol (solo cambia el fondo y la paleta día/noche).
- Los mecánicos son figuras sencillas; todos los de la demo son la misma persona (Andrés), así que salen con el mismo color.
- El cronómetro es tiempo de reloj en el estado: una orden que pasa la noche «En reparación» suma esas horas. Está dicho en la interfaz y en el contrato.
- No se ha pasado axe ni hay pruebas E2E. Sin revisar a 1024–1279 px (hoja inferior) ni la rejilla de botones del móvil con los campos nuevos.
- `.impeccable/design.json` sigue sin regenerar.

## Siguiente paso

Fase 3 (particular: coche «en el taller», giro 360º y telemetría sin solapes).
