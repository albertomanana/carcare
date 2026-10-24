# 4. Requisitos funcionales y no funcionales

## 4.1 Convenciones

Los requisitos se derivan del contrato de la API v1 ([`docs/api/contrato-v1.md`](../../api/contrato-v1.md)), de los ADR y del backlog ([`CarCare/02_backlog/backlog-mvp.md`](../../../CarCare/02_backlog/backlog-mvp.md)). Esta versión actualiza la especificación del 21/10/2026 ([`docs/tfg/01-requisitos.md`](../01-requisitos.md)) contra el código del 24/10/2026.

| Columna | Significado |
|---------|-------------|
| Modo | **P** particular · **T** taller · **P/T** ambos |
| Prior. | MoSCoW de la historia del backlog: **M** *Must* · **S** *Should* · **C** *Could* |
| Historia | Historia o historias del backlog que lo originan |
| Prueba | Archivo de `backend/tests/Feature/` que lo verifica. "—" indica que no hay prueba automática todavía (normalmente, requisitos solo de cliente, pendientes de E2E) |
| Estado | Según el mapa de huecos de producto del 23/10/2026, actualizado el 24/10. **Construido** significa que el flujo está en la aplicación contra la API real y el backend tiene pruebas; **no** que se haya verificado la definición de terminado completa (E2E, axe, 360/768/1280 px), que hoy no cumple ninguna historia |

**Permisos.** Cada operación exige una capacidad sobre el espacio de trabajo del recurso. Las capacidades son acumulativas (`view` ⊂ `operate` ⊂ `manage` ⊂ `own`) y la tabla completa está en el capítulo 6 (§6.3).

## 4.2 Requisitos funcionales

### Sistema y cuenta

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-01 | Comprobación de salud pública que responde `{ "status": "ok" }` | — | M | E0‑1 | `AuthTest`, `ContractShapeTest` | Construido |
| RF-02 | Datos de demostración claramente ficticios para 4 cuentas (particular, propietario, gerente y mecánico del taller), repetibles y bloqueados en producción | P/T | M | E6‑1 | `DemoSeederTest` | Construido; ampliación en curso (tarea 19) |
| RF-03 | Registro con nombre, email único (en minúsculas) y contraseña de 8 caracteres o más, como particular o como taller. Siempre crea el espacio personal; como taller, también el espacio del taller con el usuario como propietario. Deja la sesión iniciada | P/T | M | E1‑1, E1‑8 | `AuthTest` | Construido |
| RF-04 | Inicio de sesión con mensaje genérico ante credenciales erróneas y bloqueo temporal (429) tras 5 intentos fallidos por minuto para el mismo email e IP | P/T | M | E1‑2 | `AuthTest` | Construido |
| RF-05 | Cierre de sesión que invalida la sesión y regenera el token CSRF | P/T | M | E1‑2 | `AuthTest` | Construido |
| RF-06 | Rutas privadas protegidas: la API responde 401 sin sesión y la SPA lleva al inicio de sesión y, al entrar, vuelve a la ruta pedida | P/T | M | E1‑3 | `IsolationTest` | Construido |
| RF-07 | Edición del perfil (nombre y email) | P/T | M | E1‑4 | `AuthTest` | Construido |
| RF-08 | Cambio de contraseña indicando la actual | P/T | M | E1‑4 | `AuthTest` | Construido |
| RF-09 | Baja de la cuenta con confirmación de la contraseña: borra el espacio personal, sus ficheros y los talleres de los que es único propietario; conserva los talleres con otro propietario | P/T | S | E1‑7 | `AuthTest` | Construido |
| RF-10 | Recuperación de la contraseña por email: misma respuesta exista o no la cuenta, enlace de un solo uso que caduca a los 60 minutos, límite de peticiones; el correo se escribe en el registro local | P/T | S | E1‑6 | — | **Contrato aprobado el 24/10** (§3.1.1, ADR‑0006). [PENDIENTE: tarea 28 — backend con tests y dos pantallas] |

