# ADR‑0005 · Derechos RGPD del cliente del taller: exportar en JSON y anonimizar en lugar de borrar

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (24/10/2026) |
| Decide | arquitecto. El alcance (exportar y anonimizar, E11‑6) lo fijó la cola de tareas (tarea 29) |
| Contrato | [§3.10.1](../api/contrato-v1.md#3101-derechos-rgpd-del-cliente) |

## Contexto

Un taller guarda datos personales de sus clientes: nombre, email, teléfono, NIF y notas. El cliente puede pedir dos cosas:
- una copia de sus datos (derechos de acceso y de portabilidad del RGPD);
- que se borren (derecho de supresión).

Hoy CarCare solo permite **eliminar** al cliente, y eso tiene dos problemas:
- **Deja rastro.** La frase de actividad `customer.created` ("Ana dio de alta al cliente Juan Pérez") conserva su nombre.
- **Rompe la relación con sus datos.** Sus vehículos se quedan sin cliente y sus órdenes, sin `customer_id`.

Por otro lado, el taller necesita conservar el **historial técnico**: qué se le hizo a cada coche, cuándo y por cuánto. Sin él, pierde el valor de la herramienta y la analítica de órdenes entregadas.

Restricciones:
- es un TFG con poco tiempo, sin colas ni servicios externos;
- la autorización se hace en el servidor (regla 3);
- no hay asesoramiento jurídico en el equipo.

## Opciones

### A) Solo eliminar (lo que ya hay)
- A favor: ya existe.
- En contra:
  - su nombre se queda en la actividad;
  - la analítica pierde a qué cliente pertenecía cada orden;
  - no da ninguna copia de los datos.

### B) Anonimizar en el mismo registro y exportar en JSON
- A favor:
  - conserva el `id`, los vínculos, el historial y la analítica;
  - borra de verdad (sobrescribe los datos y no guarda copia);
  - es poco código: una columna nueva (`anonymized_at`) y dos rutas;
  - el JSON es un formato estructurado y legible.
- En contra:
  - no toca los textos libres de órdenes y vehículos ni los archivos adjuntos;
  - la matrícula y el VIN se conservan.

### C) Seudonimizar: mover los datos personales a una tabla cifrada, de forma reversible
- A favor: se puede deshacer.
- En contra:
  - no es suprimir, porque los datos siguen existiendo;
  - añade cifrado y gestión de claves;
  - no aporta nada al TFG.

### D) Borrar en cascada el cliente, sus vehículos y sus órdenes
- A favor: no queda nada.
- En contra: destruye el historial técnico y los importes del taller, y deja huecos en la numeración de las órdenes (OT‑AAAA‑NNNN).

## Decisión

**B.**
- `POST /customers/{c}/export` devuelve un `CustomerExport` con el cliente, sus vehículos y sus órdenes.
- `POST /customers/{c}/anonymize`:
  - deja el nombre en "Cliente anonimizado";
  - pone a null el email, el teléfono, el NIF y las notas;
  - marca `anonymized_at`.

  Es irreversible.
- Las dos acciones son solo para owner y manager.
- Al anonimizar **y al eliminar**, las frases de actividad del cliente se reescriben sin su nombre.

## Consecuencias

**En el código y los datos:**
- Migración aditiva: `customers.anonymized_at`, un timestamp nullable.
- Dos rutas con `can('manage', 'customer')`.
- `PATCH` de un cliente anonimizado ⇒ 409.
- Un `customer_id` anonimizado en un vehículo ⇒ 422.
- No se puede anonimizar a un cliente con órdenes abiertas ⇒ 409 (la misma regla que para eliminar): mientras el coche está en el taller, hay que poder llamarle.
- Dos actividades nuevas: `customer.exported` y `customer.anonymized`, sin el nombre.

**Qué queda más difícil después:**
- Deshacer una anonimización: es imposible, a propósito.
- Si el cliente vuelve, se da de alta otra vez como cliente nuevo.

**Lo que no cubre** (declarado en el contrato y advertido en la pantalla de confirmación):
- los textos libres (título, síntoma y diagnóstico de las órdenes; apodo del vehículo);
- los documentos adjuntos.

## Cómo defenderlo

1. **Se cumple lo que pide el cliente sin perder lo que el taller necesita.** El historial técnico del coche se queda, pero dentro de CarCare deja de estar ligado a una persona identificada: se borran sus datos de contacto y su nombre.
2. **La copia sirve para entregarla.** Es un JSON estructurado y legible, se descarga desde la ficha del cliente y deja constancia en la actividad (quién la exportó y cuándo).
3. **La seguridad está en el servidor.** Mecánico ⇒ 403 y otro taller ⇒ 404, con tests de permisos y de aislamiento, como en todos los endpoints.
4. **Los límites se declaran.**
   - La matrícula y el VIN siguen permitiendo identificar el coche fuera de CarCare.
   - Los textos libres y los archivos no se analizan automáticamente.
   - Si el taller tiene la obligación legal de conservar algún documento, esa obligación va por delante (CarCare no emite facturas: D12 = A).
   - Esto es una decisión técnica razonada, no un asesoramiento jurídico.
