# 5. Diagramas de secuencia

*Versión 1 · 21/10/2026 · Autor: agente `documentador-tfg` · Estado: **diseño, pendiente de verificar contra el código**. Los diagramas siguen el contrato v1 ([§3.1, §3.4, §3.5, §3.7, §3.11](../api/contrato-v1.md)) y la arquitectura de capas de [04‑arquitectura.md](04-arquitectura.md). Los nombres de controladores y servicios son de diseño: a 21/10/2026 el backend todavía no tiene controladores ni servicios (sí migraciones, enumerados y modelos base).*

**Convenciones.** Flecha continua = petición o llamada; discontinua = respuesta. Las peticiones de la SPA pasan por el proxy de Vite en desarrollo; para no recargar los diagramas, solo se dibuja en el primero. Las cajas sombreadas son **transacciones de base de datos**: o se confirma todo o no se guarda nada.

## 5.1 Inicio de sesión con Sanctum SPA

Requisitos: RF-04, RF-06, RNF-01. Caso de uso relacionado: iniciar sesión.

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant SPA as SPA React
  participant V as Proxy Vite :5173
  participant L as Laravel API :8000
  participant DB as MySQL

  U->>SPA: Escribe email y contraseña y pulsa Entrar
  SPA->>V: GET /sanctum/csrf-cookie
  V->>L: Reenvía la petición
  L-->>V: 204 + cookies XSRF-TOKEN y de sesión
  V-->>SPA: 204, el navegador guarda las cookies
  SPA->>V: POST /api/v1/auth/login { email, password } + cabecera X-XSRF-TOKEN
  V->>L: Reenvía con las cookies
  L->>L: Middleware: sesión stateful, verificación CSRF, límite de intentos
  alt Más de 5 intentos por minuto para ese email e IP
    L-->>SPA: 429 Demasiados intentos
  else Dentro del límite
    L->>DB: Busca el usuario por email en minúsculas
    DB-->>L: Usuario o ninguno
    L->>L: Comprueba el hash de la contraseña
    alt Credenciales incorrectas
      L-->>SPA: 422 Las credenciales no son correctas
      SPA-->>U: Mensaje genérico junto al formulario
    else Credenciales correctas
      L->>L: Inicia sesión y regenera el identificador de sesión
      L->>DB: Lee los espacios del usuario con su rol
      DB-->>L: Espacios
      L-->>SPA: 200 { data: Me } + cookie de sesión renovada
      SPA->>SPA: Guarda Me en la caché de TanStack Query
      SPA-->>U: Entra en su espacio
    end
  end

  Note over U,DB: Más tarde, al recargar la página o abrir una ruta privada
  SPA->>V: GET /api/v1/me con la cookie de sesión
  V->>L: Reenvía
  alt Sesión válida
    L-->>SPA: 200 { data: Me }
  else Sesión caducada o inexistente
    L-->>SPA: 401
    SPA-->>U: Lleva al login y recuerda la ruta pedida
  end
