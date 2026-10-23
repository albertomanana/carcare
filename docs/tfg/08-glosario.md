# 8. Glosario

*Versión 1 · 21/10/2026 · Autor: agente `documentador-tfg`. Términos del dominio y técnicos tal como se usan en CarCare. Entre paréntesis, el identificador en el código o en la API cuando existe.*

## 8.1 Dominio

| Término | Definición |
|---------|------------|
| **Espacio de trabajo** (`workspace`) | Contenedor de todos los datos de CarCare. Puede ser `personal` (el garaje de un particular, creado automáticamente al registrarse) o `workshop` (un taller o flota). Un usuario puede pertenecer a varios. Ver [ADR‑0002](../arquitectura/ADR-0002-espacios-de-trabajo.md). |
| **Espacio personal** / «Mi garaje» | Espacio de tipo `personal`. Tiene un único miembro, su `owner`. |
| **Taller** / espacio de taller | Espacio de tipo `workshop`, con clientes, órdenes de trabajo, elevadores y varios miembros con roles. |
| **Miembro** | Usuario vinculado a un espacio con un rol (tabla `workspace_user`). |
| **Rol** (`owner`, `manager`, `mechanic`) | Nivel de permisos de un miembro: *propietario*, *gerente* y *mecánico*. Determina sus capacidades. |
| **Capacidad** (`view`, `operate`, `manage`, `own`) | Permiso abstracto que exige una operación: ver, operar (crear/editar), gestionar (archivar, gastos, facturación, miembros, ajustes) y poseer (eliminar el taller). Son acumulativas. |
| **Vehículo** (`vehicle`) | Coche registrado en un espacio. En talleres puede pertenecer a un cliente. |
| **Cliente** (`customer`) | Persona o empresa propietaria de vehículos atendidos por un taller. Solo existe en espacios de taller. |
| **Carrocería** (`body_type`) | Tipo de forma del vehículo (utilitario, berlina, familiar, SUV, coupé, descapotable, monovolumen, furgoneta, pick‑up). Decide la forma del modelo 3D y de la silueta. |
| **Archivar** | Ocultar un vehículo o una intervención de listados y selectores sin borrarlo, con posibilidad de restaurarlo (`archived_at`). |
| **Lectura de kilometraje** (`mileage_log`) | Registro del cuentakilómetros en una fecha, con su origen (`source`): manual, alta del vehículo, intervención, gasto, orden de trabajo o recordatorio. |
| **Kilometraje actual** (`current_mileage`) | Km de la lectura **más reciente por fecha** (desempate: el mayor). Se deriva de las lecturas; no se edita a mano. |
| **Retroceso de kilometraje** | Lectura incoherente con las demás: menor que una de fecha anterior o igual, o mayor que una de fecha posterior. La API la rechaza (422) salvo que se confirme (`confirm_mileage_drop`). |
| **Intervención** (`maintenance_record`) | Cualquier trabajo hecho al vehículo: mantenimiento, reparación, avería, inspección, neumáticos, carrocería u otro. Forma el **historial** del vehículo. |
| **Línea** (`item`) | Partida de una intervención o de una orden: pieza, mano de obra, fluido u otro, con cantidad y precio unitario. |
| **Tipo de servicio** (`service_kind`) | Etiqueta opcional que precisa qué se hizo (aceite, revisión, ITV, frenos…). Permite calcular «desde el último…». |
| **Gasto** (`expense`) | Desembolso asociado a un vehículo, con categoría (combustible, mantenimiento, reparación, seguro, impuestos, inspección, aparcamiento, peajes, limpieza, multas, otros). |
| **Gasto vinculado** | Gasto creado automáticamente por una intervención con coste en un espacio personal. Solo se gestiona desde la intervención (`is_linked`). Evita el **doble conteo**. Ver [ADR‑0003](../arquitectura/ADR-0003-gasto-vinculado.md). |
| **Doble conteo** | Error de sumar dos veces el mismo desembolso (como intervención y como gasto). CarCare lo evita sumando solo la tabla de gastos. |
| **Repostaje** | Gasto de categoría combustible con cantidad (`fuel_quantity`), unidad (`l`, `kwh`, `kg`) y la marca de depósito lleno (`full_tank`). |
| **Lleno‑a‑lleno** | Método de cálculo del consumo: entre dos repostajes con el depósito lleno y km conocido, el consumo es la cantidad repostada después del primero (hasta el segundo, incluido) dividida por los km recorridos × 100. Se exige al menos dos repostajes llenos con km. |
| **Coste por kilómetro** (`cost_per_km`) | Total gastado en un periodo dividido por los km recorridos en él (máximo − mínimo de las lecturas). Solo se muestra si hay ≥ 2 lecturas separadas ≥ 500 km y ≥ 30 días; si no, se explica qué falta. |
| **Periodo anterior** | Intervalo inmediatamente anterior de la misma duración que el consultado; sirve para la variación porcentual (`change_pct`). |
| **«Desde el último…»** (`since_last`) | Días y km transcurridos desde el último cambio de aceite, revisión o ITV registrados. |
| **Recordatorio** (`reminder`) | Aviso de un vencimiento por fecha, por km o por ambos (ITV, seguro, aceite…). Estados guardados: pendiente, hecho, descartado. |
| **Recordatorio recurrente** | Recordatorio con periodicidad en meses y/o km (`recurrence_months`, `recurrence_km`). Al completarlo se crea el siguiente a partir de la fecha y el km de completado. |
| **Estado del recordatorio** (`overdue`, `soon`, `ok`, `unknown`) | Valor **calculado** (no guardado): vencido, próximo (≤ 30 días o ≤ 1.000 km), al día, o sin datos (depende de km y el vehículo no tiene kilometraje). |
| **Progreso** (`progress`) | Fracción de tiempo o km transcurridos del intervalo de un recordatorio, **según los intervalos del usuario**; no es desgaste medido. |
| **Zona** (`zone`) | Una de las 10 áreas del vehículo (motor, transmisión, frenos, neumáticos, suspensión y dirección, eléctrico y batería, carrocería, interior y climatización, escape, general) que agrupan intervenciones y recordatorios y se iluminan en el 3D. |
| **Mapa de zonas** | Vista del estado de las 10 zonas, calculado como el peor estado de sus recordatorios pendientes. Siempre se rotula «según tus intervalos, no medido». |
| **Base del estado de zona** (`basis`) | Origen del estado de una zona: `reminders` (hay recordatorios), `records` (solo historial) o `none` (sin datos). |
| **Documento** | Fichero privado (PDF o imagen) asociado a un vehículo y, opcionalmente, a una intervención: factura, póliza, ITV, permiso de circulación, manual, foto u otro. |
| **Diario** (`journal`) | Vista cronológica por días de todo lo ocurrido con un vehículo (lecturas, gastos, intervenciones, recordatorios completados y documentos), con km recorridos y gasto del día. |
| **Informe del vehículo** (`report`) | Recopilación exportable de la ficha, historial, gastos, lecturas, recordatorios pendientes y documentos, con su fecha de generación. |
| **Actividad** (`activity`) | Registro ligero de auditoría de cada acción de escritura relevante, con una frase en español y sin datos sensibles. |
| **Orden de trabajo** (OT, `work_order`) | Encargo de un taller sobre un vehículo: síntoma, diagnóstico, líneas, importes, mecánico asignado y estado. Se numera `OT-{año}-{nnnn}` por espacio y año. |
| **Estado de la orden** | `received` (recibido), `diagnosing` (diagnosticando), `waiting_parts` (esperando piezas), `in_progress` (en curso), `ready` (listo), `delivered` (entregado) y `cancelled` (cancelado). Los dos últimos son finales. |
| **Tablero kanban** | Vista de las órdenes en columnas por estado, que se mueven arrastrando (o con el teclado). |
| **Orden retrasada** (`is_late`) | Orden cuya fecha prometida ha pasado sin estar lista, entregada ni cancelada. |
| **Entrega de la orden** | Paso a `delivered`. Crea en la misma transacción una intervención en el historial del vehículo con el trabajo realizado. |
| **Elevador** (`bay`) | Puesto de trabajo numerado del taller (1…`bays_count`, máx. 12). Solo puede tener una orden abierta a la vez. |
| **Facturación** (`revenue`) | Suma de los totales de las órdenes entregadas de un taller. No la ve el rol mecánico. |
| **IVA** (`tax_rate`, `tax_amount`) | Tipo impositivo aplicado al subtotal de una orden y su importe, redondeado *half‑up* a 2 decimales. |
| **Datos de demostración** | Datos claramente ficticios que carga `DemoSeeder` para probar y demostrar la aplicación; nunca se ejecutan en producción. |