### Espacios de trabajo y equipo

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-11 | Listado de los espacios del usuario con su rol en cada uno y cambio del espacio activo; la interfaz se adapta al tipo de espacio | P/T | M | E13‑1 | `IsolationTest`, `WorkspaceMemberTest` | Construido |
| RF-12 | Creación de un espacio de taller desde Ajustes; quien lo crea es su propietario | T | M | E13‑1 | `WorkspaceMemberTest` | Construido |
| RF-13 | Ajustes del taller: nombre, número de elevadores (1‑12) e IVA por defecto (0‑100 %). No se pueden quitar elevadores ocupados (409) | T | M | E13‑5 | `WorkspaceMemberTest` | Construido |
| RF-14 | El propietario puede eliminar un taller; el espacio personal no se elimina por esta vía (409) | T | S | E13‑6 | `RolesTest` | Construido |
| RF-15 | Gestión de miembros: añadir por email a usuarios ya registrados como gerente o mecánico, cambiar su rol y quitarlos. Nunca se queda el espacio sin propietario (409). Solo un propietario nombra o retira propietarios. Cualquier miembro puede salir. Al quitar a un miembro, sus órdenes quedan sin asignar | T | M | E13‑2, E13‑3 | `WorkspaceMemberTest`, `RolesTest` | Construido |
| RF-16 | Cada operación se autoriza según el rol del usuario en el espacio del recurso; el mecánico no ve importes del taller ni gastos (403) | P/T | M | E13‑4, E1‑5 | `RolesTest` | Construido |

### Garaje y kilometraje

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-17 | Alta de vehículo con marca y modelo obligatorios y el resto opcional (apodo, versión, año, combustible, cambio, motor, carrocería, color, matrícula, VIN, compra, km). Si se indican km, se crea la primera lectura. Matrícula normalizada y única entre los vehículos no archivados del espacio; VIN de 17 caracteres único por espacio. En talleres, cliente del mismo espacio | P/T | M | E2‑1, E11‑4 | `VehicleTest`, `WorkOrderTest` | Construido |
| RF-18 | Listado con búsqueda, filtro de archivados y de cliente, orden y paginación; cada vehículo trae sus contadores | P/T | M | E2‑2 | `VehicleTest` | Construido |
| RF-19 | Ficha del vehículo; los datos no informados aparecen como "Sin indicar", nunca inventados | P/T | M | E2‑3 | `VehicleTest`, `ContractShapeTest` | Construido |
| RF-20 | Edición del vehículo sin tocar el kilometraje, que solo cambia con lecturas | P/T | M | E2‑4 | `VehicleTest` | Construido |
| RF-21 | Archivar y restaurar un vehículo conservando su historial | P/T | M | E2‑5 | `VehicleTest` | Construido |
| RF-22 | Eliminar definitivamente un vehículo, solo si está archivado, con su historial y sus ficheros | P/T | C | E2‑7 | `VehicleTest` | Construido |
| RF-23 | Lectura de kilometraje con fecha no futura y km entero entre 0 y 2.000.000. Si es menor que una lectura anterior o mayor que una posterior, 422 con el valor coherente; solo se acepta si se reenvía confirmada (`confirm_mileage_drop`) | P/T | M | E2‑6, E3‑7 | `MileageTest` | Construido |
| RF-24 | Historial de lecturas con su origen (manual, alta, intervención, gasto, orden o recordatorio) y enlace al registro de origen | P/T | M | E7‑1 | `MileageTest` | **A medias**: el enlace al origen (`source_id`) se aprobó en el contrato el 24/10. [PENDIENTE: tarea 27 — backend y pantalla] |
| RF-25 | Borrado de lecturas manuales con recálculo del km actual; las demás se gestionan desde su origen (409) | P/T | M | E7‑1 | `MileageTest`, `RolesTest` | Construido |
| RF-26 | Km actual derivado: la lectura más reciente por fecha (a igual fecha, la de más km). Cada dato con km crea o actualiza una sola lectura ligada a su origen | P/T | M | E3‑7 | `MileageTest`, `WorkOrderTest` | Construido |

