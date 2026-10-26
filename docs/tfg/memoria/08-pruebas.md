# 8. Pruebas

> Este capítulo solo recoge resultados de ejecuciones documentadas en un informe de `docs/equipo/informes/`, con su fecha y su comando. Lo que no se ha ejecutado figura como pendiente y no se adelanta ningún resultado. El plan completo, con los casos previstos, está en [`docs/tfg/07-plan-de-pruebas.md`](../07-plan-de-pruebas.md).

## 8.1 Estrategia

Las pruebas se organizan por niveles. La tabla indica cuáles existen a 26/10/2026.

| Nivel | Qué comprueba | Herramienta | Estado a 26/10/2026 |
|-------|---------------|-------------|---------------------|
| API (*feature*) | Cada endpoint por HTTP: camino feliz, validación (422), roles (403), conflictos (409), forma JSON del contrato y reglas de negocio | Pest 3 sobre SQLite en memoria | **Hecho:** 14 archivos, 462 casos |
| Aislamiento | Un usuario ajeno recibe 404 en cada ruta con recurso; sin sesión, 401 | Pest, *datasets* de rutas | **Hecho:** dentro de `IsolationTest` |
| Misma batería sobre MariaDB | Que el comportamiento no dependa de SQLite | Pest contra una base `carcare_test` | **Hecho una vez** (23/10) |
| Unitarias del backend | Reglas puras sin HTTP | Pest | **No existen:** `tests/Unit` está vacío; todo se prueba a través de la API |
| Cliente | Funciones de cálculo y formato, y que el módulo 3D ligero no importe three.js | Vitest 4 | **Hecho:** 5 archivos, 44 pruebas |
| Estáticas | Tipos y estilo | `tsc`, oxlint | **Hecho** |
| Extremo a extremo | Recorridos completos con backend y frontend reales, en 360, 768 y 1280 px | Playwright | **Pendiente:** no existe `frontend/e2e/` |
| Accesibilidad | WCAG 2.2 AA automática y revisión manual | `@axe-core/playwright` | **Pendiente** |
| Rendimiento 3D | Carga diferida, un lienzo por pantalla, escena quieta, respaldo sin WebGL | *Build* + Playwright | **Medición inicial** (23/10); falta la final |
| Seguridad | Revisión independiente de aislamiento, roles, ficheros, sesión y dependencias | Agente `seguridad` | **Pendiente** |
| Integración continua | Ejecutar todo lo anterior en cada envío al repositorio | GitHub Actions | **Pendiente:** no existe `.github/workflows/` |
| Con usuarios | Comprensión y uso sin ayuda | Guion de pruebas | **Pendiente** (capítulo 12) |

**Por qué casi todo se prueba a través de la API.** Las reglas que más importan (aislamiento, dinero, kilometraje, gasto vinculado, numeración) dependen de la base de datos y de las transacciones. Probarlas por HTTP, con la base de datos real en memoria, comprueba a la vez la ruta, la *policy*, la validación, el servicio y la forma de la respuesta. El precio es que no hay pruebas unitarias aisladas de `Money` o de los enumerados: se cubren indirectamente, con importes y casos límite conocidos en las pruebas de la API.

## 8.2 Infraestructura

- **Backend.** `backend/phpunit.xml` configura SQLite en memoria; cada prueba parte de una base vacía (`RefreshDatabase`) y crea sus datos con factorías y funciones auxiliares (`world()`, `makeUser()`, `makeVehicle()` en `tests/Pest.php`). Los ficheros se prueban sobre un disco falso (`Storage::fake`).
- **Forma del contrato.** `backend/tests/Support/Contract.php` escribe cada interfaz de `frontend/src/api/types.ts` como una especificación comprobable (`'money'`, `'date'`, `'?int'`, `'enum:a,b'`…). `ContractShapeTest` compara cada respuesta real con su especificación clave a clave y tipo a tipo, comprueba que las claves coinciden con las de la interfaz homónima de `types.ts` y que cada enumerado de PHP tiene los mismos valores que su unión de literales en TypeScript.
- **Frontend.** Vitest con jsdom (`frontend/package.json`). Playwright y `@axe-core/playwright` están declarados como dependencias, pero todavía no hay configuración ni pruebas.

## 8.3 Resultados del backend

### Ejecuciones documentadas

