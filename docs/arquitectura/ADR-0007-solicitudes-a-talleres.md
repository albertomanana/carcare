# ADR‑0007 · Solicitudes de reparación de un particular a un taller: directorio, presupuesto, orden y notificaciones

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (26/10/2026) |
| Decide | arquitecto. El alcance (E16) lo pidió Alberto el 24/10 y lo fijó la tarea 32 de la cola. La única cuestión de alcance que queda abierta (copiar la reparación al historial del particular al entregar) está en "Preguntas para Alberto" |
| Contrato | [§3.13](../api/contrato-v1.md#313-directorio-de-talleres-solicitudes-de-reparación-y-notificaciones) |
| Relacionado | [ADR‑0002](ADR-0002-espacios-de-trabajo.md) (aislamiento entre espacios, que este ADR abre de forma acotada), [ADR‑0005](ADR-0005-rgpd-cliente-taller.md) (RGPD del cliente del taller), D12 = A (CarCare no emite facturas), D13 (puente taller ↔ particular) |

## Contexto

Alberto, 24/10: "que los clientes puedan solicitar llevar su coche a X taller y este taller vea el coche y decida si lo acepta o no. Y luego también añadir una opción de aceptarlo con presupuesto o añadirlo posteriormente".

Hasta ahora los dos modos de CarCare no se tocan. ADR‑0002 dice que todo dato cuelga de un espacio y que lo de otro espacio es 404. Un particular no puede dirigirse a un taller y un taller no ve nada de un particular. Esto es lo que D13 llama "la tesis del producto": unir los dos segmentos.

Restricciones:
- **2 días** de construcción (backend 1 día; pantallas 1 día, repartidas entre dos agentes). Memoria y defensa antes del 31/10.
- Sin colas, sin correo real (D17 = A: el correo solo va al log), sin servicios externos, sin dependencias nuevas.
- RGPD: el taller recibe datos de una persona que no es su cliente todavía. Hace falta saber qué ve, con qué base y hasta cuándo.
- D12 = A: CarCare calcula importes, pero no emite facturas.
- La autorización se decide en el servidor (regla 3).

## Opciones

Hay cinco decisiones. En cada una, la elegida va en negrita.

### 1. Cómo ve el taller el coche

- A) Acceso en vivo al vehículo del particular (`/vehicles/{v}`) mientras dure la solicitud.
  - En contra: abre todo el vehículo (apodo, VIN, gastos, documentos) y obliga a tocar todas las policies de recursos de vehículo.
- **B) Copia fija de 7 campos tomada al enviar (marca, modelo, año, combustible, carrocería, color, matrícula) más los km declarados. El historial es una proyección de solo lectura y sin importes, y solo existe si el particular lo comparte.**
  - A favor:
    - el particular consiente exactamente lo que ve en el formulario;
    - ninguna policy existente cambia;
    - si el particular borra el coche, la solicitud sigue siendo legible.
  - En contra: si el particular edita el coche después, el taller ve los datos de cuando se envió. Es lo correcto: es lo que se le envió.

### 2. Cuándo se crea la orden de trabajo

- A) Al aceptar el taller la solicitud.
  - En contra:
    - llena el tablero kanban de coches que el cliente todavía no ha aceptado pagar;
    - si el cliente rechaza el presupuesto, hay que cancelar la orden a mano;
    - el taller guarda al cliente en su lista sin que haya ningún acuerdo.
- **B) Cuando el cliente acepta el presupuesto, de forma automática y en la misma transacción.**
  - A favor:
    - en la vida real, la aceptación del presupuesto es la conformidad del cliente con el trabajo y el precio;
    - en el tablero solo hay trabajos acordados;
    - el taller solo copia a su lista de clientes a quien ha llegado a un acuerdo (minimización);
    - un único momento, fácil de probar.
  - En contra: la orden nace en "Recibido" aunque el coche quizá no haya llegado todavía. En v1, "Recibido" significa "orden abierta". La fecha preferida de la solicitud dice cuándo vendrá.