### Intervenciones, gastos y analítica

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-27 | Registro de intervención con tipo, zona, tipo de servicio, título (2‑120), fecha no futura, km, taller, descripción e importes (0‑999.999,99, 2 decimales) | P/T | M | E3‑1, E3‑8 | `MaintenanceExpenseTest` | Construido |
| RF-28 | Desglose en hasta 50 líneas (pieza, mano de obra, fluido, otro); el total de cada línea lo calcula el servidor; al editar, las líneas enviadas sustituyen a las anteriores | P/T | M | E3‑2 | `MaintenanceExpenseTest` | Construido |
| RF-29 | En espacios personales, una intervención con coste crea o actualiza en la misma transacción un **gasto vinculado** (categoría según el tipo, misma fecha, km e importe). Sin coste o archivada, el gasto desaparece; restaurada, se recrea. En talleres no se crean gastos | P | M | E3‑6 | `MaintenanceExpenseTest`, `AnalyticsTest` | Construido |
| RF-30 | Historial como línea temporal (fecha descendente; a igual fecha, km descendente) con filtros de tipo, zona, año, texto y archivadas | P/T | M | E3‑3 | `MaintenanceExpenseTest` | **A medias**: filtra por año pero no agrupa por año. [PENDIENTE: tarea 26] |
| RF-31 | Detalle de la intervención con líneas, gasto vinculado, orden de origen y número de documentos | P/T | M | E3‑4 | `ContractShapeTest` | Construido |
| RF-32 | Edición, archivado y restauración de intervenciones | P/T | M | E3‑5 | `MaintenanceExpenseTest`, `RolesTest` | Construido |
| RF-33 | Registro de gasto (11 categorías), importe mayor que 0 y fecha no futura. Los datos de repostaje (cantidad, unidad `l`/`kWh`/`kg`, depósito lleno) solo en combustible; `kWh` por defecto en eléctricos | P (T: `manage`) | M | E4‑1, E7‑2 | `MaintenanceExpenseTest` | Construido |
| RF-34 | Listado y filtro de gastos por periodo y categoría; los vinculados se identifican y enlazan con su intervención | P | M | E4‑2 | `MaintenanceExpenseTest` | Construido (criterio revisado el 23/10: tres periodos fijos y una categoría) |
| RF-35 | Edición y borrado de gastos manuales; los vinculados responden 409 ("Este gasto se gestiona desde su intervención.") | P | M | E4‑5 | `MaintenanceExpenseTest` | Construido |
| RF-36 | Resumen del vehículo por periodo: totales del periodo, mes y año, por categoría, serie de 12 meses, comparación con el periodo anterior de igual duración, km del mes y del año, media diaria | P/T | M | E4‑3, E4‑6, E5‑2, E5‑4, E7‑5 | `AnalyticsTest` | Construido en la API; los km del año no se muestran aún. [PENDIENTE: tarea 26] |
| RF-37 | Coste por kilómetro solo con 2 o más lecturas separadas al menos 500 km y 30 días; si no, el motivo exacto | P | M | E4‑4 | `AnalyticsTest` | Construido |
| RF-38 | Consumo medio por el método lleno‑a‑lleno (incluido kWh/100 km en eléctricos), o qué falta para calcularlo | P | M | E7‑3 | `AnalyticsTest` | Construido |
| RF-39 | "Desde el último" cambio de aceite, revisión e ITV, en días y km | P/T | M | E5‑5 | `AnalyticsTest` | Construido |
| RF-40 | Analítica del espacio (`manage`). Particular: gasto por mes, vehículo y categoría, solo desde la tabla de gastos. Taller: importe de las órdenes entregadas, ticket medio, días medios en el taller y reparto por cliente; nunca se rotula "facturación" (D12) | P/T | M (P) · S (T) | E15‑1, E15‑2, E15‑3 | `AnalyticsTest`, `RolesTest` | API construida. [PENDIENTE: tareas 17 y 23 — pantalla de Analítica en curso] |