| Fecha | Comando | Motor | Resultado | Duración | Fuente |
|-------|---------|-------|-----------|----------|--------|
| 23/10/2026 | `php artisan test` | SQLite en memoria | **462 pruebas superadas, 6.959 aserciones** | 32,75 s | [Informe del backend](../../equipo/informes/2026-10-23-backend-laravel-api-v1.md), §6 |
| 23/10/2026 | `DB_CONNECTION=mysql … DB_DATABASE=carcare_test php artisan test` | MariaDB 10.4.32 | **462 pruebas superadas, 6.959 aserciones** | 134,23 s | ídem |
| 25/10/2026 | `cd backend && php artisan test` | SQLite en memoria | **462 pruebas superadas, 6.934 aserciones** | — | [Informe de cierre](../../equipo/informes/2026-10-25-sesion-principal-cierre.md) |

Entre la segunda y la tercera ejecución cambió el *seeder* de demostración (commit `92ad333`, que también tocó `Contract.php`). El informe de cierre no explica la diferencia de 25 aserciones; el número de pruebas es el mismo. La batería no se ha vuelto a ejecutar sobre MariaDB desde el 23/10.

> [PENDIENTE: tareas 27, 28 y 29 — el 26/10 otro agente estaba añadiendo pruebas (`MileageSourceTest`, `PasswordResetTest`). Actualizar esta tabla con la ejecución que cierre esas tareas, en SQLite y en MariaDB.]

### Desglose por archivo (ejecución del 23/10)

Los 152 bloques `it()` o `test()` de los 14 archivos (contados con `grep` sobre el commit `e530d3e`) se expanden a 462 casos porque varios usan *datasets*: por ejemplo, la prueba de aislamiento se ejecuta una vez por ruta.

| Archivo | Casos | Qué cubre |
|---------|------:|-----------|
| `IsolationTest` | 215 | 404 a un usuario de otro espacio en las 58 rutas con recurso; 401 sin sesión en todas las rutas no públicas; gerente y mecánico del taller no ven el garaje personal de la propietaria; rutas de taller con 404 en un espacio personal; un intruso no modifica nada; la lista de casos coincide con `route:list` |
| `ContractShapeTest` | 67 | Forma JSON de cada interfaz de respuesta frente a `types.ts`; enumerados PHP frente a TypeScript |
| `ValidationTest` | 35 | 422 representativos en español en cada formulario y filtro, sin trazas ni SQL |
| `RolesTest` | 22 | El mecánico recibe 403 en gastos, analítica, archivar y borrar vehículos, borrar clientes y órdenes, ajustes y miembros; ve `revenue: null`; el gerente no borra el taller ni toca al propietario |
| `ReminderTest` | 22 | Estado y progreso en los límites, recurrencia (incluido 31/01 + 1 mes = 28/02), completar y descartar |
| `AnalyticsTest` | 19 | Resumen, coste por km con sus motivos de "faltan datos", consumo lleno a lleno (gasolina y kWh), diario, zonas, panel y analítica, sin doble conteo |
| `MaintenanceExpenseTest` | 18 | Gasto vinculado: creación, actualización, archivo, restauración, 409 al editarlo desde gastos; orden del historial |
| `WorkOrderTest` | 16 | Numeración `OT-AAAA-NNNN` sin huecos y por año, IVA, elevador ocupado (409), estados finales, entrega con intervención, km de entrada |
| `VehicleTest` | 10 | Alta, matrícula y VIN únicos, archivado y borrado en cascada con sus ficheros |
| `AuthTest` | 11 | Registro, inicio de sesión, límite de intentos, perfil, contraseña y baja de la cuenta |
| `MileageTest` | 8 | Retroceso con 422 y confirmación, km actual derivado, borrado solo de lecturas manuales |
| `WorkspaceMemberTest` | 8 | Miembros, roles, último propietario (409), ajustes del taller |
| `DocumentTest` | 6 | Tipo real del fichero, tamaño, descarga con cabeceras seguras, filtros |
| `DemoSeederTest` | 5 | Cuentas, volúmenes y coherencia de los datos demo; repetible; bloqueado en producción |

### Casos críticos del plan y su prueba

