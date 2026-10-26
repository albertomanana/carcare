# E16 · Solicitudes de reparación de un particular a un taller

| Campo | Valor |
|-------|-------|
| Épica | E16 · Solicitudes a talleres (puente particular ↔ taller, D13) |
| Prioridad | Must (pedido por Alberto el 24/10/2026) |
| Estado | Diseñada (26/10/2026). Construcción: tareas 33 (backend), 34 (pantallas del particular) y 35 (pantallas del taller) de `docs/equipo/AUTOPILOTO.md` |
| Para | Particular y taller |
| Depende de | [ADR‑0007](../../docs/arquitectura/ADR-0007-solicitudes-a-talleres.md), [contrato §3.13](../../docs/api/contrato-v1.md#313-directorio-de-talleres-solicitudes-de-reparación-y-notificaciones), E11 (clientes), E12 (órdenes), D12 = A |

*Escrito por el agente `arquitecto` con autorización de la sesión principal (encargo del 26/10). Producto puede reordenarlo o ajustarlo.*

Palabras de Alberto: "Que los clientes puedan solicitar llevar su coche a X taller y este taller vea el coche y decida si lo acepta o no. Y luego también añadir una opción de aceptarlo con presupuesto o añadirlo posteriormente."

## Historias

| ID | Historia | Para | Prioridad | Tarea |
|----|----------|------|-----------|-------|
| E16‑1 | Como **dueño de un taller** quiero aparecer en el directorio de CarCare con mis datos públicos para que los particulares me encuentren | T | Must | 33, 35 |
| E16‑2 | Como **particular** quiero buscar talleres por nombre o ciudad para elegir a cuál llevar el coche | P | Must | 33, 34 |
| E16‑3 | Como **particular** quiero enviar una solicitud de reparación de uno de mis coches a un taller, sabiendo exactamente qué datos verá | P | Must | 33, 34 |
| E16‑4 | Como **taller** (los tres roles) quiero ver las solicitudes recibidas y el coche de cada una | T | Must | 33, 35 |
| E16‑5 | Como **owner o manager** quiero aceptar una solicitud, con presupuesto o sin él, o rechazarla con un motivo | T | Must | 33, 35 |
| E16‑6 | Como **owner o manager** quiero enviar el presupuesto después de aceptar, o una versión nueva si el cliente rechazó la anterior | T | Must | 33, 35 |
| E16‑7 | Como **particular** quiero aceptar o rechazar el presupuesto. Si lo acepto, mi coche entra en el taller como una orden | P | Must | 33, 34 |
| E16‑8 | Como **particular** quiero seguir el estado de la orden de mi coche sin pedírselo al taller | P | Should | 33, 34 |
| E16‑9 | Como **particular** quiero compartir mi historial con el taller, y poder retirarlo, para que presupueste mejor | P | Should | 33, 34, 35 |
| E16‑10 | Como **usuario** quiero una campana con avisos para enterarme de las respuestas sin tener que ir a buscarlas | P+T | Must | 33, 34 |
| E16‑11 | Como **particular** quiero cancelar una solicitud mientras no sea una orden | P | Must | 33, 34 |
| E16‑12 | Como **responsable del proyecto** quiero que cada parte vea solo lo suyo, comprobado con tests | P+T | Must | 33 |

## Criterios de aceptación

**E16‑1 · Perfil del directorio** (`/app/{ws}/ajustes`, owner)
- [ ] Dado un taller que nunca lo ha configurado, cuando su owner abre Ajustes, entonces ve "Aparecer en el directorio" desactivado, con ciudad, dirección, teléfono, servicios (8 casillas) y horario vacíos.
- [ ] Dado el interruptor activado y la ciudad vacía, cuando guarda, entonces ve el error de la API en el campo ciudad (422) y no se publica nada.
- [ ] Dado un manager o un mecánico, cuando abre Ajustes, entonces ve el perfil en solo lectura, sin botón Guardar (la API da 403 al PUT).
- [ ] Dado el perfil guardado con `listed = true`, cuando cualquier particular busca el nombre del taller, entonces aparece con esos datos y con el nombre del espacio.

**E16‑2 · Directorio** (`/app/{ws}/talleres`, espacio personal)
- [ ] Dados los 4 talleres de la demo, cuando busco "lleida", entonces salen "Taller Demo" y "Talleres Ejemplo Norte" y no sale ninguno que no esté en el directorio.
- [ ] Dada una búsqueda sin resultados, entonces veo "No hay talleres con ese nombre o ciudad" y la búsqueda sigue editable.
- [ ] Dado un taller del que soy miembro (`is_member`), entonces no veo "Solicitar reparación" en su tarjeta.
- [ ] Cada tarjeta muestra el nombre, la ciudad, la dirección, el teléfono (enlace `tel:`), los servicios y el horario. Si falta un dato, no se muestra: no se rellena.

**E16‑3 · Nueva solicitud** (`/app/{ws}/solicitudes/nueva?taller={id}`)
- [ ] Dado el formulario, cuando elijo un coche, entonces los km se rellenan con su `current_mileage` y la zona es opcional.
- [ ] Antes de enviar veo el texto de consentimiento exacto del contrato (§3.13.7) con el nombre del taller, y la casilla "Compartir historial" **desmarcada**.
- [ ] Dados unos km menores que el último anotado, cuando envío, entonces veo el error de la API en el campo km (422).
- [ ] Dada una solicitud abierta para el mismo coche y taller, cuando envío otra, entonces veo "Ya tienes una solicitud abierta para este vehículo en este taller." (409).
- [ ] Dadas 5 solicitudes enviadas hoy, cuando envío la sexta, entonces veo el mensaje del 429 y el formulario conserva lo escrito.
- [ ] Al enviarla, llego al detalle con el estado "Enviada", y el owner y el manager del taller tienen una notificación nueva.

**E16‑4 · Bandeja del taller** (`/app/{ws}/solicitudes`)
- [ ] Con pestañas "Nuevas" (`pending`), "Abiertas" (`open`) y "Todas", cuando entro como `taller@`, `gerente@` o `mecanico@`, entonces veo las solicitudes recibidas por fecha descendente.
- [ ] Dado el detalle, entonces veo la silueta 2D con la carrocería y el color, marca, modelo, año, combustible, matrícula, km, asunto, descripción, zona, fecha preferida y el contacto (nombre, email y teléfono). Nunca el apodo ni el VIN.
- [ ] Dada una solicitud con `history_available`, entonces veo "Historial compartido por el cliente" con fecha, tipo, zona, título, km y taller, **sin importes**. Si no, veo "El cliente no comparte su historial".
- [ ] Dado `mecanico@`, entonces no ve los botones de decidir. Si llama a la API, recibe 403.

**E16‑5 · Decidir** (owner o manager, solicitud `pending`)
- [ ] "Aceptar" ofrece dos caminos: "Aceptar y enviar presupuesto ahora" (abre el editor de presupuesto) y "Aceptar, el presupuesto irá después". Con el primero la solicitud pasa a `quoted`; con el segundo, a `accepted`.
- [ ] "Rechazar" pide un motivo obligatorio (5–500) en un diálogo y la deja en `rejected`. El particular ve el motivo.
- [ ] Dadas dos personas que deciden a la vez, entonces una lo consigue y la otra ve "Esta solicitud ya tiene respuesta." (409) con los datos actualizados.

**E16‑6 · Presupuesto** (owner o manager, solicitud `accepted` o `quoted`)
- [ ] El editor tiene líneas (tipo, concepto, referencia, cantidad y precio unitario, este último obligatorio), IVA (por defecto el del taller), validez en días (por defecto 15) y nota. Los totales se ven al escribir, y la cifra que vale es la que devuelve la API.
- [ ] El título del bloque es **"Presupuesto (no es una factura)"** en las dos partes y en cualquier vista imprimible.
- [ ] Enviar una versión nueva deja la anterior como "Sustituido" y avisa al cliente. No se puede editar una versión enviada.
- [ ] Los importes viajan como string con 2 decimales y se formatean con `Intl` en es‑ES.

**E16‑7 · Respuesta al presupuesto** (particular, solicitud `quoted`)
- [ ] Veo la versión vigente con líneas, totales, "Válido hasta dd/mm/aaaa" y la nota. Si `is_expired`, veo "Caducado" y no veo "Aceptar".
- [ ] "Aceptar presupuesto" pide confirmación ("El taller abrirá una orden con estas líneas"). Después veo "En el taller · OT‑AAAA‑NNNN", y en el taller la orden aparece en el tablero en "Recibido" con las mismas líneas y totales, el cliente y el vehículo.
- [ ] Dada una versión nueva que llega mientras miro la anterior, cuando acepto, entonces veo "El taller ha enviado un presupuesto nuevo. Revísalo antes de responder." (409) y se recarga.
- [ ] "Rechazar presupuesto" pide un motivo opcional y la solicitud vuelve a "Aceptada · presupuesto pendiente".
- [ ] Dado el mismo particular con una segunda solicitud convertida en el mismo taller, entonces el taller **no** tiene un cliente duplicado. Dado el mismo coche, tampoco tiene un vehículo duplicado.

**E16‑8 · Seguimiento**
- [ ] En el detalle de una solicitud `converted` veo el número de la orden, su estado con el mismo texto que el tablero del taller y las fechas de recepción, terminado y entrega. No hay ningún enlace a la orden: no tengo acceso a ella.
- [ ] Cuando el taller pasa la orden a "Listo", recibo "Tu Seat Ibiza está listo en Taller Demo (OT‑…)".

**E16‑9 · Historial compartido**
- [ ] En mi solicitud abierta, el interruptor "Compartir historial con el taller" cambia `share_history` (PATCH). Al retirarlo, el taller deja de verlo en su siguiente carga: la API da 403.
- [ ] El enlace "Ver lo que ve el taller" me enseña la misma lista que ve el taller.
- [ ] En una solicitud cerrada, el interruptor no aparece.

**E16‑10 · Notificaciones**
- [ ] La campana está en la cabecera de los dos modos, con el contador de no leídas: "9+" a partir de 10, y `aria-label` "Notificaciones, 3 sin leer".
- [ ] El contador se pide cada 60 s **solo con la pestaña visible**. Con la pestaña oculta no hay peticiones: comprobado en la pestaña Red.
- [ ] Al abrir la campana veo las últimas 20, y "Ver más" carga la página siguiente. Pulsar una notificación lleva a `/app/{workspace_id}/solicitudes/{id}` y la marca como leída. "Marcar todas como leídas" pone el contador a 0.
- [ ] Se usa con teclado: Esc cierra, el foco vuelve a la campana y el foco se ve.

**E16‑11 · Cancelar**
- [ ] En una solicitud `pending`, `accepted` o `quoted`, "Cancelar solicitud" pide confirmación y la deja en "Cancelada". El taller recibe un aviso.
- [ ] En una solicitud `converted`, el botón no aparece. Si se llama a la API, el mensaje es "…llama al taller" (409).
- [ ] Dado un coche archivado y borrado con solicitudes abiertas, entonces esas solicitudes quedan `cancelled` y el taller recibe un aviso. Las cerradas conservan la copia fija.

**E16‑12 · Aislamiento** (tests del backend)
- [ ] Un tercero recibe **404** en todas las rutas `/repair-requests/{r}…`.
- [ ] El taller recibe **404** en `/vehicles/{id}` del vehículo del particular, incluidas sus intervenciones, gastos y documentos.
- [ ] El particular recibe **404** en `/work-orders/{o}` de su orden y en `/customers/{c}` de su ficha de cliente en el taller.
- [ ] Cada parte recibe **403** en las acciones de la otra. El mecánico recibe **403** al decidir.
- [ ] Ninguna `summary` de notificación ni actividad del taller contiene el email ni el teléfono del particular. Las del taller no llevan su nombre, salvo `customer.created`.

## Datos y reglas

Ver el contrato §3.13:
- tablas `workshop_profiles`, `repair_requests`, `repair_quotes` y `notifications`;
- columna `vehicles.source_vehicle_id`.

Validaciones, estados y errores: §3.13.3 a §3.13.5.

## Pantallas implicadas

- **Particular:**
  - "Talleres" (directorio);
  - "Nueva solicitud";
  - "Mis solicitudes" (lista y detalle, con el presupuesto y el seguimiento).
- **Taller:**
  - "Solicitudes" (bandeja y detalle, con decidir y el editor de presupuesto);
  - en Ajustes, "Perfil en el directorio".
- **Las dos:** la campana de la cabecera.

## Pruebas previstas

- **Backend:**
  - Feature tests por endpoint: validación, transiciones válidas e inválidas (409), límites (409 y 429), conversión (cliente y vehículo reutilizados, líneas y totales, lectura de km), borrado del vehículo, notificaciones (destinatarios y frases) y aislamiento (E16‑12);
  - `ContractShapeTest` con las interfaces nuevas.
- **Frontend:** Vitest de los cálculos del editor de presupuesto, del texto de cada estado según la perspectiva y del contador "9+".
- **E2E (tarea 6):** el flujo completo con `demo@` y `taller@`, en este orden:
  1. el particular solicita;
  2. el taller acepta con presupuesto;
  3. el particular lo acepta;
  4. la orden aparece en el tablero;
  5. el taller la pasa a "Listo";
  6. el particular recibe el aviso.

## Fuera de alcance / limitaciones conocidas (v2)

- Mensajes y fotos entre las dos partes.
- Correo (D17 = A).
- Mapa del directorio, valoraciones y precios orientativos.
- Abrir la orden sin presupuesto (renuncia del cliente). "Recibido" significa "orden abierta": la llegada física del coche no se registra.
- Copiar la reparación entregada al historial del particular (D13‑C): pendiente de la pregunta a Alberto en el tablero.
- Plazo de conservación de las solicitudes cerradas sin orden (propuesta: 12 meses).
- Fusionar clientes duplicados cuando la persona ya era cliente del taller, dada de alta a mano.