## 8.2 Técnicos

| Término | Definición |
|---------|------------|
| **API REST** | Interfaz de programación sobre HTTP en la que cada URL representa un recurso y el método (GET, POST, PATCH, DELETE) la operación. En CarCare, bajo `/api/v1` y en JSON. |
| **SPA** (*single‑page application*) | Aplicación web que se carga una vez y actualiza la vista en el navegador sin recargar la página. CarCare usa React. |
| **Contrato de la API** | Acuerdo explícito de rutas, permisos, validaciones y formas JSON (`docs/api/contrato-v1.md` y `frontend/src/api/types.ts`) contra el que se construyen backend y frontend. |
| **Contract‑first** | Forma de trabajo en la que se define primero el contrato y después, en paralelo, el servidor y el cliente. |
| **ADR** (*architecture decision record*) | Documento breve que registra una decisión de arquitectura, su contexto y sus consecuencias (`docs/arquitectura/`). |
| **Laravel Sanctum (modo SPA)** | Paquete de Laravel que autentica una SPA del mismo dominio mediante la cookie de sesión y un token CSRF, sin tokens en el navegador. |
| **CSRF** (*cross‑site request forgery*) | Ataque en el que otra web provoca peticiones con la sesión del usuario. Se evita con el token `XSRF-TOKEN` que el cliente reenvía en `X-XSRF-TOKEN`. |
| **Form Request** | Clase de Laravel que valida (y puede autorizar) una petición antes de que llegue al controlador. |
| **Policy / Gate** | Mecanismo de autorización de Laravel que decide si un usuario puede realizar una acción sobre un recurso. |
| **Eloquent** | ORM de Laravel: cada tabla se representa con un modelo y sus relaciones. |
| **API Resource** | Clase de Laravel que transforma un modelo en la respuesta JSON del contrato. |
| **Transacción** | Grupo de operaciones de base de datos que se confirman todas o ninguna (atomicidad). |
| **Multi‑tenant** | Arquitectura en la que varios clientes (aquí, espacios) comparten la aplicación y la base de datos con sus datos aislados. |
| **RBAC** (*role‑based access control*) | Control de acceso basado en roles. |
| **Aislamiento** | Garantía de que un usuario no puede leer ni modificar datos de un espacio al que no pertenece; en CarCare se responde 404. |
| **DECIMAL** | Tipo SQL de precisión exacta usado para el dinero, a diferencia de la coma flotante binaria. |
| ***Half‑up*** | Redondeo en el que la mitad (x,xx5) se redondea hacia arriba. |
| **Migración** | Fichero de Laravel que crea o modifica tablas de forma versionada y reproducible. |
| **Seeder** | Clase de Laravel que carga datos (p. ej. de demostración) en la base de datos. |
| **WebGL** | API del navegador para dibujar gráficos 3D acelerados por la GPU. |
| **three.js / React Three Fiber / drei** | Biblioteca 3D para WebGL, su integración declarativa con React y su colección de utilidades. |
| **Generación procedural** | Creación de la geometría por código a partir de parámetros (carrocería, color), en lugar de cargar un modelo diseñado externamente. Ver [ADR‑0004](../arquitectura/ADR-0004-vehiculo-3d-procedural.md). |
| **Carga diferida** (*lazy loading*) | Descarga de un módulo (aquí, el 3D) solo cuando se necesita, para no retrasar el arranque. |
| **Chunk** | Fichero JavaScript separado que genera el empaquetador (Vite) y que el navegador descarga por separado. |
| **`frameloop="demand"`** | Modo de React Three Fiber que solo redibuja la escena cuando algo cambia, ahorrando GPU y batería. |
| **Vista rayos X** | Representación ilustrativa con carrocería translúcida y componentes simplificados; no refleja el interior real del vehículo. |
| **Silueta SVG** | Dibujo 2D vectorial del vehículo usado como respaldo cuando no hay WebGL o en listados. |
| **WCAG 2.2 AA** | Pautas de accesibilidad para el contenido web del W3C, versión 2.2, nivel de conformidad AA. |
| **axe** | Motor de análisis automático de accesibilidad (`@axe-core/playwright`). |
| **`prefers-reduced-motion`** | Preferencia del sistema operativo del usuario para reducir animaciones; la aplicación la respeta. |
| **E2E** (*end‑to‑end*) | Prueba que recorre la aplicación completa como un usuario, con navegador, frontend y backend reales (Playwright). |
| **Pest** | Marco de pruebas de PHP construido sobre PHPUnit, usado en el backend. |
| **Vitest** | Marco de pruebas de JavaScript integrado con Vite, usado en el frontend. |
| **RGPD** | Reglamento General de Protección de Datos de la Unión Europea. |
| **MoSCoW** | Técnica de priorización: *Must* (imprescindible), *Should* (importante), *Could* (deseable), *Won't* (no por ahora). |