| Caso del plan (`docs/tfg/07`, §7.6) | Resultado esperado | Dónde se comprueba | Estado |
|-------------------------------------|--------------------|--------------------|--------|
| PF-AUT-01: 6.º intento de inicio de sesión en un minuto | 429 | `AuthTest` | Superado (23/10 y 25/10) |
| PF-KM-01/02: retroceso sin y con confirmación | 422 con el último valor; 201 al confirmar | `MileageTest` | Superado |
| PF-INT-01/02/03: gasto vinculado en particular; sin coste, archivada, restaurada; ninguno en taller | Según ADR‑0003 | `MaintenanceExpenseTest` | Superado |
| PU-GAS-01: el gasto de una intervención no cuenta dos veces | El resumen suma el importe una sola vez | `MaintenanceExpenseTest`: una intervención de 110,10 € (dos líneas de 42,60 € y 67,50 €) crea un gasto de 110,10 € y el resumen del periodo da 110,10 € | Superado |
| PF-OT-01: numeración en el mismo taller y en otro | Sin huecos y por taller | `WorkOrderTest` | Superado |
| PF-OT-02: elevador ocupado | 409 con el número de la orden que lo ocupa | `WorkOrderTest` | Superado |
| PF-OT-03: entrega | Intervención con las líneas copiadas y elevador libre | `WorkOrderTest` | Superado |
| PF-ROL-01: mecánico en panel, analítica y gastos | `revenue: null`, 403, 403 | `RolesTest` | Superado |
| PA-*: usuario ajeno en cada ruta con recurso | 404 y sin cambios | `IsolationTest` | Superado |
| Cuerpo no válido contra un recurso ajeno | 404, no 422 | `IsolationTest` (envía cuerpos incompletos) | Superado |
| PF-INT-04: fallo forzado a mitad de una transacción | No quedan filas parciales | — | **No hay prueba específica** |
| Numeración simultánea con dos procesos | Sin duplicados | — | **No hay prueba** (SQLite ignora `FOR UPDATE`) |

"Superado" significa que el archivo que contiene el caso pasó entero en las ejecuciones de la tabla anterior; los informes no listan los casos uno a uno.

## 8.4 Resultados del frontend

| Fecha | Comando | Resultado | Fuente |
|-------|---------|-----------|--------|
| 25/10/2026 | `npm run typecheck` | Correcto | [Informe de cierre](../../equipo/informes/2026-10-25-sesion-principal-cierre.md) |
| 25/10/2026 | `npm run test` | **5 archivos, 44 pruebas superadas** | ídem |
| 25/10/2026 | `npm run lint` | Correcto, con avisos previos de oxlint que no bloquean | ídem |
| 25/10/2026 | `npm run build` | Correcto, con el aviso de Vite de *chunks* de más de 500 kB | ídem |

Reparto de las 44 pruebas (contadas con `grep` en cada archivo; la suma coincide con la ejecución):

| Archivo | Pruebas | Qué cubre |
|---------|--------:|-----------|
| `src/lib/helpers.test.ts` | 14 | Plurales y listas en español, líneas e importe efectivo de una intervención, categoría del gasto vinculado, caducidad de documentos, formato de la matrícula y nombre del color |
| `src/features/workshop/components/orderUtils.test.ts` | 12 | Fechas con hora, flujo de estados y elevador tras un cambio (con la misma regla que el servidor), ocupación y zona de espera, rótulo "no es una factura" y nombre de archivo del resumen imprimible |
| `src/features/workshop/components/assignee.test.ts` | 10 | "Mis órdenes": valor por defecto según el rol y su reflejo en la URL |
| `src/lib/analytics.test.ts` | 7 | Periodo por defecto (el mismo que la API) y cifras derivadas que no inventan un mes punta ni un porcentaje cuando el total es 0 |
| `src/three/light-imports.test.ts` | 1 | La parte ligera del módulo 3D no importa three.js |

No hay todavía pruebas de componentes con Testing Library (formularios, estados de carga, vacío y error, mapeo de errores 422), aunque la biblioteca está instalada. [PENDIENTE: tarea 6]

## 8.5 Rendimiento

**API.** La tarea 19 añadió índices y movió agregados de gastos y kilometraje a SQL (commits `adea7ef` y `5fbe44d`). El tablero anota como pendiente "medir rendimiento con escenario de integración": no hay todavía una medición de tiempos ni de número de consultas que se pueda citar. [PENDIENTE: tarea 19]

**3D.** El agente `experto-3d` midió el estado inicial el 23/10 con un navegador sin cabeza y WebGL por software (SwiftShader), que **no representa una tarjeta gráfica real** pero permite comparar antes y después en la misma máquina ([informe](../../equipo/informes/2026-10-23-experto-3d-rendimiento.md), §2):

