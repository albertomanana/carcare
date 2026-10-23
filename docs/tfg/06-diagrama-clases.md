# 6. Diagrama de clases

*Versión 1 · 21/10/2026 · Autor: agente `documentador-tfg` · Estado: **mixto**. El modelo de dominio y los enumerados se han contrastado con el código que el backend estaba escribiendo durante esta oleada; los servicios y las policies son **diseño, pendiente de verificar contra el código**. La tabla de §6.4 indica el estado de cada clase.*

> **Fuentes.** `backend/app/Models/`, `backend/app/Enums/`, `backend/app/Support/` (consultados el 21/10/2026, en construcción), contrato v1 y [03‑modelo-de-datos.md](03-modelo-de-datos.md). Notación UML: `*--` composición (el hijo se borra con el padre), `--` asociación, `..>` dependencia; `$` marca un método estático.

## 6.1 Modelo de dominio (Eloquent)

Solo se muestran los atributos y métodos más significativos de cada clase; los tipos de dinero se representan como `decimal`, aunque en PHP se manejan como cadenas o céntimos enteros (clase `Money`, §6.3).

```mermaid
classDiagram
  direction TB

  class User {
    +int id
    +string name
    +string email
    +string locale
    +workspaces() BelongsToMany
    +personalWorkspace() Workspace
    +roleIn(workspace) WorkspaceRole
  }

  class Membership {
    <<pivot>>
    +int workspace_id
    +int user_id
    +WorkspaceRole role
  }

  class Workspace {
    +int id
    +string name
    +WorkspaceType type
    +array settings
    +members() BelongsToMany
    +vehicles() HasMany
    +customers() HasMany
    +workOrders() HasMany
    +activities() HasMany
    +isPersonal() bool
    +isWorkshop() bool
    +resolvedSettings() array
    +baysCount() int
    +taxRate() string
  }

  class Customer {
    +int id
    +string name
    +string email
    +string phone
    +string tax_id
    +vehicles() HasMany
    +workOrders() HasMany
  }

  class Vehicle {
    +int id
    +string make
    +string model
    +BodyType body_type
    +string color_hex
    +string plate
    +string vin
    +int current_mileage
    +date mileage_updated_at
    +datetime archived_at
    +mileageLogs() HasMany
    +maintenanceRecords() HasMany
    +expenses() HasMany
    +reminders() HasMany
    +pendingReminders() HasMany
    +documents() HasMany
    +workOrders() HasMany
    +openWorkOrder() HasOne
    +displayName() string
    +isArchived() bool
    +isElectric() bool
  }

  class MileageLog {
    +date recorded_at
    +int mileage
    +MileageSource source
    +int source_id
    +string note
  }

  class MaintenanceRecord {
    +RecordType type
    +Zone zone
    +ServiceKind service_kind
    +string title
    +date service_date
    +int mileage
    +decimal total_cost
    +datetime archived_at
    +items() HasMany
    +expense() HasOne
    +workOrder() HasOne
    +documents() HasMany
    +isArchived() bool
  }

  class MaintenanceItem {
    +ItemKind kind
    +string name
    +decimal quantity
    +decimal unit_price
    +decimal total
    +int position
  }

  class Expense {
    +ExpenseCategory category
    +decimal amount
    +date expense_date
    +int mileage
    +decimal fuel_quantity
    +FuelUnit fuel_unit
    +bool full_tank
    +isLinked() bool
  }

  class Reminder {
    +ReminderKind kind
    +Zone zone
    +date due_date
    +int due_mileage
    +int recurrence_months
    +int recurrence_km
    +date starts_on
    +int start_mileage
    +ReminderStatus status
    +date completed_at
    +int completed_mileage
  }

  class Document {
    +DocumentType document_type
    +string title
    +string disk
    +string path
    +string original_filename
    +string mime_type
    +int size
    +date expires_at
  }

  class WorkOrder {
    +string number
    +WorkOrderStatus status
    +Priority priority
    +int bay
    +int mileage_in
    +datetime promised_at
    +decimal subtotal
    +decimal tax_amount
    +decimal total
    +isLate() bool
  }

  class WorkOrderItem {
    +ItemKind kind
    +string name
    +decimal quantity
    +decimal unit_price
    +decimal total
    +int position
  }

  class Activity {
    +string action
    +string entity_type
    +int entity_id
    +string summary
    +array metadata
  }

  User "1" -- "1..*" Membership
  Workspace "1" -- "1..*" Membership
  Workspace "1" *-- "0..*" Customer
  Workspace "1" *-- "0..*" Vehicle
  Workspace "1" *-- "0..*" WorkOrder
  Workspace "1" *-- "0..*" Activity
  Customer "0..1" -- "0..*" Vehicle : cliente
  Customer "0..1" -- "0..*" WorkOrder : encarga
  Vehicle "1" *-- "0..*" MileageLog
  Vehicle "1" *-- "0..*" MaintenanceRecord
  Vehicle "1" *-- "0..*" Expense
  Vehicle "1" *-- "0..*" Reminder
  Vehicle "1" *-- "0..*" Document
  Vehicle "1" *-- "0..*" WorkOrder
  MaintenanceRecord "1" *-- "0..50" MaintenanceItem
  MaintenanceRecord "0..1" -- "0..1" Expense : gasto vinculado
  MaintenanceRecord "0..1" -- "0..*" Document : adjunta
  WorkOrder "1" *-- "0..*" WorkOrderItem
  WorkOrder "0..1" -- "0..1" MaintenanceRecord : genera al entregar
  User "0..1" -- "0..*" WorkOrder : asignada a
```

