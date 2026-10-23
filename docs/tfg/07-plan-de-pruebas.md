# 7. Plan de pruebas

*Versión 1 · 21/10/2026 · Autor: agente `documentador-tfg` · Estado: **plan** (oleada 1). Este documento define qué se va a probar y cómo. **No contiene resultados**: la sección §7.8 se rellenará únicamente con resultados reales.*

## 7.1 Objetivos y principios

1. **Demostrar** que los requisitos de [01‑requisitos.md](01-requisitos.md) se cumplen, con trazabilidad requisito → prueba.
2. **Proteger las reglas críticas** (kilometraje, gasto vinculado, coste por km, recurrencia, numeración, elevadores, entrega de órdenes) frente a regresiones.
3. **Garantizar el aislamiento** entre espacios con una prueba por endpoint (RNF-02).
4. **No declarar nada probado sin ejecutarlo** (CLAUDE.md, regla 9). Toda cifra de §7.8 debe proceder de una ejecución real registrada en un informe de `docs/equipo/informes/`.

## 7.2 Niveles de prueba

| Nivel | Código | Qué prueba | Herramienta | Ubicación | Comando |
|-------|--------|------------|-------------|-----------|---------|
| Unitaria (backend) | **U** | Funciones y reglas puras sin HTTP: dinero, enumerados, estado de recordatorios, coste por km, consumo, totales de órdenes | Pest 3 | `backend/tests/Unit/` | `php artisan test --testsuite=Unit` |
| Feature / API | **F** | Cada endpoint por HTTP: camino feliz, validación (422), permisos por rol (403), conflictos (409), forma JSON del contrato (dinero como string, fechas) | Pest 3 + `RefreshDatabase` sobre SQLite en memoria | `backend/tests/Feature/` | `php artisan test` |
| Aislamiento | **A** | Un usuario ajeno recibe **404** en cada endpoint de recurso y no ve datos ajenos en listados | Pest 3 (*dataset* de rutas) | `backend/tests/Feature/Isolation/` (propuesta) | `php artisan test --filter=Isolation` |
| Componentes (frontend) | **C** | Formularios, validación y mapeo de errores 422, estados de carga/vacío/error, textos obligatorios («faltan datos», «según tus intervalos, no medido»), formato con `Intl` | Vitest 4 + Testing Library + jsdom | junto al componente (`*.test.tsx`) | `npm run test` |
| Extremo a extremo | **E** | Recorridos completos con backend y frontend reales y `DemoSeeder`, en 360, 768 y 1280 px | Playwright 1.64 | `frontend/e2e/` | `npm run test:e2e` |
| Accesibilidad | **X** | Reglas WCAG automatizables por pantalla; teclado y movimiento reducido | `@axe-core/playwright` + revisión manual | `frontend/e2e/a11y/` (propuesta) | `npm run test:e2e` |
| Rendimiento 3D | **R** | Carga diferida de three.js, un `<canvas>` por pantalla, escena quieta sin redibujar, fluidez, respaldo sin WebGL | Análisis del *build* + Playwright | `frontend/e2e/perf/` (propuesta) | `npm run build` + `npm run test:e2e` |
| Estática | **S** | Tipos, *lint* y estilo | `tsc`, oxlint, Laravel Pint | — | `npm run typecheck`, `npm run lint`, `vendor/bin/pint --test` |

