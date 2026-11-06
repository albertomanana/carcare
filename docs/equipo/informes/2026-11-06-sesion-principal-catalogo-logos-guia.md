# Informe — sesión interactiva 06/11/2026 (tarde): catálogo, logos, guía luminosa y prototipo 3D

**Estado: terminado** (primera parte por la mañana, segunda tras reiniciar; ver «Continuación» y «Pendiente»).

## Encargo de Alberto (resumen)

1. Interfaz guiada con animaciones, luces parpadeantes y coches 3D.
2. Descargar información predefinida para rellenar vehículos (marca → modelos → versiones).
3. Logos de marcas.
4. Responder si se usan las skills Taste, Impeccable y Emil.
5. Ejecutar el prompt del «Dashboard 3D de taller» (un único `index.html` con Three.js + GSAP + Tailwind CDN).

## Hecho (primera parte)

| Punto | Estado | Detalle |
|-------|--------|---------|
| 2 Catálogo | ✅ hecho y probado | `scripts/generar-catalogo.mjs` → `frontend/src/data/catalogo-vehiculos.json`; `frontend/src/lib/catalog.ts` (carga diferida). Ver `docs/arquitectura/catalogo-vehiculos.md` |
| 3 Logos | ✅ hecho y probado | `scripts/descargar-logos.mjs` (42 SVG en `frontend/public/img/marcas/`), `BrandLogo` (máscara CSS monocroma + monograma de respaldo), usado en el formulario, `VehicleCard` y cabecera de `VehicleDetailPage` |
| 1 Guía / luces / 3D | ✅ parcial | Formulario de vehículo: fichas de marca con logo, modelos y versiones sugeridos, autorrelleno, anillo luminoso `Guide` (`.guide-ring`, 3 latidos) sobre lo que toca, coche 3D en **todos** los pasos. `CarModel` admite `signal` (`hazard` = intermitentes ámbar 1,5 Hz durante 4 s si «Siguiente» falla por validación; `flash` = 2 destellos al elegir marca/modelo/versión). Con movimiento reducido no hay señales |
| 4 Skills | ✅ respondido | En esta sesión se cargaron `emil-design-eng` y `animate` (Skill), y se leyeron `SKILL.md` de Impeccable y Taste y su `craft-floor`. Ver «Respuesta sobre las skills» |

## Continuación (06/11/2026, después de reiniciar)

Hecho en esta segunda parte:

1. **Prototipo del prompt** → `frontend/public/prototipos/taller-3d/index.html` (se abre en `/prototipos/taller-3d/index.html` con el servidor de Vite, o directamente como archivo). Un solo HTML con Three.js 0.160 + OrbitControls + CSS2DRenderer, GSAP 3.12.5 y Tailwind 3.4.16 por CDN (versiones fijas). Modelos procedurales (`ExtrudeGeometry` para carrocería y engranajes, `EdgesGeometry` para el estilo holográfico). Incluye: niebla `FogExp2` #07090e y suelo con cuadrícula neón; 4 zonas (recepción con avatares y coches que entregan en una calzada, 3 elevadores que suben y bajan, cabina de diagnóstico con coche holográfico de ruedas giratorias y bloques motor/frenos/batería/transmisión/depósito que laten en verde o rojo, inventario con estanterías y piezas flotantes); barras y anillos 3D que se elevan al pasar el cursor; paneles glassmorphism con `perspective` y tilt 3D con reflejo; menú de 4 vistas con barrido de cámara en arco (GSAP sobre `camera.position` y `controls.target`) y paneles que entran y salen rotando; partículas, iconos 3D giratorios y telemetría que sale de la propia simulación. **Todo rotulado como «Datos de demostración» / «simulado»** (regla 2). Teclas 1–4, `aria-pressed`, región `aria-live`, `prefers-reduced-motion`, alternativa HTML a la escena, y respaldo si no hay WebGL.
   - **Excepción a la regla 8, justificada:** usa CDN a propósito porque el encargo pedía un único `index.html`. Es un prototipo aislado en `public/`; la app real no depende de esas librerías.