**Notas de diseño.**
- `Membership` representa la tabla pivote `workspace_user`; en Eloquent no es un modelo propio sino `belongsToMany(...)->withPivot('role')` en `User` y `Workspace` (✔ verificado).
- `User::roleIn()` devuelve `null` si el usuario no pertenece al espacio, y las policies traducen ese caso en **404** (✔ verificado en el comentario del método).
- Atributos calculados que no se guardan: `Vehicle::displayName()`, `Expense::isLinked()`, `WorkOrder::isLate()`, y el estado y progreso de `Reminder`.

## 6.2 Enumerados principales

Los enumerados son *backed enums* de PHP 8.1+ guardados como `string` en la base de datos (las migraciones usan columnas `VARCHAR`, no `ENUM` de MySQL: añadir un valor no exige migración). Todos comparten el *trait* `EnumHelpers::values()`.

```mermaid
classDiagram
  direction LR

  class WorkspaceType {
    <<enumeration>>
    Personal
    Workshop
  }

  class WorkspaceRole {
    <<enumeration>>
    Owner
    Manager
    Mechanic
    +label() string
    +allows(capability) bool
  }

  class WorkOrderStatus {
    <<enumeration>>
    Received
    Diagnosing
    WaitingParts
    InProgress
    Ready
    Delivered
    Cancelled
    +label() string
    +isFinal() bool
    +releasesBay() bool
    +finalValues()$ array
  }

  class RecordType {
    <<enumeration>>
    Maintenance
    Repair
    Breakdown
    Inspection
    Tyres
    Bodywork
    Other
    +label() string
    +expenseCategory() ExpenseCategory
  }

  class ExpenseCategory {
    <<enumeration>>
    Fuel
    Maintenance
    Repair
    Insurance
    Tax
    Inspection
    Parking
    Tolls
    Cleaning
    Fines
    Other
  }

  class ReminderKind {
    <<enumeration>>
    Itv
    Insurance
    Tax
    Oil
    Service
    Tyres
    Brakes
    TimingBelt
    Battery
    Custom
    +label() string
    +defaultZone() Zone
  }

  class ReminderState {
    <<enumeration>>
    Overdue
    Soon
    Ok
    Unknown
    +label() string
    +severity() int
  }

  class Zone {
    <<enumeration>>
    Engine
    Transmission
    Brakes
    Tyres
    Suspension
    Electrical
    Body
    Interior
    Exhaust
    General
    +label() string
  }

  class MileageSource {
    <<enumeration>>
    Manual
    VehicleCreated
    Maintenance
    Expense
    WorkOrder
    Reminder
    +label() string
  }

  RecordType ..> ExpenseCategory : categoría del gasto vinculado
  ReminderKind ..> Zone : zona por defecto
```

