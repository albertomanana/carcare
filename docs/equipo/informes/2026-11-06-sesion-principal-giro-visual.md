# Giro visual «Garaje nocturno vivo» (06/11/2026)

**Objetivo.** Dar a la interfaz un aspecto moderno y más animado, con menos texto, y limpiar el repositorio. Dirección elegida por Alberto: *Garaje nocturno vivo*, alcance «sistema + pantallas clave».

**Método (las tres skills, por capas).**
1. **Taste** (`.agents/skills/design-taste-frontend`): portada con copy plano, un titular, sin kickers ni pies de imagen, hover en tarjetas y capturas, sin animaciones al hacer scroll.
2. **Impeccable** (`.agents/skills/impeccable`, suelo de calidad `craft-floor.md`): sin eyebrow, sin texto degradado, sombras con desplazamiento, un único estilo de panel. Falta `PRODUCT.md` (el lanzador lo pide para `init`; no se creó porque el diseño partía del código existente).
3. **Emil Kowalski** (`emil-design-eng`): curvas `cubic-bezier(0.23,1,0.32,1)`, botones con `scale(0.97)` al pulsar, entradas con cascada de 50-70 ms, hover solo con puntero fino, `prefers-reduced-motion` respetado.

**Cambios.**
- `index.css`: curvas y sombras como tokens, luz ambiente lima en el fondo, utilidades `enter`, `stagger`, `lift`, `zoom`, `link-draw`, `glass`, `surface-card` y componente `list-panel`.
- Botones, tarjetas, pestañas, cabeceras (cristal), barra lateral y superior con indicador de sección que se desliza (`motion`), barra inferior móvil.
- Las 25 listas planas «divide-y border-y» pasan a `list-panel`; los avisos sueltos, a tarjeta.
- Portada reescrita: de 5.762 a 4.739 px de alto a 1280 px; sin la nota de demo repetida tres veces, sin pies de captura, sin «Modelo genérico, sin marca». La nota de capturas de demostración pasa al pie, una vez.
- «Mostrando 2 de 2 …» ya no aparece cuando todo está en pantalla.

**Limpieza.** Retirados el laboratorio 3D (`frontend/three-lab.html`, `src/three/lab`, `src/features/dev`, ruta `/dev/3d`) y las imágenes de capturas antiguas de tres informes (se conservan los `.md` y los scripts). Todo sigue en el historial de git. Consecuencia: las imágenes enlazadas desde esos informes ya no existen, y regenerar el *still* de la portada exige recuperar el laboratorio del historial.

**Evidencias.** `npx tsc -b` sin errores · `npm run test`: 14 archivos, 117 tests en verde · `npm run build` correcto · `npm run lint`: solo avisos que ya existían · capturas a 1280 y 360 px de portada, Inicio, Garaje y ficha sin desborde horizontal (`scrollWidth` = ancho) con el usuario demo, contra una API :8020 con SQLite.

**Limitaciones.** No se revisaron las pantallas del taller ni los diálogos; no se midió el rendimiento de las animaciones; sin E2E ni axe; el tema claro no se ha revisado a mano tras el cambio.

---

## Segunda pasada: «brutalmente 3D» (06/11/2026)

Alberto: la primera pasada «ha empeorado un poco»; pide usar de verdad las skills de Emil (`animate`, `choreograph`, `apple-design`) y que la mayor parte de la interfaz sea 3D.

**Decisión de alcance (reglas 6 y 7 de `CLAUDE.md`).** Un WebGL por tarjeta está prohibido (rendimiento). Por eso:
- **3D real (WebGL)**: un solo lienzo por pantalla. Nuevo `Showroom` en Inicio: el coche del usuario girando en modo `showcase` de `CarViewer`, con selector de vehículo y silueta 2D si no hay WebGL.
- **3D de interfaz (solo CSS y muelles)**: en el resto.

**Cambios.**
- `components/ui/Tilt.tsx`: inclinación con muelle hacia el puntero y brillo, solo con ratón y quieta con movimiento reducido. En tarjetas que llevan a algún sitio (garaje, funciones y capturas de la portada), no en cifras ni tablas.
- Botones como teclas con relieve (canto de 4 px; suben al pasar el ratón y se hunden al pulsar).
- Paneles y listas con grosor (canto + sombra proyectada); entrada de pantallas con perspectiva (`rotateX` + `translateZ`).
- Suelo en perspectiva fijo tras la app y la portada (`.floor`, estático) y en el escaparate (`.floor-local`).
- Capturas de la portada giradas ±17° que se enderezan al pasar el ratón.

**Evidencias.** `tsc -b` limpio · 117 tests en verde · build correcto · lint sin errores. Capturas con ratón: `matrix3d` aplicado en la tarjeta bajo el puntero y paneles en perspectiva visibles.

**Limitaciones.** El WebGL por software de mi entorno no llega a pintar el escaparate (la captura se queda colgada), así que **el coche 3D de Inicio no se ha visto renderizado**; sin WebGL se comprobó la silueta de respaldo. Sin medir rendimiento de las inclinaciones ni revisar el tema claro, el taller y los diálogos.
