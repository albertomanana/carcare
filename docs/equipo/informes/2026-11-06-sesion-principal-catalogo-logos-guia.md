# Informe — sesión interactiva 06/11/2026 (tarde): catálogo, logos, guía luminosa y prototipo 3D

**Estado: TRABAJO A MEDIAS (Alberto apagó el ordenador ~12:00).** Este informe sirve para retomar.

## Encargo de Alberto (resumen)

1. Interfaz guiada con animaciones, luces parpadeantes y coches 3D.
2. Descargar información predefinida para rellenar vehículos (marca → modelos → versiones).
3. Logos de marcas.
4. Responder si se usan las skills Taste, Impeccable y Emil.
5. Ejecutar el prompt del «Dashboard 3D de taller» (un único `index.html` con Three.js + GSAP + Tailwind CDN).

## Hecho (todo sin commitear hasta este informe; ver «Commits»)

| Punto | Estado | Detalle |
|-------|--------|---------|
| 2 Catálogo | ✅ hecho y probado | `scripts/generar-catalogo.mjs` → `frontend/src/data/catalogo-vehiculos.json`; `frontend/src/lib/catalog.ts` (carga diferida). Ver `docs/arquitectura/catalogo-vehiculos.md` |
| 3 Logos | ✅ hecho y probado | `scripts/descargar-logos.mjs` (42 SVG en `frontend/public/img/marcas/`), `BrandLogo` (máscara CSS monocroma + monograma de respaldo), usado en el formulario, `VehicleCard` y cabecera de `VehicleDetailPage` |
| 1 Guía / luces / 3D | ✅ parcial | Formulario de vehículo: fichas de marca con logo, modelos y versiones sugeridos, autorrelleno, anillo luminoso `Guide` (`.guide-ring`, 3 latidos) sobre lo que toca, coche 3D en **todos** los pasos. `CarModel` admite `signal` (`hazard` = intermitentes ámbar 1,5 Hz durante 4 s si «Siguiente» falla por validación; `flash` = 2 destellos al elegir marca/modelo/versión). Con movimiento reducido no hay señales |
| 4 Skills | ✅ respondido | En esta sesión se cargaron `emil-design-eng` y `animate` (Skill), y se leyeron `SKILL.md` de Impeccable y Taste y su `craft-floor`. Ver «Respuesta sobre las skills» |

## Pendiente (siguiente paso, por orden)

1. **Prototipo del prompt (punto 5): NO empezado.** Plan: `frontend/public/prototipos/taller-3d/index.html` (se sirve en `/prototipos/taller-3d/index.html` en desarrollo). Un solo archivo con Three.js, OrbitControls, GSAP y Tailwind por CDN (versiones fijas ≥ 2 semanas), geometrías procedurales, niebla `FogExp2` #07090e, suelo neón, 3 zonas (recepción con avatares, elevadores, cabina de diagnóstico con coche holográfico con bloques motor/frenos/batería que laten en rojo/verde), tarjetas glassmorphism con tilt 3D CSS, barras/anillos 3D, menú de 4 vistas con GSAP (cámara + `controls.target`), bucle `animate()` vivo. **Rotular los datos como «Datos de demostración»** (regla 2). Anotar en el informe que usa CDN a propósito (excepción a la regla 8, es un prototipo aislado).
2. Extender la guía luminosa: `FirstSteps` (anillo en el paso siguiente), estado vacío del garaje con coche 3D y luces, y el taller 3D.
3. Verificar **visualmente** los intermitentes con WebGL (la prueba solo comprobó que el lienzo carga sin errores de página; no se confirmó fotograma a fotograma el color ámbar).
4. Probar el formulario a 360 y 768 px (solo se probó a 1280) y con teclado; revisar contraste de las fichas de marca.
5. Pasar `impeccable detect --json` sobre los archivos cambiados (no se ha ejecutado) y revisión de movimiento (Emil).
6. Test Vitest para `catalog.ts` y `brands.ts` (`brandLogoUrl`, `brandMonogram`, `versionsFor`); no se han escrito.
7. Decidir con Alberto: ¿mantener logos de marcas registradas? (ver preguntas en el tablero). Anotar ADR si se mantiene.
8. Revisar la lista editorial de modelos europeos (puede tener omisiones).

## Evidencias