```

**Por qué así.** La cookie de sesión es HttpOnly (JavaScript no puede leerla) y el token CSRF impide que otra web envíe peticiones en nombre del usuario. Regenerar la sesión al iniciarla evita la fijación de sesión. El mensaje genérico no revela si el email existe.

## 5.2 Crear una intervención con coste (gasto vinculado)

Requisitos: RF-27, RF-28, RF-29, RF-26 · Caso de uso CU-02 · [ADR‑0003](../arquitectura/ADR-0003-gasto-vinculado.md).

```mermaid
sequenceDiagram
  autonumber
  actor P as Particular
  participant SPA as SPA React
  participant R as Rutas y middleware
  participant POL as Policy
  participant FR as Form Request
  participant C as MaintenanceController
  participant S as MaintenanceService
  participant KM as MileageService
  participant DB as MySQL

  P->>SPA: Completa el formulario y pulsa Guardar
  SPA->>SPA: Valida en cliente con Zod
  SPA->>R: POST /api/v1/vehicles/{v}/maintenance + X-XSRF-TOKEN
  R->>DB: Resuelve el vehículo dentro de los espacios del usuario
  alt El vehículo no está en sus espacios
    R-->>SPA: 404
  else Vehículo encontrado
    R->>POL: ¿Puede operar en el espacio del vehículo?
    alt Sin permiso operate
      POL-->>SPA: 403
    else Con permiso
      R->>FR: Valida título, fecha no futura, importes, hasta 50 líneas
      alt Datos no válidos
        FR-->>SPA: 422 { message, errors }
      else Datos válidos
        FR->>C: Datos validados
        C->>S: create(vehículo, datos)
        rect rgba(199, 243, 107, 0.15)
          Note over S,DB: Transacción
          S->>DB: INSERT maintenance_records
          S->>DB: INSERT maintenance_items con total = cantidad x precio
          opt Se indicó kilometraje
            S->>KM: record(vehículo, km, fecha, source maintenance, confirmación)
            KM->>DB: Lecturas de fecha anterior y posterior
            alt Incoherente y sin confirm_mileage_drop
              KM-->>S: Error de validación en mileage
              S-->>DB: ROLLBACK
              S-->>C: Excepción de validación
              C-->>SPA: 422 errors.mileage con el último valor coherente
            else Coherente o confirmado
              KM->>DB: INSERT mileage_logs
              KM->>DB: UPDATE vehicles current_mileage y mileage_updated_at
            end
          end
          opt Espacio personal y total_cost mayor que 0
            S->>DB: INSERT expenses con maintenance_record_id, categoría según el tipo, misma fecha, km e importe
          end
          S->>DB: INSERT activities maintenance.created
        end
        S-->>C: Intervención creada
        C-->>SPA: 201 { data: MaintenanceRecord } con expense_id
        SPA->>SPA: Invalida historial, gastos, resumen, diario y zonas
        SPA-->>P: Confirmación y la intervención en la línea temporal
      end
    end
  end
```

**Puntos clave.**
- La comprobación de pertenencia (404) y de rol (403) se hace **antes** de validar el cuerpo, para no revelar la existencia de recursos ajenos (ver [04 §4.2](04-arquitectura.md#orden-de-validación-y-autorización)).
- Intervención, líneas, lectura de km, gasto vinculado y actividad se confirman **juntos**: no puede quedar un gasto sin intervención ni una intervención con coste sin su gasto.
- Si el km es incoherente, la SPA pide confirmación y repite la petición con `confirm_mileage_drop: true` (CU-03).

## 5.3 Entregar una orden de trabajo

Requisitos: RF-64, RF-65 · Caso de uso CU-07.

```mermaid
sequenceDiagram
  autonumber
  actor M as Mecánico
  participant SPA as SPA React
  participant API as Rutas, Policy y Form Request
  participant C as WorkOrderStatusController
  participant S as WorkOrderService
  participant DB as MySQL

  M->>SPA: Arrastra la tarjeta a la columna Entregado
  SPA-->>M: Pide confirmación: la orden quedará de solo lectura
  M->>SPA: Confirma
  SPA->>API: POST /api/v1/work-orders/{o}/status { status: delivered }
  API->>API: Resuelve la orden en sus espacios, comprueba operate y valida el estado
  API->>C: Petición autorizada y validada
  C->>S: changeStatus(orden, delivered)
  rect rgba(199, 243, 107, 0.15)
    Note over S,DB: Transacción
    S->>DB: SELECT work_orders FOR UPDATE
    alt La orden ya está delivered o cancelled
      S-->>C: Conflicto de estado
      C-->>SPA: 409
      SPA-->>M: Aviso y recarga del tablero
    else Estado abierto
      S->>DB: UPDATE work_orders status delivered, delivered_at ahora, bay null
      S->>DB: INSERT maintenance_records tipo repair, zona general, título, diagnóstico, fecha de entrega, mileage_in, nombre del taller, total
      S->>DB: INSERT maintenance_items copiadas de work_order_items
      S->>DB: UPDATE work_orders maintenance_record_id
      Note right of S: Espacio de taller: no se genera gasto vinculado
      S->>DB: INSERT activities work_order.status_changed
      S-->>C: Orden entregada
      C-->>SPA: 200 { data: WorkOrder } con maintenance_record_id
      SPA->>SPA: Invalida tablero, elevadores, dashboard e historial del vehículo
      SPA-->>M: Tarjeta en Entregado, elevador libre y enlace a la intervención
    end
  end