### Recordatorios y zonas

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-41 | Crear, editar y borrar recordatorios por fecha y/o km (al menos uno), con tipo, zona por defecto según el tipo y recurrencia opcional en meses y/o km | P/T | M | E8‑1, E8‑4 | `ReminderTest` | Construido |
| RF-42 | Estado calculado al consultar, no guardado: vencido, próximo (30 días o 1.000 km o menos), sin datos o en plazo; días y km restantes; progreso según los intervalos del usuario | P/T | M | E8‑2 | `ReminderTest` | Construido |
| RF-43 | Completar un recordatorio con fecha y km opcional (con la misma regla de retrocesos). Si es recurrente, crea el siguiente desde la fecha y el km de realización; sin km de realización, parte del km actual del vehículo; sin fecha ni km límite posibles, no lo crea | P/T | M | E8‑3 | `ReminderTest` | Construido |
| RF-44 | Descartar un recordatorio; uno no pendiente no admite más cambios de estado (409) | P/T | S | E8‑4 | `ReminderTest` | Construido |
| RF-45 | Agenda del espacio con los recordatorios pendientes de todos los vehículos, por urgencia y filtrable | P/T | S | E8‑5 | `ReminderTest` | Construido |
| RF-46 | Mapa de las 10 zonas del vehículo: el estado de cada zona es el peor de sus recordatorios pendientes; sin recordatorios, "sin datos" con base `records` (hay historial) o `none`. Siempre se rotula "según tus intervalos, no medido" | P/T | M | E8‑6 | `AnalyticsTest` | Construido |

### Experiencia 3D

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-47 | Vehículo en 3D generado por código según su carrocería (9 tipos) y teñido con su color, sin marcas; en modo inspección se orbita y se seleccionan zonas | P/T | M | E14‑2, E8‑6 | — | Construido. [PENDIENTE: tarea 6 — E2E] |
| RF-48 | Vista de rayos X rotulada "Ilustrativo" | P/T | C | E14‑4 | — | Construido |
| RF-49 | Sin WebGL o mientras carga el 3D, silueta SVG y la misma información de zonas en HTML accesible | P/T | M | E14‑6 | — | Construido, sin probar con lector de pantalla. [PENDIENTE: tareas 6 y 8] |
| RF-50 | Vista previa del coche que cambia de carrocería y color en el formulario | P/T | S | E14‑3 | — | Construido |
| RF-51 | Taller en 3D con los elevadores numerados, los coches de las órdenes abiertas y una zona de espera, con su equivalente en lista HTML | T | S | E12‑7 | `WorkOrderTest` (ocupación) | Construido |
| RF-52 | Escena 3D en la portada pública, con alternativa estática | — | S | E14‑1 | — | Construido. La simplificación (tarea 16) la sustituye por una imagen estática |

### Documentos, seguimiento y actividad

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-53 | Subida de documentos PDF, JPEG, PNG o WebP de hasta 10 MB, comprobando el tipo real del contenido, con título, tipo, intervención del mismo vehículo y caducidad opcionales | P/T | S | E9‑1 | `DocumentTest` | Construido |
| RF-54 | Listado de documentos filtrable por tipo o por intervención | P/T | S | E9‑2 | `DocumentTest` | Construido |
| RF-55 | Descarga o vista previa solo por una ruta autenticada, con cabeceras seguras | P/T | S | E9‑2 | `DocumentTest` | Construido |
| RF-56 | Borrado de un documento y de su fichero | P/T | S | E9‑3 | `DocumentTest` | Construido |
| RF-57 | Panel de inicio del particular con datos persistidos: vehículos, gasto, recordatorios, actividad y accesos rápidos; estados vacíos con guía | P | M | E5‑1…E5‑7 | `AnalyticsTest` | Construido; falta la guía de primeros pasos para un vehículo sin datos. [PENDIENTE: tarea 26] |
| RF-58 | Diario del vehículo por días con lecturas, gastos, intervenciones, recordatorios completados y documentos, km recorridos y gasto del día; omite días sin eventos | P/T | M | E7‑4 | `AnalyticsTest` | Construido |
| RF-59 | Informe del vehículo con su fecha de generación, imprimible o guardable en PDF desde el navegador | P | S | E10‑1, E10‑2 | `AnalyticsTest` | Construido |
| RF-60 | Registro de actividad de cada escritura, con una frase en español y sin datos sensibles, consultable por espacio y por vehículo | P/T | S | E13‑7 | `WorkspaceMemberTest` | Construido en la API; la pantalla del equipo muestra solo las 10 últimas acciones. [PENDIENTE: tarea 25] |