2. **Guía luminosa extendida:** el primer paso de «Primeros pasos» (`FirstSteps`) y el botón «Añadir vehículo» del garaje vacío llevan el anillo `Guide`; el garaje vacío muestra además un coche 3D de bienvenida cuyos intermitentes avisan unos segundos (no con movimiento reducido).
3. **Intermitentes visibles:** las luces del modelo son franjas finas y, a tamaño de formulario, el cambio de emisivo apenas se veía (medido: 0–9 píxeles ámbar). `CarModel` dibuja ahora cuatro esferas ámbar con halo aditivo mientras dura la señal (solo existen con señal). Tras agrandarlas se vuelve a ver el patrón encendido/apagado y que termina a los 4 s, pero **no se ha comprobado a ojo en una GPU real**: SwiftShader va lento y los fotogramas capturados no son una grabación.
4. **Responsive y teclado del formulario:** a 360, 768 y 1280 px sin desborde horizontal (0 px); fichas de marca de 59×64, 138×64 y 115×64 px; botón «Siguiente» de 328×44 px en móvil. Solo teclado: escribir «Toyo» → Tab → Enter elige Toyota; «Corol» → Tab Tab → Enter elige Corolla; aparecen 8 versiones y el anillo guía. En móvil la vista previa baja a `h-32` para que el campo Marca quede a la vista.
5. **Tests:** `frontend/src/lib/catalog.test.ts` (6 tests: búsqueda, modelos, versiones por año, catálogo generado, existencia de cada logo, monograma).
6. **Detector de Impeccable** (`impeccable detect --json`) sobre los archivos cambiados: sin hallazgos en el código de la app salvo el aviso `codex-grid-background` de `index.css` (el suelo en perspectiva del giro visual anterior, ya existía). En el prototipo quedan `dark-glow` y `nested-cards`: el resplandor neón lo pide el encargo; se subió el texto de 10 a 11 px.
7. Se quitó el CSS sin uso `.blink-lamp`.

## Pendiente

1. **Decidir con Alberto:** ¿mantener los logotipos de marcas registradas? ¿Linkar el prototipo desde la app o dejarlo solo como demostración? (también en «Preguntas para Alberto»).
2. Ver los intermitentes en una GPU real (basta abrir el formulario de vehículo y pulsar «Siguiente» sin marca).
3. Revisar la lista editorial de modelos europeos; añadir acabados españoles si Alberto consigue una fuente fiable (la EPA no los trae).
4. Documentar como ADR (`arquitecto`) el catálogo y los logos si se mantienen.
5. Probar el prototipo en un móvil real (solo se probó con Chromium a 390 px) y, si se quiere llevar al producto, rehacerlo en React Three Fiber dentro de `frontend/src/three/` en vez de CDN.
6. Pendiente del entorno: la BD local no tenía la tabla `notifications` (500 en notificaciones); **MariaDB estaba parada tras el reinicio** y la arranqué a mano con `C:\xampp\mysql\bin\mysqld.exe --defaults-file=my.ini --standalone`.

## Evidencias

- `node scripts/generar-catalogo.mjs <csv>` → «97 marcas, 1063 modelos, 6299 versiones (27538 filas EPA ≥ 2005) → 632 KB» (49 KB gzip).
- `node scripts/descargar-logos.mjs` → «simple-icons 13.21.0: 42 logotipos descargados».
- `npm run typecheck` → sin errores. `npm run test` → **14 archivos, 117 tests pasan**. `npm run lint` (oxlint) → solo avisos, ninguno nuevo de tipo error (los de `CarModel`/`VehicleFormPage` son del mismo tipo que los previos).
- Playwright (script en el scratchpad de la sesión, no en el repo) contra instancia aislada API :8031 + web :5191, cuenta `demo@carcare.test`: 10 fichas de marca con logo; Volkswagen → 12 modelos sugeridos; «Golf/GTI» + año 2018 → 5 versiones; elegir la primera rellena versión «1.8 L 4 cil. turbo · Automático», motor «1.8 L 4 cil. turbo», combustible `gasoline`, cambio `automatic`; «Siguiente» sin marca muestra los errores. Con WebGL (SwiftShader) el lienzo carga y **no hay errores de página**.
- Segunda parte: `npm run typecheck` sin errores; `npm run test` → **15 archivos, 123 tests pasan**; `npm run build` OK (el catálogo sale en su propio fragmento de 590 KB sin comprimir, ~49 KB gzip). Prototipo en Chromium con SwiftShader a 1280 y 390 px: sin errores de consola salvo el aviso de Tailwind CDN; las 4 vistas cargan, el tilt aplica `matrix3d`, la telemetría y el reloj se mueven.
- Capturas: solo en el scratchpad (no versionadas).