- `node scripts/generar-catalogo.mjs <csv>` → «97 marcas, 1063 modelos, 6299 versiones (27538 filas EPA ≥ 2005) → 632 KB» (49 KB gzip).
- `node scripts/descargar-logos.mjs` → «simple-icons 13.21.0: 42 logotipos descargados».
- `npm run typecheck` → sin errores. `npm run test` → **14 archivos, 117 tests pasan**. `npm run lint` (oxlint) → solo avisos, ninguno nuevo de tipo error (los de `CarModel`/`VehicleFormPage` son del mismo tipo que los previos).
- Playwright (script en el scratchpad de la sesión, no en el repo) contra instancia aislada API :8031 + web :5191, cuenta `demo@carcare.test`: 10 fichas de marca con logo; Volkswagen → 12 modelos sugeridos; «Golf/GTI» + año 2018 → 5 versiones; elegir la primera rellena versión «1.8 L 4 cil. turbo · Automático», motor «1.8 L 4 cil. turbo», combustible `gasoline`, cambio `automatic`; «Siguiente» sin marca muestra los errores. Con WebGL (SwiftShader) el lienzo carga y **no hay errores de página**.
- Capturas del escaparate: solo en el scratchpad (no versionadas).

## Hallazgos fuera de alcance

- La BD local `carcare` **no tiene la tabla `notifications`** (migración sin aplicar): `GET` de notificaciones da 500 en `php artisan serve` y en la :8031. No lo he tocado (BD de Alberto). Probablemente `php artisan migrate` lo arregla.
- El catálogo de la EPA llama «Golf/GTI», «3 Series»…: es el nombre de la fuente.

## Archivos tocados

- Nuevos: `scripts/generar-catalogo.mjs`, `scripts/descargar-logos.mjs`, `frontend/src/data/catalogo-vehiculos.json`, `frontend/public/img/marcas/*.svg`, `frontend/src/lib/catalog.ts`, `frontend/src/components/vehicles/BrandLogo.tsx`, `frontend/src/components/ui/Guide.tsx`, `docs/arquitectura/catalogo-vehiculos.md`.
- Editados: `frontend/src/lib/brands.ts` (logos y monograma), `frontend/src/features/vehicle/VehicleFormPage.tsx` (StepVehicle nuevo, vista previa siempre visible, señales), `frontend/src/features/vehicle/VehicleDetailPage.tsx`, `frontend/src/components/vehicles/VehicleCard.tsx`, `frontend/src/index.css` (`.guide-ring`, `.blink-lamp`).
- **Zona de `experto-3d` tocada sin agente** (aviso según el protocolo): `frontend/src/three/car/CarModel.tsx` (prop `signal`, materiales de luces clonados mientras dura la señal), `frontend/src/three/types.ts` (`CarSignal`, `CarPreviewProps.signal`), `frontend/src/three/scenes/CarPreviewCanvas.tsx`.
- `frontend/src/index.css` `.blink-lamp` **no se usa todavía** (sobrante; usarlo o borrarlo).

## Respuesta sobre las skills (para Alberto)

Alberto notó poco las skills. Causa: en el giro del 06/11 por la mañana se aplicaron por capas (Taste → Impeccable → Emil) pero sobre todo en tokens y movimiento sutil, y Taste/Impeccable no aparecen en la lista de Skill, así que hay que leerlas a mano. En esta sesión de la tarde: Emil (`emil-design-eng`, `animate`) se cargó y guio el movimiento (curvas `--ease-out-strong`, ≤ 220 ms, `active:scale-[0.97]`, entradas escalonadas de 25–30 ms, sin `scale(0)`, `prefers-reduced-motion` incluido, solo `transform`/`opacity`); Impeccable se leyó y su `craft-floor` guio las comprobaciones, pero **no se ejecutó `detect`**; Taste se leyó pero es para webs de empresa/landing, apenas aplica a pantallas de la app.

## Cómo retomar

```bash
git status                      # debería estar limpio salvo .agents/ y skills-lock.json
cd backend/public && SANCTUM_STATEFUL_DOMAINS=localhost:5191,127.0.0.1:5191 php -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8031 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
cd frontend && VITE_API_TARGET=http://127.0.0.1:8031 npx vite --port 5191 --strictPort
```

Luego seguir por el punto 1 de «Pendiente» (prototipo `index.html`).

## Commits

Locales en `develop`, **sin `push`** (Alberto apagó el equipo; hacer `git push` al retomar si está de acuerdo).