### Taller: clientes, órdenes y elevadores

| ID | Requisito | Modo | Prior. | Historia | Prueba | Estado |
|----|-----------|------|:------:|----------|--------|--------|
| RF-61 | Gestión de clientes (nombre, email, teléfono, NIF, notas) con búsqueda; borrado solo sin órdenes abiertas (409); en espacios personales estas rutas responden 404 | T | M | E11‑1…E11‑5 | `WorkOrderTest`, `IsolationTest` | Construido |
| RF-62 | Creación de orden de trabajo numerada `OT-AAAA-nnnn`, correlativa por taller y año y sin huecos; nace "recibida" y copia el cliente del vehículo; el km de entrada crea una lectura (en taller se acepta aunque sea menor) | T | M | E12‑1 | `WorkOrderTest` | Construido |
| RF-63 | Tablero kanban por estado con filtros (abiertas, estado, vehículo, cliente, asignado, texto) y marca de retraso | T | M | E12‑2, E12‑6 | `WorkOrderTest` | Construido |
| RF-64 | Cambio de estado libre entre los cinco estados abiertos; "entregada" y "cancelada" son finales (409 a partir de ahí). "Lista" fija la fecha de finalización; un estado final libera el elevador | T | M | E12‑2 | `WorkOrderTest` | Construido |
| RF-65 | Al entregar, en la misma transacción, se crea la intervención en el historial del vehículo con las líneas copiadas, enlazada con la orden, sin una segunda lectura de km y sin gasto | T | M | E12‑5 | `WorkOrderTest` | Construido |
| RF-66 | Un elevador solo admite una orden abierta (409 "El elevador N está ocupado por OT-…"); consulta de la ocupación | T | M | E12‑4 | `WorkOrderTest` | Construido |
| RF-67 | Importes calculados en el servidor: subtotal = suma de líneas; IVA redondeado *half‑up* a céntimos; total = subtotal + IVA | T | M | E12‑3 | `WorkOrderTest` | Construido |
| RF-68 | Edición de órdenes no finales; borrado solo de órdenes recibidas o canceladas | T | M | E12‑3 | `WorkOrderTest` | Construido |
| RF-69 | Centro de control del taller con contadores, órdenes por estado, elevadores, prometidas para hoy, retrasadas, importe de lo entregado (oculto al mecánico), alertas de flota y actividad | T | M | E12‑6 | `WorkOrderTest`, `RolesTest` | Construido |
| RF-70 | "Mis órdenes": el mecánico ve por defecto solo las órdenes que tiene asignadas | T | S | E12‑8 | — | **A medias.** [PENDIENTE: tarea 25 — en curso] |
| RF-71 | Resumen imprimible de la orden rotulado "no es una factura"; el mecánico lo imprime sin precios | T | C | E12‑9 | — | **Pendiente.** D12 = A (24/10). [PENDIENTE: tarea 24] |
| RF-72 | Exportar en JSON los datos de un cliente, sus vehículos y sus órdenes (`manage`) | T | S | E11‑6 | — | **Contrato aprobado el 24/10** (§3.10.1, ADR‑0005). [PENDIENTE: tarea 29 — backend con tests y pantalla] |
| RF-73 | Anonimizar un cliente conservando el historial técnico de sus vehículos (`manage`) | T | S | E11‑6 | — | Como RF-72 |
| RF-74 | Solicitudes de reparación de un particular a un taller, con presupuesto y conversión en orden | P/T | — | E16 | — | **En diseño** desde el 24/10. [PENDIENTE: tarea 32 — ADR‑0007, contrato e historias del arquitecto] |

### Cobertura