| Pantalla | Tiempo hasta el primer dibujo 3D | Llamadas de dibujo · triángulos |
|----------|---------------------------------:|---------------------------------|
| Ficha (mapa de zonas) | 10.410 ms | 21 · 252.490 |
| Taller 3D | 7.488 ms | 321 · 598.928 |
| Centro de control (taller embebido) | 12.718 ms | 321 · 598.928 |
| Cabina | 4.212 ms | 17 · 227.146 |
| Portada | 3.259 ms | 18 · 276.738 |

El mismo informe midió una fuga de memoria de unos 1,5 MB de JavaScript por cada ida y vuelta entre pantallas con 3D, sin fuga en la memoria de la tarjeta gráfica.

**Prueba PR-01 del plan ("three.js no está en la carga inicial"): no se cumple.** El `index.html` del *build* del 25/10 (`frontend/dist/`) precarga con `modulepreload` el *chunk* `three-CSwm0sEG.js` (1.005.297 bytes) y el de gráficos (404.588 bytes) en todas las pantallas. Se ha comprobado leyendo ese archivo el 26/10; la causa está explicada en el capítulo 7 (§7.6.4).

> [PENDIENTE: tarea 20 — corrección de la división en *chunks* y medición final con el mismo método. Pruebas PR-02 a PR-05 sin ejecutar.]

## 8.6 Trazabilidad

De los 74 requisitos funcionales del capítulo 4, **63** tienen al menos un archivo de pruebas de la API que los cubre y **11** no tienen prueba automática:

| Sin prueba automática | Motivo |
|-----------------------|--------|
| RF-47, RF-48, RF-49, RF-50, RF-52 | Son del cliente (3D, alternativa 2D, portada): necesitan pruebas extremo a extremo [PENDIENTE: tarea 6] |
| RF-70 | "Mis órdenes": construido el 24/10 y cubierto por `assignee.test.ts` en el cliente, pero sin prueba de extremo a extremo |
| RF-71 | Resumen imprimible de la orden: la pantalla existe desde el 25/10, sin prueba [PENDIENTE: tarea 24] |
| RF-10, RF-72, RF-73 | En implementación [PENDIENTE: tareas 28 y 29] |
| RF-74 | En diseño [PENDIENTE: tarea 32] |

Los requisitos no funcionales de seguridad (RNF-01 a RNF-05) e integridad (RNF-06) tienen prueba en la API; los de accesibilidad, adaptación a pantallas y usabilidad (RNF-10, RNF-11, RNF-18) dependen de las tareas 6 y 8.

## 8.7 Pruebas pendientes

| Prueba | Criterio de aceptación (fijado en el plan) | Tarea |
|--------|---------------------------------------------|-------|
| Recorridos extremo a extremo PE-01 a PE-07 en 360, 768 y 1280 px | Todos en verde | > [PENDIENTE: tarea 6 — E2E con Playwright] |
| Auditoría automática de accesibilidad | 0 incidencias críticas o serias de axe en cada pantalla principal | > [PENDIENTE: tarea 6] |
| Revisión manual de accesibilidad y adaptación | Teclado completo, foco visible, lector de pantalla en dos pantallas, reflujo a 320 px | > [PENDIENTE: tarea 8] |
| Auditoría de seguridad y privacidad | Sin hallazgos críticos ni altos abiertos | > [PENDIENTE: tarea 7] |
| Integración continua | Backend (SQLite y MariaDB) y frontend en cada envío a `develop` | > [PENDIENTE: tarea 11] |
| Rendimiento 3D PR-01 a PR-05 | Ver §8.5 | > [PENDIENTE: tarea 20] |
| Recorrido completo con las 4 cuentas demo | Sin errores en ninguna pantalla | > [PENDIENTE: tarea 5] |

## 8.8 Limitaciones de las pruebas

- **Sin pruebas de concurrencia.** El bloqueo de la fila del taller es real en MariaDB, pero no hay una prueba con dos procesos simultáneos (informe del backend, §7).
- **El cierre de sesión** se prueba (la sesión queda cerrada), pero no que se regenere el token CSRF, aunque el código lo hace.
- **Dos ejecuciones a la vez interfieren.** `Storage::fake('local')` usa una sola carpeta; lanzar la batería en SQLite y en MariaDB en paralelo dio un fallo espurio en cada una (informe del backend, §7). Por separado, las dos pasaron.
- **La batería sobre MariaDB** solo se ha ejecutado una vez, a mano.
- **Las pruebas del cliente son pocas** y cubren funciones de cálculo, no pantallas.
