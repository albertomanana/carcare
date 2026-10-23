# CarCare — reglas del proyecto

CarCare es una plataforma SaaS para gestionar la vida de un vehículo, con interfaz 3D interactiva. Tiene **dos modos** sobre la misma base:

- **Particular** (espacio `personal`): garaje propio, seguimiento día a día (kilometraje, repostajes, gastos), historial de intervenciones, recordatorios, documentos, analítica e informe exportable.
- **Taller / flota** (espacio `workshop`): clientes, flota de vehículos, órdenes de trabajo en tablero kanban, elevadores en un taller 3D, equipo con roles y facturación.

Es el TFG de DAW (Ilerna) de Alberto y un posible producto comercial. Idioma de la interfaz y de la documentación: **español**.

## Estructura y propietarios

| Ruta | Contenido | Agente propietario |
|------|-----------|--------------------|
| `backend/` | API Laravel 12 (PHP 8.2), MySQL/MariaDB | `backend-laravel` |
| `frontend/src/three/` | Escenas y modelos 3D (React Three Fiber) | `experto-3d` |
| `frontend/` (resto) | SPA React 19 + TypeScript + Vite 8 + Tailwind 4 | `frontend-react` |
| `frontend/src/api/types.ts` | **Contrato de tipos de la API** | `arquitecto` (los demás proponen cambios) |
| `docs/api/contrato-v1.md` | Contrato de endpoints, permisos y reglas | `arquitecto` |
| `docs/arquitectura/` | Decisiones de arquitectura (ADR) | `arquitecto` |
| `docs/tfg/` | Memoria, diagramas, manuales | `documentador-tfg` |
| `docs/equipo/` | Guía del equipo, tablero e informes | todos escriben su informe |
| `frontend/e2e/`, `backend/tests/` (revisión) | Pruebas E2E y auditorías de calidad | `qa-tester` |
| `CarCare/` | Planificación: backlog, decisiones, sesiones, ideas | `producto` |
| `Car_Care_Documentacion/` | Documentación original del proyecto | **solo lectura** |

Un agente **no edita archivos fuera de su zona** sin decirlo en su informe. Si necesita un cambio en otra zona, lo pide en `docs/equipo/TABLERO.md` (sección "Peticiones entre agentes").

## Comandos

```bash
# API en http://127.0.0.1:8000 CON OPcache (desde la raíz). Usar esto, no "php artisan serve":
cmd.exe //c scripts\\servidor-api.cmd   # XAMPP trae OPcache desactivado: sin él cada petición tarda ~10 veces más

# Backend (desde backend/)
php artisan migrate:fresh --seed     # BD limpia + datos demo
php artisan test                     # tests (SQLite en memoria)
../.tools/composer require paquete   # Composer NO está en el PATH: usar este envoltorio

# Frontend (desde frontend/)
npm run dev          # http://localhost:5173 (reenvía /api y /sanctum a :8000)
npm run build        # typecheck + build de producción
npm run typecheck
npm run lint
npm run test         # Vitest
npm run test:e2e     # Playwright (necesita backend y frontend arrancados)
```

## Particularidades de este equipo (Windows + XAMPP)

- PHP 8.2.12 y MariaDB 10.4 vienen de XAMPP (`C:\xampp`). MySQL escucha en 3306, usuario `root` sin contraseña, BD `carcare`.
- PHP 8.2 ⇒ Laravel 12 (Laravel 13 exige PHP 8.3). No usar funciones que requieran la extensión `intl` en tiempo de ejecución (no está activada en php.ini): el formateo de números y fechas se hace en el frontend con `Intl`.
- **Los archivos `.env` no se pueden leer** (regla de permisos del usuario). Para cambiar configuración: añadir la clave a `config/*.php` con valor por defecto, o reescribir `.env` completo sin leerlo. Nunca imprimir secretos.
- `rm -rf` está bloqueado: borrar archivos concretos con `rm archivo`.
- Shell: Git Bash. Rutas con `/`.

## Reglas de oro