| Bloque | RF | Construidos | A medias | Pendientes o en diseño |
|--------|----|:-----------:|:--------:|:----------------------:|
| Sistema y cuenta | 01‑10 | 9 | 0 | 1 (RF-10) |
| Espacios y equipo | 11‑16 | 6 | 0 | 0 |
| Garaje y km | 17‑26 | 9 | 1 (RF-24) | 0 |
| Intervenciones, gastos y analítica | 27‑40 | 13 | 1 (RF-30) | 0 (RF-40: pantalla en curso) |
| Recordatorios y zonas | 41‑46 | 6 | 0 | 0 |
| 3D | 47‑52 | 6 | 0 | 0 |
| Documentos y seguimiento | 53‑60 | 8 | 0 | 0 |
| Taller | 61‑74 | 9 | 1 (RF-70) | 4 (RF-71…74) |
| **Total** | **74** | **66** | **3** | **5** |

Los 66 "construidos" incluyen varios con detalles pendientes que figuran en su fila (RF-36, RF-40, RF-57, RF-60). Ninguno se considera terminado hasta superar las pruebas del capítulo 8.

## 4.3 Requisitos no funcionales

| ID | Categoría | Requisito | Cómo se verifica | Estado a 24/10/2026 |
|----|-----------|-----------|------------------|---------------------|
| RNF-01 | Seguridad · autenticación | Sanctum en modo SPA: cookie de sesión HttpOnly y cabecera `X-XSRF-TOKEN`, sin tokens en `localStorage`; contraseñas con *hash* del framework; regeneración de la sesión al entrar y salir; 5 intentos fallidos por minuto | `AuthTest` | Construido y probado |
| RNF-02 | Seguridad · aislamiento | Todo recurso se resuelve hasta su espacio; un recurso ajeno responde **404**, nunca 403; una prueba de aislamiento por ruta con recurso | `IsolationTest` (215 casos, compara su lista con `route:list`) | Construido y probado. [PENDIENTE: tarea 7] |
| RNF-03 | Seguridad · autorización | Control de acceso por rol aplicado en el servidor con *policies*; la interfaz solo oculta controles por comodidad | `RolesTest` | Construido y probado |
| RNF-04 | Seguridad · entradas y salidas | Validación en cliente (Zod) y en servidor (Form Requests); la autorización se ejecuta antes que la validación, de modo que un recurso ajeno da 404 aunque el cuerpo sea inválido; errores `{ message, errors }` en español sin trazas ni SQL | `ValidationTest` | Construido y probado |
| RNF-05 | Seguridad · ficheros | Disco privado fuera de `public/`, nombre interno UUID, tipo MIME real, máximo 10 MB, descarga solo por controlador autorizado con `X-Content-Type-Options: nosniff` | `DocumentTest` | Construido y probado |
| RNF-06 | Integridad de datos | Dinero en `DECIMAL` y como cadena con 2 decimales en JSON, aritmética en céntimos enteros; km entero ≥ 0 con control de retrocesos; transacciones en las operaciones compuestas; numeración sin huecos con bloqueo | `MaintenanceExpenseTest`, `WorkOrderTest`, `AnalyticsTest` | Construido y probado. La numeración concurrente no tiene prueba con dos procesos (informe del backend, §7) |
| RNF-07 | Veracidad | Ninguna cifra sin fuente real: si falta un dato se dice qué falta y qué acción lo resuelve; zonas "según tus intervalos, no medido"; rayos X "Ilustrativo"; el taller no habla de "facturación" | `AnalyticsTest` (motivos); revisión de textos | API probada; textos de la interfaz en revisión (tareas 16 y 22) |
| RNF-08 | Rendimiento · 3D | three.js en un *chunk* diferido; un único `<Canvas>` por pantalla; `frameloop="demand"` con la escena quieta; densidad de píxeles limitada a [1, 2]; miniaturas estáticas en listados; sin descargas externas | Análisis del *build*, red del navegador, medición de fotogramas | Construido. La auditoría de UX del 23/10 midió que three.js se descargaba en 17 de 26 pantallas y solo 5 mostraban un lienzo. [PENDIENTE: tareas 16 y 20 — limitar el 3D a la ficha y al taller y medir] |
| RNF-09 | Rendimiento · API | Listados paginados (25 por defecto, máximo 100; 200 en el tablero); índices compuestos en las columnas de filtro y orden; sin consultas N+1 | `VehicleTest`, `WorkOrderTest` | Construido. [PENDIENTE: tarea 19 — informe de tiempos y número de consultas] |
| RNF-10 | Accesibilidad | WCAG 2.2 AA: teclado completo, foco visible, contraste AA, tamaño mínimo de objetivo, estado nunca solo por color, `prefers-reduced-motion`, nombre accesible del lienzo 3D y su información también en HTML | axe (0 incidencias críticas o serias), recorrido por teclado, revisión manual | [PENDIENTE: tareas 6 y 8] |
| RNF-11 | Responsive | Sin desplazamiento horizontal a 360, 768 y 1280 px; objetivos táctiles de 44 px en móvil | E2E en tres tamaños | [PENDIENTE: tareas 5 y 6] |
| RNF-12 | Privacidad (RGPD) | Datos mínimos; baja de la cuenta con borrado en cascada; actividad sin datos sensibles; exportar y anonimizar al cliente del taller; secretos solo en variables de entorno | `AuthTest`, `WorkspaceMemberTest`; revisión de `seguridad` | Parcial: RF-72 y RF-73 pendientes (tarea 29). Política de privacidad pendiente antes de cualquier uso real |
| RNF-13 | Mantenibilidad | Contrato como fuente de verdad; capas separadas; módulo 3D tras una interfaz pública; decisiones como ADR; *lint* y comprobación de tipos; sin dependencias injustificadas | `npm run lint`, `npm run typecheck` | Construido |
| RNF-14 | Pruebas | Pruebas automáticas de reglas críticas, aislamiento por ruta, forma JSON del contrato, E2E e integración continua | Capítulo 8 | Backend cumplido (462 pruebas); E2E y CI pendientes (tareas 6 y 11) |
| RNF-15 | Localización | Interfaz y mensajes en español; números, importes y fechas formateados en el cliente con `Intl` (`es-ES`), porque el PHP del entorno no tiene la extensión `intl` | `ValidationTest` (mensajes) | Construido |
| RNF-16 | Compatibilidad | PHP 8.2, Laravel 12, MariaDB 10.4; pruebas en SQLite y MariaDB; navegadores con módulos ES; degradación a 2D sin WebGL | Ejecución de la batería en los dos motores | Construido. Soporte de versiones: D15 pendiente |
| RNF-17 | Propiedad intelectual | Sin modelos 3D, logotipos ni formas de marcas; tipografías libres autoalojadas | Revisión del código 3D y de dependencias | Construido |
| RNF-18 | Usabilidad | Ningún control decorativo; confirmación en acciones destructivas; errores junto al campo; estados de carga, vacío y error en cada pantalla | Revisión de UX | En revisión: el autor pidió simplificar la interfaz el 23/10 (tarea 16) |