- C) Un paso explícito del taller ("Crear orden") después de que el cliente acepte.
  - En contra: un estado y un endpoint más, y un clic más en la demo, sin ganar nada que se pueda enseñar.

"Aceptar sin presupuesto" encaja con B: el taller dice "sí, te lo miramos" y la solicitud espera en `accepted` hasta que el taller envía el presupuesto. Si el taller necesita ver el coche para presupuestar, el cliente lo lleva en la fecha preferida y el presupuesto llega después.

### 3. Una versión de presupuesto o varias

- A) Un solo presupuesto editable.
  - En contra: el cliente podría aceptar un importe que el taller cambió un segundo antes. Además, no queda constancia de lo que el cliente rechazó.
- B) Un solo presupuesto. Si el cliente lo rechaza, la solicitud se cierra.
  - En contra: sin mensajes (v2), "es caro, ¿y sin el cambio de discos?" obliga a empezar de cero.
- **C) Versiones inmutables (v1, v2…). Cada envío crea una versión nueva y la anterior pasa a `superseded`. Si el cliente rechaza una versión, la solicitud vuelve a `accepted` y el taller puede enviar otra o rechazar.**
  - A favor:
    - el cliente acepta exactamente lo que vio: la aceptación lleva el `quote_id` y, si ya no es la vigente, da 409;
    - queda constancia de cada versión;
    - permite negociar sin un chat.
  - En contra: una lista en vez de un objeto. El coste es pequeño, porque las líneas se guardan como JSON en la propia fila del presupuesto y no necesitan otra tabla.

### 4. Notificaciones

- A) Correo.
  - En contra: D17 = A, el correo solo va al log. No serviría en la demo.
- B) WebSockets (Reverb o Pusher).
  - En contra: un proceso más, configuración y, en el caso de Pusher, un servicio externo. Ninguna necesidad lo justifica.
- **C) Tabla `notifications` estándar de Laravel (canal `database`, ya incluido en el framework) y consulta del contador cada 60 s, solo con la pestaña visible.**
  - A favor:
    - sin dependencias ni procesos nuevos;
    - `notify()`, `unreadNotifications` y `markAsRead` vienen hechos;
    - el retraso máximo es de un minuto, suficiente para un taller.

### 5. Cuánto se abre el aislamiento de ADR‑0002

- A) Añadir al particular como "invitado" del espacio del taller, o al revés.
  - En contra: daría acceso a todo lo que cubre `view` y mezclaría los roles.
- **B) Un recurso compartido entre exactamente dos espacios (la solicitud) y una proyección pública optativa (el directorio). Nada más.**
  - Lo detalla la sección "Excepción acotada a ADR‑0002", más abajo.

## Decisión

1. **Directorio de talleres.** El owner del taller activa "Aparecer en el directorio" y elige ciudad, dirección, teléfono, servicios (lista cerrada de 8) y horario (texto libre). El nombre es el del espacio: una sola fuente de verdad, que se edita en Ajustes. Lo ve cualquier usuario con sesión iniciada, con búsqueda por nombre o ciudad. Nada externo: solo talleres de CarCare.
2. **Solicitud** desde el espacio personal. Lleva:
   - un vehículo propio no archivado y un taller del directorio;
   - asunto y descripción, y la zona si se quiere;
   - fecha preferida y km actuales, que no pueden ser menores que el último kilometraje anotado;
   - un teléfono de contacto opcional;
   - la casilla "Compartir historial", **desactivada por defecto**.

   Los km de la solicitud **no crean una lectura** en el garaje: son un dato declarado para el taller. Así no hace falta un `MileageSource` nuevo.