**Infraestructura existente (verificada el 21/10/2026):** `backend/phpunit.xml` usa SQLite en memoria (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`) y define las suites `Unit` y `Feature`; `backend/tests/` solo contiene los ejemplos del esqueleto. `frontend/package.json` declara Vitest, Testing Library, jsdom, Playwright y `@axe-core/playwright` y los scripts `test` y `test:e2e`; aún no existen `frontend/e2e/` ni la configuración de Playwright (responsabilidad del agente `qa-tester`).

## 7.3 Estrategia por nivel

### Unitarias (U)
- `Money`: conversión a céntimos, redondeo *half‑up*, total de línea, porcentaje (IVA).
- Enumerados: `WorkspaceRole::allows` (tabla completa de permisos), `RecordType::expenseCategory`, `ReminderKind::defaultZone`, `WorkOrderStatus::isFinal` y `releasesBay`, `ReminderState::severity`.
- Cálculos: estado de recordatorio en los **límites** (30 días, 1.000 km, sin km), progreso, coste por km (≥ 2 lecturas, ≥ 500 km, ≥ 30 días), consumo lleno‑a‑lleno, `km_this_month`, `avg_daily_km`, serie de 12 meses con meses a 0, `change_pct` con periodo anterior vacío.

### Feature / API (F)
Por cada endpoint del contrato, como mínimo:
1. Camino feliz con el código y la **forma JSON del contrato** (dinero como string con 2 decimales, fechas `YYYY-MM-DD`, `null` en vez de valores inventados).
2. Validación: 422 con `errors` por campo y mensajes en español.
3. Rol insuficiente dentro de un espacio propio: 403 (p. ej. mecánico en gastos y analítica).
4. Conflictos de estado: 409 (gasto vinculado, último `owner`, elevador ocupado, orden final, vehículo no archivado).
5. Sin sesión: 401.
6. **Transacciones:** forzar un fallo a mitad (p. ej. con un *mock* del registro de actividad que lance una excepción) y comprobar que no quedan filas parciales.

### Aislamiento (A)
- Escenario fijo: usuario **A** con espacio personal y un taller con datos; usuario **B** con su propio espacio.
- Para **cada ruta con un recurso** (`/vehicles/{v}`, `/maintenance/{r}`, `/expenses/{e}`, `/reminders/{r}`, `/documents/{d}`, `/mileage/{log}`, `/customers/{c}`, `/work-orders/{o}`, `/workspaces/{ws}/...`) y cada método, B recibe **404** y la base de datos no cambia.
- Los listados de B no contienen ningún identificador de A.
- **Guardia de cobertura (propuesta):** una prueba recorre las rutas registradas en `/api/v1` y falla si alguna con parámetro de recurso no figura en el *dataset* de aislamiento. Así un endpoint nuevo no puede quedar sin su prueba.
- Caso específico: un cuerpo **no válido** contra un recurso ajeno debe dar 404, no 422 (ver [04 §4.2](04-arquitectura.md#orden-de-validación-y-autorización)).

### Componentes (C)
- Formularios: validación en cliente con los mismos límites que el servidor; un 422 del servidor se muestra junto a cada campo.
- Diálogo de confirmación de retroceso de km tras un 422 en `mileage`.
- Estados de carga (*skeleton*), vacío (con acción) y error (con «Reintentar») en cada pantalla.
- Textos obligatorios: «faltan datos» con su motivo en coste/km y consumo; «según tus intervalos, no medido» en zonas; «ilustración» en rayos X.
- Formato `es-ES` de importes, km y fechas con `Intl`.
- Controles por rol: el mecánico no ve facturación ni gastos (además de la comprobación del servidor).
- Las peticiones se simulan sustituyendo `fetch` (sin añadir dependencias).

### Extremo a extremo (E)
Con base de datos limpia y `DemoSeeder`, en 360, 768 y 1280 px:

| ID | Recorrido | Requisitos |
|----|-----------|------------|
| PE-01 | Registro particular → alta de vehículo con km → intervención con coste → Gastos muestra el gasto «desde intervención» → dashboard con el total correcto | RF-03, RF-17, RF-27, RF-29, RF-34, RF-57 |
| PE-02 | Actualizar km con un valor menor → aviso → confirmar → km actual actualizado | RF-23 |
| PE-03 | Completar un recordatorio recurrente → aparece el siguiente → la zona del 3D cambia de estado | RF-43, RF-46 |
| PE-04 | Taller: crear orden con elevador → mover por el tablero → asignar elevador ocupado (aviso) → entregar → la intervención aparece en el historial del vehículo | RF-62…RF-66 |
| PE-05 | Taller: gerente añade un mecánico → el mecánico entra y no ve facturación | RF-15, RF-16, RF-69 |
| PE-06 | Sin WebGL: la ficha muestra la silueta y la lista de zonas en HTML | RF-49 |
| PE-07 | Cerrar sesión y volver atrás no muestra datos privados | RF-05, RF-06 |

### Accesibilidad (X)
- **Automática:** axe con las etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `wcag22aa` en cada pantalla principal (login, registro, dashboard personal, garaje, ficha con zonas, historial, formulario de intervención, gastos, recordatorios, documentos, dashboard del taller, tablero kanban, taller 3D, ajustes y equipo). **Criterio de aceptación:** 0 incidencias críticas o serias.
- **Teclado:** cada recorrido E se repite sin ratón; el foco es visible y no queda oculto; el kanban y la selección de zonas tienen alternativa por teclado.
- **Movimiento reducido:** `page.emulateMedia({ reducedMotion: 'reduce' })` y comprobación de que no hay autorrotación.
- **Manual (no automatizable):** orden de lectura con lector de pantalla en dos pantallas clave, comprensibilidad de mensajes de error, reflujo a 320 px (WCAG 1.4.10).

### Rendimiento 3D (R)

| ID | Prueba | Método | Objetivo |
|----|--------|--------|----------|
| PR-01 | three.js no está en la carga inicial | Revisar los chunks de `npm run build` y las peticiones de red al abrir el login | El chunk `three` solo se descarga al abrir una vista 3D |
| PR-02 | Un único contexto WebGL por pantalla | Playwright cuenta los `<canvas>` de cada pantalla, incluido el garaje con 20 vehículos | ≤ 1 |
| PR-03 | Escena quieta sin redibujar | Muestreo de fotogramas con la escena inmóvil (`frameloop="demand"`) | ⏳ Umbral por fijar con `experto-3d` |
| PR-04 | Fluidez al orbitar | Medición de FPS en un equipo de referencia | ⏳ Objetivo por fijar con `experto-3d` |
| PR-05 | Respaldo sin WebGL | Sustituir `getContext('webgl*')` por `null` con un *init script* | Se ve la silueta y la información completa |

## 7.4 Datos de prueba

- **Backend:** factorías de Laravel por prueba (`RefreshDatabase`), sin depender del seeder.
- **E2E:** `php artisan migrate:fresh --seed` + `DemoSeeder` (`demo@carcare.test`, `taller@carcare.test`, `mecanico@carcare.test`, `gerente@carcare.test`). El seeder aborta en producción (RF-02).
- Los datos de demostración son **claramente ficticios** y no se presentan como datos reales en la memoria.

## 7.5 Criterios de entrada y salida

- **Entrada:** la historia está implementada y el *build* y el *typecheck* pasan.
- **Salida por historia** (definición de terminado de `CLAUDE.md`): flujo principal con datos persistidos · autorización probada en backend (F + A) · validación en cliente y servidor · estados de carga, vacío y error · responsive (360, 768, 1280) · teclado · pruebas pasando · limitaciones anotadas.
- **Salida de la oleada de calidad:** suites U, F y A en verde; E2E PE-01…PE-07 en verde en los tres tamaños; axe sin incidencias críticas o serias; PR-01, PR-02 y PR-05 cumplidos.

## 7.6 Casos de prueba críticos

| ID | Nivel | Caso | Resultado esperado | Requisito |
|----|-------|------|--------------------|-----------|
| PF-AUT-01 | F | 6.º intento de login en un minuto | 429 | RF-04 |
| PF-AUT-02 | F | Login con email inexistente y con contraseña errónea | Mismo 422 genérico en ambos | RF-04 |
| PF-KM-01 | F | Lectura menor que una anterior sin confirmar | 422 en `mileage` con último km y fecha; no se guarda | RF-23 |
| PF-KM-02 | F | La misma lectura con `confirm_mileage_drop: true` | 201; `current_mileage` = lectura más reciente por fecha | RF-23, RF-26 |
| PF-KM-03 | F | Borrar una lectura no manual | Rechazada; km actual sin cambios | RF-25 |
| PF-INT-01 | F | Intervención con coste en espacio personal | Gasto vinculado con categoría según tipo, misma fecha, km e importe | RF-29 |
| PF-INT-02 | F | Total a 0 / archivar / restaurar | Gasto eliminado / eliminado / recreado | RF-29, RF-32 |
| PF-INT-03 | F | Intervención con coste en un taller | Sin gasto | RF-29 |
| PF-INT-04 | F | Fallo forzado dentro de la transacción | Ni intervención, ni líneas, ni gasto, ni lectura | RNF-06 |
| PU-GAS-01 | U/F | Intervención de 100 € + gasto manual de 50 € | Total del periodo 150,00 € (sin doble conteo) | RF-29, RF-36 |
| PF-GAS-02 | F | Editar o borrar un gasto vinculado | 409 con el mensaje del contrato | RF-35 |
| PU-CKM-01 | U | Coste por km con 2 lecturas a 29 días o a 499 km | No disponible con `reason` exacta | RF-37 |
| PU-CON-01 | U | Tres repostajes llenos con km | Consumo = media ponderada por tramos | RF-38 |
| PU-REC-01 | U | Estado en los límites (30/31 días, 1.000/1.001 km, sin km) | `soon`/`ok`, `soon`/`ok`, `unknown` | RF-42 |
| PF-REC-02 | F | Completar recurrente (12 meses / 15.000 km) con km | `next` con fechas y km calculados; lectura `reminder` | RF-43 |
| PF-REC-03 | F | Completar con `create_next: false` | `next = null` | RF-43 |
| PF-ZON-01 | F | Vehículo sin datos, solo con historial y con recordatorios | 10 zonas en orden; `basis` none/records/reminders | RF-46 |
| PF-OT-01 | F | Tres órdenes en el mismo espacio y año, y una en otro espacio | `OT-AAAA-0001…0003` y `OT-AAAA-0001`, sin huecos | RF-62 |
| PF-OT-02 | F | Asignar un elevador ocupado | 409 «El elevador N está ocupado por OT-…» | RF-66 |
| PF-OT-03 | F | Entregar una orden con líneas | Intervención creada con líneas copiadas; elevador libre; enlace en la orden | RF-65 |
| PF-OT-04 | F | Cambiar una orden entregada o cancelada | 409 | RF-64 |
| PU-OT-05 | U | IVA con redondeo *half‑up* (p. ej. subtotal que produce x,xx5) | Redondeo hacia arriba a 2 decimales | RF-67 |
| PF-MEM-01 | F | Quitar o degradar al último `owner` | 409 | RF-15 |
| PF-ROL-01 | F | Mecánico: dashboard, analítica y gastos | `revenue: null`, 403, 403 | RF-16, RF-69 |
| PF-DOC-01 | F | Fichero > 10 MB, MIME no permitido, extensión falsa | 422 | RF-53, RNF-05 |
| PF-DOC-02 | F | Descarga propia | 200 con `Content-Disposition` y `X-Content-Type-Options: nosniff` | RF-55 |
| PA-* | A | Usuario ajeno en cada endpoint de recurso | 404 y sin cambios | RNF-02 |

## 7.7 Matriz de trazabilidad requisito → tipo de prueba

Leyenda: **U** unitaria · **F** feature/API · **A** aislamiento · **C** componente · **E** E2E · **X** accesibilidad · **R** rendimiento 3D · **S** estática · **M** revisión manual.

### Requisitos funcionales

| RF | U | F | A | C | E | X | R | Nota |
|----|:-:|:-:|:-:|:-:|:-:|:-:|:-:|------|
| RF-01 | | ✔ | | | | | | |
| RF-02 | | ✔ | | | ✔ | | | Aborta en producción |
| RF-03 | | ✔ | | ✔ | ✔ | ✔ | | PE-01 |
| RF-04 | | ✔ | | ✔ | ✔ | ✔ | | PF-AUT-01/02 |
| RF-05 | | ✔ | | | ✔ | | | PE-07 |
| RF-06 | | ✔ | | ✔ | ✔ | | | |
| RF-07 | | ✔ | | ✔ | | | | |
| RF-08 | | ✔ | | ✔ | | | | |
| RF-09 | | ✔ | | ✔ | | | | Borrado en cascada |
| RF-10 | | | | | | | | ⏳ Sin endpoint en el contrato |
| RF-11 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-12 | | ✔ | | ✔ | | | | |
| RF-13 | | ✔ | ✔ | ✔ | | | | |
| RF-14 | | ✔ | ✔ | | | | | |
| RF-15 | | ✔ | ✔ | ✔ | ✔ | | | PF-MEM-01, PE-05 |
| RF-16 | ✔ | ✔ | | ✔ | ✔ | | | PF-ROL-01 |
| RF-17 | | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| RF-18 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-19 | | ✔ | ✔ | ✔ | | ✔ | | |
| RF-20 | | ✔ | ✔ | ✔ | | | | |
| RF-21 | | ✔ | ✔ | | ✔ | | | |
| RF-22 | | ✔ | ✔ | | | | | |
| RF-23 | ✔ | ✔ | ✔ | ✔ | ✔ | | | PF-KM-01/02, PE-02 |
| RF-24 | | ✔ | ✔ | | | | | |
| RF-25 | | ✔ | ✔ | | | | | PF-KM-03 |
| RF-26 | ✔ | ✔ | | | | | | |
| RF-27 | | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| RF-28 | ✔ | ✔ | | ✔ | | | | |
| RF-29 | | ✔ | | | ✔ | | | PF-INT-01…04, PU-GAS-01 |
| RF-30 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-31 | | ✔ | ✔ | ✔ | | | | |
| RF-32 | | ✔ | ✔ | | | | | |
| RF-33 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-34 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-35 | | ✔ | ✔ | | | | | PF-GAS-02 |
| RF-36 | ✔ | ✔ | ✔ | ✔ | ✔ | | | |
| RF-37 | ✔ | ✔ | | ✔ | | | | PU-CKM-01 |
| RF-38 | ✔ | ✔ | | ✔ | | | | PU-CON-01 |
| RF-39 | ✔ | ✔ | | ✔ | | | | |
| RF-40 | ✔ | ✔ | ✔ | ✔ | | | | |
| RF-41 | | ✔ | ✔ | ✔ | | | | |
| RF-42 | ✔ | ✔ | | ✔ | | | | PU-REC-01 |
| RF-43 | ✔ | ✔ | ✔ | | ✔ | | | PF-REC-02/03, PE-03 |
| RF-44 | | ✔ | ✔ | | | | | |
| RF-45 | | ✔ | ✔ | ✔ | | | | |
| RF-46 | ✔ | ✔ | ✔ | ✔ | | | | PF-ZON-01 |
| RF-47 | | | | ✔ | ✔ | ✔ | ✔ | |
| RF-48 | | | | ✔ | ✔ | | ✔ | |
| RF-49 | | | | ✔ | ✔ | ✔ | | PE-06, PR-05 |
| RF-50 | | | | ✔ | | | ✔ | |
| RF-51 | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| RF-52 | | | | | ✔ | ✔ | ✔ | |
| RF-53 | | ✔ | ✔ | ✔ | ✔ | | | PF-DOC-01 |
| RF-54 | | ✔ | ✔ | | | | | |
| RF-55 | | ✔ | ✔ | | ✔ | | | PF-DOC-02 |
| RF-56 | | ✔ | ✔ | | | | | |
| RF-57 | | ✔ | ✔ | ✔ | ✔ | ✔ | | PE-01 |
| RF-58 | ✔ | ✔ | ✔ | ✔ | | | | |
| RF-59 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-60 | | ✔ | ✔ | ✔ | | | | |
| RF-61 | | ✔ | ✔ | ✔ | ✔ | | | |
| RF-62 | | ✔ | ✔ | ✔ | ✔ | | | PF-OT-01, PE-04 |
| RF-63 | | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| RF-64 | ✔ | ✔ | ✔ | | ✔ | | | PF-OT-04 |
| RF-65 | | ✔ | | | ✔ | | | PF-OT-03 |
| RF-66 | | ✔ | ✔ | | ✔ | | | PF-OT-02 |
| RF-67 | ✔ | ✔ | | | | | | PU-OT-05 |
| RF-68 | | ✔ | ✔ | | | | | |
| RF-69 | | ✔ | ✔ | ✔ | ✔ | ✔ | | PF-ROL-01 |

### Requisitos no funcionales

| RNF | Tipo de prueba | Nota |
|-----|----------------|------|
| RNF-01 Seguridad · autenticación | F, E | PF-AUT-01/02, PE-07 |
| RNF-02 Aislamiento | **A** | Una prueba por endpoint + guardia de cobertura |
| RNF-03 Autorización por rol | F, E | PF-ROL-01, PF-MEM-01 |
| RNF-04 Entradas y salidas | F, C, M | Formato de error sin trazas; revisión de `seguridad` |
| RNF-05 Ficheros | F, M | PF-DOC-01/02 |
| RNF-06 Integridad | U, F | PF-INT-04, PU-OT-05, PF-OT-01 |
| RNF-07 Veracidad | C, M | Textos «faltan datos» y «no medido» |
| RNF-08 Rendimiento 3D | R | PR-01…PR-05 |
| RNF-09 Rendimiento API | F | Paginación por defecto y máximos |
| RNF-10 Accesibilidad | X, E, M | axe + teclado + lector de pantalla |
| RNF-11 Responsive | E, M | Tres tamaños + 320 px |
| RNF-12 Privacidad | F, M | Baja de cuenta en cascada; `metadata` sin datos sensibles |
| RNF-13 Mantenibilidad | S | `typecheck`, `lint`, Pint |
| RNF-14 Pruebas | — | Este plan |
| RNF-15 Localización | C, F | Formato `Intl`; mensajes en español |
| RNF-16 Compatibilidad | E, M | PE-06 |
| RNF-17 Propiedad intelectual | M | Revisión del módulo 3D y dependencias |
| RNF-18 Usabilidad | C, E, M | Revisión de `disenador-ux` |

## 7.8 Resultados

> **Se rellenará con resultados reales de `docs/equipo/informes/`.** No se anotará ninguna cifra, porcentaje ni estado «superado» que no proceda de una ejecución documentada en un informe (comando, fecha y salida).

| Fecha | Suite / comando | Resultado | Informe de origen |
|-------|-----------------|-----------|-------------------|
| | | | |