## 4.4 Cambios respecto a la especificación del 21/10/2026

| Cambio | Motivo |
|--------|--------|
| Las prioridades marcadas con † (propuestas del documentador) pasan a las del backlog, que el 21/10 incorporó las épicas E7‑E15 | El backlog ya cubre taller, 3D, recordatorios y documentos |
| RF-10 deja de "no tener endpoint" | Contrato §3.1.1 y ADR‑0006 (24/10) |
| RF-43 ya admite confirmar un retroceso de km y define qué pasa con la recurrencia solo por km | Resuelto en el código: `CompleteReminderRequest` acepta `confirm_mileage_drop` y `ReminderService::createNext()` parte del km actual o no crea el siguiente |
| RF-65 aclara que la entrega no crea una segunda lectura de km | `MaintenanceService::createFromWorkOrder()` lo documenta y `WorkOrderTest` lo comprueba |
| RF-40 y RF-69 dejan de hablar de "facturación" | D12 = A (24/10) |
| Nuevos RF-70 a RF-74 | Historias E12‑8, E12‑9, E11‑6 y E16, decididas o diseñadas después del 21/10 |
| La pregunta sobre el orden entre autorización y validación (antigua §4.2 de arquitectura) queda resuelta | Las rutas autorizan con el middleware `can:` antes de que se valide el Form Request (capítulo 7, §7.3) |
