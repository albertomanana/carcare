# Informe · arquitecto · E16 Solicitudes de reparación a talleres (tarea 32, paso 1)

*26/10/2026 · encargo de la sesión principal. Empezado desde cero: el intento anterior no dejó nada en disco.*

## Objetivo

Diseñar una v1 de E16 que se pueda construir en 2 días. Alberto la pidió el 24/10: un particular pide a un taller del directorio que le repare el coche, y el taller lo ve y acepta (con presupuesto o sin él) o rechaza. Entregables:
- ADR‑0007;
- sección del contrato;
- tipos aditivos;
- historias;
- tareas 33‑35;
- peticiones;
- como mucho, una pregunta para Alberto.

## Decisiones (todas justificadas en el ADR‑0007)

1. **El taller ve una copia fija del coche, no el coche.**
   - Se copian 7 campos al enviar: marca, modelo, año, combustible, carrocería, color y matrícula. Además van los km declarados.
   - Nunca ve el apodo, el VIN, los gastos ni los documentos.
   - **El historial es optativo y viene desactivado.** Es una proyección sin importes ni textos libres, que solo existe mientras la solicitud está abierta y que se puede retirar.
2. **La orden se crea cuando el cliente acepta el presupuesto,** en una transacción. Esa aceptación es su conformidad con el trabajo y el precio, y así el tablero solo tiene trabajos acordados. "Aceptar sin presupuesto" deja la solicitud en `accepted` hasta que llega el presupuesto.
3. **Presupuestos en versiones inmutables.** El cliente acepta indicando `quote_id`; si el taller envió otra versión entretanto, la API da 409. Si el cliente rechaza, la solicitud vuelve a `accepted` y el taller puede enviar la v2. Las líneas se guardan en JSON y no hace falta otra tabla.
4. **Estados:** `pending`, `accepted`, `quoted`, `rejected`, `cancelled` y `converted`. La tabla de §3.13.4 dice quién hace cada paso, desde qué estado y con qué 409 o 422. Decide el owner o el manager; el mecánico solo ve.
5. **Conversión.**
   - **Cliente:** se reutiliza por una solicitud anterior convertida de la misma persona, **nunca por email**.
   - **Vehículo:** se reutiliza por `vehicles.source_vehicle_id`, una columna interna; si no, por matrícula; si no, se crea.
   - **Orden:** lleva las líneas del presupuesto y `mileage_in` = los km declarados.
   - **Lo que ve el particular:** número, estado y fechas de la orden, dentro de su solicitud.
6. **Notificaciones** con la tabla estándar de Laravel (canal `database`), sin dependencias.
   - Rutas: listado paginado, contador y marcar como leídas.
   - Destinatarios: el owner y los managers del taller y el particular, nunca quien hizo la acción.
   - Las frases no llevan datos personales.
   - En la interfaz, el contador se consulta cada 60 s, solo con la pestaña visible.
7. **Límites anti‑spam:**
   - 5 solicitudes en 24 h (429);
   - una abierta por pareja vehículo‑taller (409);
   - ninguna a un taller del que eres miembro (422).

   Pedir presupuesto a varios talleres a la vez para el mismo coche sí está permitido.
8. **Si el particular borra el vehículo:** sus solicitudes abiertas se cancelan en la misma transacción y se avisa al taller; las cerradas conservan la copia fija.
9. **Directorio:**
   - el perfil lo edita **solo el owner** (`own`), porque Alberto dijo "datos que elige el owner";
   - el nombre público es el del espacio, una sola fuente de verdad;
   - servicios: una lista cerrada de 8.
10. **Mensajes y fotos: v2.** Un hilo no es trivial: necesita otra tabla, sus avisos, sus permisos y su pantalla. En v1, el motivo del rechazo, la nota del presupuesto y el motivo del cliente cubren lo mínimo.
11. **Excepción a ADR‑0002, acotada a 5 vías** con nombre (tabla en el ADR). Ninguna ruta existente cambia y tiene test de 404 cruzado.

## Archivos