```

**Puntos clave.**
- El bloqueo `FOR UPDATE` impide que dos usuarios entreguen o modifiquen la misma orden a la vez.
- El enlace orden → intervención se guarda en `work_orders.maintenance_record_id` (✔ verificado en la migración `2026_10_21_000003_create_work_orders_tables.php`); el `work_order_id` que expone la intervención en el JSON se obtiene por la relación inversa.
- **Pendiente de aclarar:** si la intervención creada debe generar una segunda lectura de km con el mismo valor que la de entrada (ver [01 §1.4](01-requisitos.md#14-huecos-y-preguntas-abiertas-detectadas-al-especificar)).

## 5.4 Completar un recordatorio recurrente

Requisitos: RF-43, RF-42, RF-26 · Caso de uso CU-04.

```mermaid
sequenceDiagram
  autonumber
  actor U as Particular o mecánico
  participant SPA as SPA React
  participant API as Rutas, Policy y Form Request
  participant C as ReminderController
  participant S as ReminderService
  participant KM as MileageService
  participant DB as MySQL

  U->>SPA: Pulsa Marcar como hecho e indica fecha, km y Crear el siguiente
  SPA->>API: POST /api/v1/reminders/{r}/complete { completed_at, mileage, create_next }
  API->>API: Resuelve el recordatorio en sus espacios, comprueba operate y valida
  API->>C: Petición autorizada y validada
  C->>S: complete(recordatorio, datos)
  rect rgba(199, 243, 107, 0.15)
    Note over S,DB: Transacción
    opt Se indicó kilometraje
      S->>KM: record(vehículo, km, completed_at, source reminder)
      KM->>DB: INSERT mileage_logs y UPDATE vehicles current_mileage
    end
    S->>DB: UPDATE reminders status done, completed_at, completed_mileage
    alt Tiene recurrencia y create_next no es false
      S->>DB: INSERT reminders pending con starts_on = completed_at y start_mileage = completed_mileage
      Note right of S: due_date = completed_at + recurrence_months<br/>due_mileage = completed_mileage + recurrence_km
    else Sin recurrencia o create_next false
      Note right of S: next = null
    end
    S->>DB: INSERT activities reminder.completed
  end
  S-->>C: completed y next
  C-->>SPA: 200 { data: { completed, next } }
  SPA->>SPA: Invalida recordatorios, agenda, zonas y resumen
  SPA-->>U: Confirmación con el próximo vencimiento
```

**Puntos clave y huecos.**
- El estado (`overdue`, `soon`, `ok`, `unknown`) y el progreso del nuevo recordatorio no se guardan: se calculan al consultarlo.
- **Hueco del contrato:** `CompleteReminderInput` no admite `confirm_mileage_drop`, de modo que no está definido cómo confirmar un km incoherente en este flujo.
- **Hueco del contrato:** con recurrencia solo por km y sin km de completado, el siguiente recordatorio no tendría vencimiento.

## 5.5 Diagrama de estados complementario: orden de trabajo

El ciclo de vida de una orden (contrato §3.11) explica por qué la entrega es la única transición con efectos en otra entidad. Requisitos: RF-62, RF-64, RF-65, RF-66.

```mermaid
stateDiagram-v2
  [*] --> Abierta : crear orden
  state Abierta {
    [*] --> received
    received --> diagnosing
    diagnosing --> waiting_parts
    waiting_parts --> in_progress
    in_progress --> ready
  }
  Abierta --> delivered : entregar, crea la intervención
  Abierta --> cancelled : cancelar
  delivered --> [*]
  cancelled --> [*]
```

- Entre los cinco estados abiertos el movimiento es **libre** en ambos sentidos (tablero kanban); el diagrama muestra el recorrido habitual.
- Pasar a `ready` fija `completed_at`. Pasar a `ready`, `delivered` o `cancelled` libera el elevador salvo que se indique otro.
- `delivered` y `cancelled` son **finales**: cualquier cambio posterior responde 409 y la orden queda de solo lectura.