3. **Estados:** `pending → accepted | quoted | rejected | cancelled`, `accepted → quoted | rejected | cancelled`, `quoted → converted | accepted (el cliente rechaza el presupuesto) | quoted (versión nueva) | rejected | cancelled`. `rejected`, `cancelled` y `converted` son finales. La tabla completa, con quién hace cada paso y los errores, está en el contrato (§3.13.4).
4. **Quién decide.** Solo el owner y el manager del taller (`manage`): aceptar, aceptar con presupuesto, rechazar con motivo, enviar otra versión. El mecánico ve las solicitudes y el historial compartido, pero no decide (403). El particular cancela mientras la solicitud no se haya convertido en orden, y acepta o rechaza el presupuesto.
5. **Presupuesto.** Versiones inmutables con:
   - líneas con precio obligatorio, en DECIMAL y enviadas como string;
   - IVA (por defecto, el del taller);
   - validez en días (1–90, por defecto 15);
   - una nota.

   Totales con las mismas reglas que las órdenes. Caduca solo: `is_expired` se calcula al leerlo y no hace falta ninguna tarea programada. Rótulo: **"Presupuesto (no es una factura)"**.
6. **Conversión** al aceptar el cliente el presupuesto vigente. En una transacción:
   - **cliente:** se reutiliza el cliente del taller creado en una solicitud anterior de la misma persona, si no está anonimizado; si no, se crea uno con nombre, email y teléfono;
   - **vehículo:** se reutiliza la copia del taller enlazada a ese coche (`vehicles.source_vehicle_id`) o, si no existe, uno no archivado con la misma matrícula, y se le pone el enlace; si no hay ninguno, se crea con los datos de la copia fija;
   - **orden:** título = asunto; síntoma = descripción; `mileage_in` = km declarados; líneas e IVA del presupuesto.

   El particular ve número, estado y fechas de la orden en solo lectura, a través de la solicitud.
7. **Notificaciones en la app.** Para la persona que envió la solicitud y para el owner y los managers del taller en ese momento. Nunca para quien hizo la acción, y el mecánico no las recibe. Endpoints: listado paginado, contador y marcar como leídas. Las frases no llevan el nombre del particular.
8. **Límites anti‑spam** (en base de datos, comprobables en tests):
   - como máximo 5 solicitudes por usuario en 24 horas (429);
   - una sola solicitud abierta por pareja vehículo‑taller (409);
   - no se puede enviar una solicitud a un taller del que eres miembro (422).
9. **Mensajes y fotos: v2.** Un hilo de mensajes no es trivial: necesita otra tabla, sus notificaciones, sus permisos y su pantalla. En v1, el motivo del rechazo, la nota del presupuesto y el motivo con el que el cliente lo rechaza cubren la conversación mínima.

## Excepción acotada a ADR‑0002

ADR‑0002 sigue valiendo para todas las tablas existentes. Las únicas vías entre espacios son estas cinco:

| Vía | Qué cruza | Quién lo ve | Cuándo |
|-----|-----------|-------------|--------|
| Directorio | Nombre del taller y los 5 datos que publica el owner | Cualquier usuario con sesión | Solo si `listed = true` |
| Solicitud (`repair_requests`) | Copia fija del coche, km, asunto, descripción, nombre y email del solicitante y teléfono opcional | El owner del espacio personal que la envió y los miembros del taller destinatario | Siempre, mientras existan los dos espacios |
| Historial compartido | Intervenciones no archivadas del coche: fecha, tipo, zona, servicio, título, km y taller. **Sin importes, descripciones, líneas, gastos, documentos ni recordatorios.** Máximo 50 | Las dos partes de la solicitud | Solo con `share_history = true`, la solicitud abierta y el coche sin borrar |
| Resumen de la orden | Número, estado y fechas de la orden creada | El particular, dentro de su solicitud | Desde la conversión |
| Notificación | Una frase y los ids para abrir la solicitud | Su destinatario | Siempre |

Garantías:
- Nadie se hace miembro del espacio de otro.
- Los endpoints de vehículos, intervenciones, gastos, documentos, clientes y órdenes **siguen dando 404** a la otra parte. Hay un test para cada uno.
- Un tercero recibe 404 en todos los endpoints de una solicitud.
- La pertenencia se resuelve siempre en el servidor (`RepairRequestPolicy`): `requester` si el usuario es owner del espacio que envió la solicitud; `workshop` si es miembro del taller destinatario.

## RGPD