| Archivo | Cambio | Zona |
|---------|--------|------|
| `docs/arquitectura/ADR-0007-solicitudes-a-talleres.md` | Nuevo | arquitecto |
| `docs/api/contrato-v1.md` | Nueva §3.13, con 9 subapartados y 18 rutas. Retoques en §2 (excepción), §3.3 (borrar un vehículo), §3.12 (actividades) y §5 (demo). Fila en el historial | arquitecto |
| `frontend/src/api/types.ts` | Solo añade tipos al final (795 → 1056 líneas). No toca ningún tipo existente | arquitecto |
| `CarCare/02_backlog/E16-solicitudes-a-talleres.md` | Nuevo: 12 historias con criterios. **Es zona de producto**, con autorización expresa de la sesión principal; pedí a producto que lo enlace (petición 16) | producto (autorizado) |
| `docs/equipo/AUTOPILOTO.md` | La tarea 32 pasa a Hecho. Las 33, 34 y 35 llevan sus archivos, criterios y dependencias. Edité solo esas 4 filas: el archivo tenía cambios sin guardar de otra sesión y no los toqué | cola (por encargo) |
| `docs/equipo/TABLERO.md` | Mi fila, la pregunta 5 y las peticiones 13‑17 | arquitecto |

No toqué `backend/` ni las pantallas, no hice commit y no leí `.env`.

## Evidencias

- `cd frontend && npm run typecheck`, después de añadir los tipos: termina sin errores (código 0). Lo repetí al final, con los cambios de otros agentes en el árbol, y sigue en 0.
- `npx oxlint src/api/types.ts`: código 0, sin avisos.
- **`ContractShapeTest` no se rompe.** El test recorre solo las interfaces registradas en `Contract::interfaces()` (`tests/Feature/ContractShapeTest.php:152‑158`), así que las interfaces nuevas no lo ponen en rojo. **No cambié `WorkOrder` a propósito**: añadirle `repair_request_id` habría roto el typecheck, porque `three/lab/demoData.ts` y `orderUtils.test.ts` construyen ese tipo completo. El enlace de la orden a su solicitud se consigue con `?work_order_id=` en el listado.
- **Rutas:** `grep` de las filas de §3.13.1 da 18 rutas.
- **No ejecutado:** los tests del backend. No hacía falta, porque no cambié nada del backend ni ningún tipo que el test compruebe.

## Impacto en otros agentes

| Agente | Qué tiene que hacer | Dónde está |
|--------|---------------------|------------|
| backend-laravel | Tarea 33: todo §3.13, unas 8 horas | Petición 13 |
| frontend-react (particular) | Tarea 34. El paso 0 va primero, porque desbloquea la 35 | Petición 14 |
| frontend-react (taller) | Tarea 35 | Petición 15 |
| producto | Enlazar E16 en `backlog-mvp.md` y anotar D13 | Petición 16 |
| documentador-tfg | Recoger ADR‑0007, el diagrama de estados y las tablas nuevas en la memoria | Petición 17 |
| qa-tester | Tarea 6: añadir el E2E del flujo completo, descrito en "Pruebas previstas" de las historias | — |

**Orden de ejecución propuesto:**
1. La 33 y el paso 0 de la 34, en paralelo, porque no se pisan.
2. Después, la 34 y la 35 en paralelo.
3. Por último, la integración con `demo@`, `taller@`, `gerente@` y `mecanico@`.

## Pregunta para Alberto

Pregunta 5 del tablero: al entregar la orden, ¿copiamos la reparación al historial del particular (D13‑C)?
- **A)** No por ahora: se cuenta como trabajo futuro. **Es la que recomiendo**, para llegar al 31/10.
- **B)** Sí: unas 4 horas más de backend.

No bloquea nada.

## Limitaciones y pendientes

- **"Recibido" significa "orden abierta".** La llegada física del coche no se registra en v1.
- **Clientes duplicados.** Si la persona ya era cliente del taller, dada de alta a mano, la conversión crea otro cliente. Es a propósito: no se enlaza por un email sin verificar.
- **Conservación de las solicitudes cerradas sin orden.** En v1 no hay plazo; la propuesta es 12 meses, en v2.
- **Si se borra un taller,** sus solicitudes desaparecen en cascada, también para el particular. Es un caso raro y queda documentado.
- **Hasta que exista la 33,** las pantallas solo se pueden comprobar contra los tipos, no contra datos reales.

## Siguiente paso propuesto

Lanzar la tarea 33 (backend-laravel) y, en paralelo, el paso 0 de la 34. Revisaré la 33 contra §3.13 cuando entregue el informe: transiciones, 404 cruzados y frases sin datos personales.
