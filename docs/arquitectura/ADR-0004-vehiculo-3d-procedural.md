# ADR‑0004 · Vehículo en 3D procedural propio, con silueta 2D de respaldo

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (21/10/2026) |
| Sustituye | D4 del plan inicial v1 (silueta SVG) — la silueta queda como respaldo |

## Contexto
Alberto quiere una interfaz "muy interactiva en 3D". Los modelos 3D de coches reales tienen marcas registradas y licencias; descargarlos en tiempo de ejecución añade dependencia externa y peso.

## Decisión
- El coche se **genera por código** con three.js (React Three Fiber): perfil lateral por tipo de carrocería (9 tipos), extruido con bisel, ruedas, lunas, faros y pilotos. Se tiñe con `color_hex` del vehículo. Sin logotipos ni formas de modelos concretos.
- Iluminación de estudio con `Lightformer` (sin descargar HDRIs externos).
- **Zonas interactivas** (motor, frenos, neumáticos…) conectadas a `GET /vehicles/{id}/zones`. Su color refleja recordatorios del usuario, etiquetado como *"según tus intervalos, no medido"*.
- Vista **rayos X ilustrativa** (componentes internos simplificados), marcada como ilustración.
- **Taller 3D**: nave con elevadores numerados y los coches de las órdenes abiertas.
- Respaldo: silueta SVG si no hay WebGL; `prefers-reduced-motion` desactiva autorrotación y transiciones de cámara; toda la información del 3D existe también en HTML accesible.
- Rendimiento: three.js en un chunk diferido, un único `<Canvas>` por pantalla, `frameloop="demand"` cuando la escena está quieta, DPR limitado, miniaturas estáticas en listados.

## Consecuencias
- Cero problemas de licencias y cero descargas externas en tiempo de ejecución.
- El realismo es estilizado, no fotográfico: encaja con la estética premium/tecnológica.
- Más código propio que mantener en `frontend/src/three/`.

## Cómo defenderlo
Uso de WebGL con un enfoque procedural, accesible y con degradación elegante; la estética nunca sustituye a datos reales.