1. **Contrato primero.** Las formas JSON están en `frontend/src/api/types.ts` y las reglas en `docs/api/contrato-v1.md`. El backend las cumple al pie de la letra; el frontend no inventa campos. Un cambio de contrato se propone, se aprueba y se anota en su historial.
2. **Ninguna cifra ni función sin fuente real.** Si falta un dato se dice ("Faltan datos para calcular el coste por km") y se ofrece la acción que lo resuelve. Nada de "health score", desgaste "medido", diagnósticos ni integraciones que no existen. El estado de zonas se etiqueta siempre como *"según tus intervalos, no medido"*.
3. **Autorización en el servidor, siempre.** Cada recurso se resuelve a través de su espacio de trabajo y el rol del usuario. Recursos ajenos ⇒ 404. Hay un test de aislamiento por endpoint.
4. **Dinero en DECIMAL** y como string en JSON. Kilometraje entero ≥ 0 con control de retrocesos.
5. **Ningún botón decorativo.** Cada control hace lo que promete o no se muestra.
6. **Accesible y responsive**: teclado, foco visible, contraste AA, `prefers-reduced-motion`, 360/768/1280 px. El 3D siempre tiene alternativa 2D y su información también existe en HTML accesible.
7. **Rendimiento**: three.js se carga de forma diferida; un solo `<Canvas>` por pantalla; listados con miniaturas estáticas, no con un WebGL por tarjeta.
8. **Sin dependencias innecesarias.** Antes de añadir una, justificarla en el informe.
9. **No declarar nada terminado sin probarlo.** Informar de resultados reales de tests y build; si algo no se probó, decirlo.
10. **No borrar ni reescribir trabajo existente** sin explicar el motivo. Nunca tocar `Car_Care_Documentacion/`.
11. **Git:** se trabaja en la rama `develop` y cada sesión termina con commits (uno por área, Conventional Commits en español) y `push`, según [`CONTRIBUTING.md`](CONTRIBUTING.md). `main` solo cambia por PR al cerrar un hito y con el visto bueno de Alberto. Los agentes no hacen commit: lo hace la sesión que los dirige al terminar.

## Definición de terminado (por historia)

Flujo principal funciona con datos persistidos · autorización probada en backend · validación en cliente y servidor · estados de carga, vacío y error · responsive (360, 768, 1280) · accesible por teclado · tests pasando · limitaciones anotadas en el informe.

## Protocolo del equipo

Cada agente, al terminar un encargo:
1. Escribe un informe en `docs/equipo/informes/AAAA-MM-DD-<agente>-<tema>.md` con: objetivo, qué hizo, archivos tocados, **evidencias** (comandos ejecutados y su resultado), limitaciones y siguiente paso propuesto.
2. Actualiza su fila en `docs/equipo/TABLERO.md`.
3. Devuelve un resumen breve al líder (Alberto o la sesión principal).

**Dudas:** si algo solo lo puede decidir Alberto (gustos de diseño, alcance, prioridades, el TFG), no lo decidas tú: escríbelo en "Preguntas para Alberto" de `docs/equipo/TABLERO.md` con opciones y tu recomendación, inclúyelo en tu resumen y sigue con lo que no dependa de la respuesta. Alberto ha pedido expresamente que le consultéis.

Guía completa para dirigir al equipo: [`docs/equipo/GUIA-LIDERAZGO.md`](docs/equipo/GUIA-LIDERAZGO.md).

**Piloto automático:** cada hora (y al iniciar Windows) una sesión no interactiva trabaja según la cola de [`docs/equipo/AUTOPILOTO.md`](docs/equipo/AUTOPILOTO.md). La sesión interactiva pone su fila del tablero ("Sesión interactiva") en `En curso` con la hora al empezar y en `Libre` al terminar, y mantiene la cola al día (marca `Hecho` lo que termine). Así el piloto no pisa el trabajo en directo.

## Decisiones vigentes

Ver `docs/arquitectura/` (ADR) y `CarCare/03_decisiones/registro-decisiones.md`. Resumen:
- ADR‑0001 API REST Laravel + SPA React separadas (monorepo).
- ADR‑0002 Espacios de trabajo `personal`/`workshop` con roles owner/manager/mechanic.
- ADR‑0003 Intervención con coste ⇒ gasto vinculado (sin doble conteo), solo en espacios personales.
- ADR‑0004 Vehículo representado con modelo 3D procedural propio (sin marcas ni modelos con licencia), con silueta SVG de respaldo.