- **Qué recibe el taller y con qué base.** El particular envía sus datos para pedir un presupuesto: es una medida precontractual a petición del interesado (art. 6.1.b). El formulario dice exactamente qué verá el taller antes de enviar.
- **Historial: consentimiento aparte** (art. 6.1.a):
  - desactivado por defecto;
  - se puede retirar en cualquier momento mientras la solicitud está abierta (`PATCH share_history = false`), igual de fácil que se dio;
  - el acceso termina solo al cerrarse la solicitud;
  - minimización: sin importes ni textos libres.
- **Al convertirse en orden**, el taller pasa a ser responsable de su copia (cliente y vehículo), con base en el contrato. Le aplica ADR‑0005: exportar y anonimizar.
- **Si el particular borra el vehículo:**
  - las solicitudes abiertas se cancelan solas, en la misma transacción, y se avisa al taller;
  - el historial deja de verse;
  - las cerradas conservan la copia fija como constancia de lo que se pidió;
  - la copia del taller, si ya hubo orden, pierde el enlace (`source_vehicle_id = null`) y sigue siendo del taller.
- **Si el particular borra su cuenta:** su espacio personal y sus solicitudes desaparecen en cascada, y sus notificaciones se borran. Las órdenes ya creadas siguen en el taller, que es responsable de ellas.
- **Pendiente (v2):** plazo de conservación de las solicitudes cerradas sin orden (propuesta: 12 meses, con un comando programado).

## Consecuencias

**En el código y los datos (todo aditivo):**
- Tablas nuevas:
  - `workshop_profiles` (1:1 con el espacio de taller);
  - `repair_requests`, con la copia fija en columnas `vehicle_*`;
  - `repair_quotes`, con las líneas en una columna JSON;
  - `notifications`, la estándar de Laravel.
- Columna nueva `vehicles.source_vehicle_id`: nullable, apunta a otro vehículo y se pone a null al borrarlo. No se expone en el JSON.
- `VehicleService::delete` cancela las solicitudes abiertas de ese vehículo.
- `WorkOrderService`, al pasar a `ready` una orden que viene de una solicitud, avisa al particular.
- `AccountService`, al borrar la cuenta, borra las notificaciones del usuario: la tabla polimórfica de Laravel no tiene clave foránea.
- Tipos nuevos en `types.ts`, sin tocar ninguno existente. `ContractShapeTest` no se rompe: solo comprueba las interfaces que tiene registradas.

**Qué queda más difícil después:**
- Abrir la orden antes del presupuesto (el taller renuncia a presupuestar). Si se necesita, será un paso nuevo, no un cambio de este.
- Fusionar clientes duplicados: si la misma persona ya era cliente del taller, dado de alta a mano, la conversión crea otro cliente. A propósito no se busca por email: un email no verificado no debe enlazar con datos que escribió el taller.

**Fuera de v1:**
- mensajes y fotos;
- correo;
- mapa del directorio, valoraciones y precios orientativos;
- copiar la reparación entregada al historial del particular (D13‑C, en "Preguntas para Alberto");
- plazo de conservación.

## Cómo defenderlo

- "El aislamiento entre espacios no se rompe: se abre una puerta con nombre. Una solicitud tiene dos dueños, el que la envía y el taller, y la policy lo comprueba en cada petición. Para cualquier otro es un 404, y lo prueban los tests."
- "El taller no entra en el garaje del cliente. Recibe una copia de siete datos que el cliente ve antes de enviar. El historial es optativo, viene desactivado, no lleva importes y se puede retirar."
- "La orden nace cuando el cliente acepta el presupuesto, porque esa es la conformidad del cliente. Así el tablero del taller solo tiene trabajos acordados."
- "Los presupuestos no se editan: se versionan. El cliente acepta la versión que vio, y si el taller la cambió entretanto, la API responde 409."
- "Las notificaciones usan la tabla estándar de Laravel y una consulta cada minuto, solo con la pestaña visible. Los WebSockets serían otro proceso que mantener, sin ninguna necesidad que los justifique."
- "Pone 'Presupuesto (no es una factura)' porque CarCare no emite facturas (D12)."