## Hallazgos fuera de alcance

- Archivos nuevos de la segunda parte: `frontend/public/prototipos/taller-3d/index.html`, `frontend/src/lib/catalog.test.ts`. Editados: `GaragePage.tsx`, `FirstSteps.tsx`, `CarModel.tsx` (faros de aviso), `index.css` (se quitó `.blink-lamp`), `VehicleFormPage.tsx` (vista previa `h-32` en móvil).

- La BD local `carcare` **no tiene la tabla `notifications`** (migración sin aplicar): `GET` de notificaciones da 500 en `php artisan serve` y en la :8031. No lo he tocado (BD de Alberto). Probablemente `php artisan migrate` lo arregla.
- El catálogo de la EPA llama «Golf/GTI», «3 Series»…: es el nombre de la fuente.

## Archivos tocados

- Nuevos: `scripts/generar-catalogo.mjs`, `scripts/descargar-logos.mjs`, `frontend/src/data/catalogo-vehiculos.json`, `frontend/public/img/marcas/*.svg`, `frontend/src/lib/catalog.ts`, `frontend/src/components/vehicles/BrandLogo.tsx`, `frontend/src/components/ui/Guide.tsx`, `docs/arquitectura/catalogo-vehiculos.md`.
- Editados: `frontend/src/lib/brands.ts` (logos y monograma), `frontend/src/features/vehicle/VehicleFormPage.tsx` (StepVehicle nuevo, vista previa siempre visible, señales), `frontend/src/features/vehicle/VehicleDetailPage.tsx`, `frontend/src/components/vehicles/VehicleCard.tsx`, `frontend/src/index.css` (`.guide-ring`, `.blink-lamp`).
- **Zona de `experto-3d` tocada sin agente** (aviso según el protocolo): `frontend/src/three/car/CarModel.tsx` (prop `signal`, materiales de luces clonados mientras dura la señal), `frontend/src/three/types.ts` (`CarSignal`, `CarPreviewProps.signal`), `frontend/src/three/scenes/CarPreviewCanvas.tsx`.
- `frontend/src/index.css` `.blink-lamp` **no se usa todavía** (sobrante; usarlo o borrarlo).

## Respuesta sobre las skills (para Alberto)

Alberto notó poco las skills. Causa: en el giro del 06/11 por la mañana se aplicaron por capas (Taste → Impeccable → Emil) pero sobre todo en tokens y movimiento sutil, y Taste/Impeccable no aparecen en la lista de Skill, así que hay que leerlas a mano. En esta sesión de la tarde: Emil (`emil-design-eng`, `animate`) se cargó y guio el movimiento (curvas `--ease-out-strong`, ≤ 220 ms, `active:scale-[0.97]`, entradas escalonadas de 25–30 ms, sin `scale(0)`, `prefers-reduced-motion` incluido, solo `transform`/`opacity`); Impeccable se leyó y su `craft-floor` guio las comprobaciones, pero **no se ejecutó `detect`**; Taste se leyó pero es para webs de empresa/landing, apenas aplica a pantallas de la app.

## Cómo arrancar el entorno de pruebas

```bash
git status                      # debería estar limpio salvo .agents/ y skills-lock.json
cd backend/public && SANCTUM_STATEFUL_DOMAINS=localhost:5191,127.0.0.1:5191 php -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8031 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
cd frontend && VITE_API_TARGET=http://127.0.0.1:8031 npx vite --port 5191 --strictPort
```

Si MySQL no responde tras reiniciar: `cd C:/xampp/mysql/bin && ./mysqld.exe --defaults-file=my.ini --standalone &`.

## Commits

Por área en `develop`, según `CONTRIBUTING.md`.