Otros enumerados con la misma forma (sin métodos relevantes para el diseño): `FuelType`, `Transmission`, `BodyType`, `ServiceKind`, `ItemKind`, `FuelUnit`, `ReminderStatus`, `DocumentType`, `Priority`. Valores en [03 §3.3](03-modelo-de-datos.md#33-enumerados).

**Por qué la lógica vive en los enumerados.** Reglas pequeñas y estables del contrato quedan junto al valor al que se refieren y se pueden probar de forma unitaria: qué categoría de gasto corresponde a cada tipo de intervención (`RecordType::expenseCategory`), la zona por defecto de un recordatorio (`ReminderKind::defaultZone`), qué estados son finales o liberan el elevador (`WorkOrderStatus`), la gravedad para ordenar zonas (`ReminderState::severity`) y la tabla de permisos (`WorkspaceRole::allows`).

## 6.3 Servicios, policies y utilidades

> **Diseño, pendiente de verificar contra el código.** A 21/10/2026 no existen todavía `app/Services` ni `app/Policies`. Los nombres y firmas siguen la arquitectura de [04‑arquitectura.md](04-arquitectura.md) y las transacciones de [05‑diagramas-secuencia.md](05-diagramas-secuencia.md). Las utilidades `Money`, `Dates`, `Km` y el *cast* `DateOnly` sí existen (✔).

```mermaid
classDiagram
  direction LR

  class MileageService {
    <<service>>
    +record(vehicle, km, date, source, sourceId, confirmDrop) MileageLog
    +delete(log) void
    +recalculate(vehicle) void
  }

  class MaintenanceService {
    <<service>>
    +create(vehicle, data) MaintenanceRecord
    +update(record, data) MaintenanceRecord
    +archive(record) void
    +restore(record) void
    -syncLinkedExpense(record) void
  }

  class ReminderService {
    <<service>>
    +complete(reminder, data) array
    +dismiss(reminder) Reminder
    +state(reminder) ReminderState
    +progress(reminder) float
  }

  class ZoneStatusService {
    <<service>>
    +forVehicle(vehicle) array
  }

  class VehicleSummaryService {
    <<service>>
    +summary(vehicle, from, to) array
    +costPerKm(vehicle, from, to) array
    +consumption(vehicle, from, to) array
    +journal(vehicle, from, to) array
    +report(vehicle) array
  }

  class WorkOrderService {
    <<service>>
    +create(workspace, data) WorkOrder
    +update(order, data) WorkOrder
    +changeStatus(order, status, bay) WorkOrder
    -nextNumber(workspace, year) string
    -assertBayFree(workspace, bay, order) void
    -deliver(order) MaintenanceRecord
    -computeTotals(order) void
  }

  class DocumentService {
    <<service>>
    +store(vehicle, file, data) Document
    +stream(document, inline) Response
    +delete(document) void
  }

  class ActivityLogger {
    <<service>>
    +log(action, entity, summary, vehicle) Activity
  }

  class Money {
    <<utility>>
    +toCents(value)$ int
    +format(cents)$ string
    +normalize(value)$ string
    +lineTotal(quantity, unitPrice)$ int
    +percentOf(cents, rate)$ int
  }

  class WorkspacePolicy {
    <<policy>>
    +view(user, workspace) bool
    +operate(user, workspace) bool
    +manage(user, workspace) bool
    +own(user, workspace) bool
  }

  class VehiclePolicy {
    <<policy>>
    +view(user, vehicle) bool
    +update(user, vehicle) bool
    +archive(user, vehicle) bool
    +delete(user, vehicle) bool
  }

  class ResourcePolicies {
    <<policy>>
    MaintenanceRecord, Expense, Reminder
    Document, MileageLog, Customer, WorkOrder
  }

  MaintenanceService ..> MileageService : lectura de km
  MaintenanceService ..> ActivityLogger
  MaintenanceService ..> Money
  ReminderService ..> MileageService : km al completar
  ReminderService ..> ActivityLogger
  ZoneStatusService ..> ReminderService : estado por zona
  WorkOrderService ..> MileageService : km de entrada
  WorkOrderService ..> ActivityLogger
  WorkOrderService ..> Money : subtotal, IVA y total
  DocumentService ..> ActivityLogger
  VehicleSummaryService ..> Money
  VehiclePolicy ..> WorkspacePolicy : delega en el espacio
  ResourcePolicies ..> VehiclePolicy : delega en el vehículo
  WorkspacePolicy ..> WorkspaceRole : allows
```

**Responsabilidades.**

| Clase | Responsabilidad | Requisitos |
|-------|-----------------|------------|
| `MileageService` | Único punto que escribe lecturas y la caché `current_mileage`; control de retrocesos | RF-23…RF-26 |
| `MaintenanceService` | Intervención + líneas + gasto vinculado en transacción; archivado y restauración | RF-27…RF-32 |
| `ReminderService` | Estado, progreso, completar con recurrencia, descartar | RF-41…RF-45 |
| `ZoneStatusService` | Las 10 zonas con su estado y base | RF-46 |
| `VehicleSummaryService` | Totales, coste por km, consumo, «desde el último», diario e informe | RF-36…RF-39, RF-58, RF-59 |
| `WorkOrderService` | Numeración sin huecos, elevadores, totales, cambios de estado y entrega | RF-62…RF-68 |
| `DocumentService` | Almacenamiento privado y descarga | RF-53…RF-56 |
| `ActivityLogger` | Registro de actividad sin datos sensibles | RF-60 |
| `WorkspacePolicy` y policies de recurso | Pertenencia (404) y capacidad por rol (403) | RF-16, RNF-02, RNF-03 |
| `Money` (✔) | Aritmética de dinero en céntimos enteros, redondeo *half‑up*, formato de 2 decimales | RNF-06 |

## 6.4 Estado de verificación

**Revisión del 21/10/2026** (`backend/app/`, en construcción por `backend-laravel`).

| Clase | Estado | Fichero |
|-------|--------|---------|
| `User`, `Workspace`, `Vehicle`, `Customer`, `MileageLog`, `MaintenanceRecord`, `MaintenanceItem`, `WorkOrderItem` | ✔ Existen (atributos y relaciones del diagrama contrastados) | `app/Models/*.php` |
| `Expense`, `Reminder`, `Document`, `WorkOrder`, `Activity` | ⏳ Referenciadas por otros modelos; fichero aún no creado en la revisión | — |
| Los 18 enumerados (+ *trait* `EnumHelpers`) | ✔ Existen | `app/Enums/*.php` |
| `Money`, `Dates`, `Km`, `DateOnly` | ✔ Existen | `app/Support/*.php`, `app/Casts/DateOnly.php` |
| Servicios y policies | ⏳ **Diseño, pendiente de verificar contra el código** | — |

> En la oleada 2 se regenerará este diagrama a partir del código final.
