# 7. Implementación

Este capítulo recorre la implementación con fragmentos del código real. Cada fragmento indica su archivo y procede del commit `e530d3e` de la rama `develop` (26/10/2026); algunos se han recortado, y el recorte se marca con `…`. No se reproduce el código completo: el repositorio es la referencia.

## 7.1 Entorno y versiones

| Pieza | Versión instalada | Fuente |
|-------|-------------------|--------|
| PHP | 8.2.12 (XAMPP) | `php --version` |
| Laravel | 12.70.0 | `backend/composer.lock` |
| Laravel Sanctum | 4.3.3 | `backend/composer.lock` |
| Pest | 3.8.7 (sobre PHPUnit 11) | `backend/composer.lock` |
| MariaDB | 10.4.32 (XAMPP) | Informe del backend del 23/10 |
| Node.js | 25.6.1 | `node --version` |
| React | 19.3.1 | `frontend/node_modules` |
| TypeScript | 6.0.3 | ídem |
| Vite | 8.3.5 | ídem |
| React Router | 8.5.0 | ídem |
| TanStack Query | 5.104.5 | ídem |
| React Hook Form / Zod | 7.90.0 / 3.25.76 | ídem |
| Tailwind CSS | 4.3.3 | ídem |
| three.js / React Three Fiber / drei | 0.186.1 / 9.8.2 / 10.7.9 | ídem |
| Recharts | 3.10.1 | ídem |
| Vitest / Playwright | 4.1.12 / 1.64.1 | ídem |

Composer no está en el `PATH` del equipo; se usa el envoltorio `.tools/composer`. El PHP de XAMPP no tiene activada la extensión `intl`, de modo que el formateo de números y fechas se hace en el navegador con `Intl` (§7.5.5). Las versiones con soporte caducado o próximo a caducar (Node 25, PHP 8.2) están recogidas en la decisión pendiente D15 (capítulo 2, §2.5).

## 7.2 Estructura del repositorio

```text
CarCare/
├── backend/                 API Laravel 12
│   ├── app/
│   │   ├── Enums/           18 enumerados + EnumHelpers
│   │   ├── Http/
│   │   │   ├── Controllers/ 14 controladores delgados
│   │   │   ├── Middleware/  ForceJsonResponse
│   │   │   ├── Requests/    Form Requests por área
│   │   │   └── Resources/   formas JSON del contrato
│   │   ├── Models/          13 modelos Eloquent
│   │   ├── Policies/        WorkspaceScopedPolicy + 9 policies
│   │   ├── Services/        17 servicios
│   │   └── Support/         Money, Dates, LineItems, Totals…
│   ├── database/            migraciones, factorías y DemoSeeder
│   ├── routes/api.php       68 rutas bajo /api/v1
│   └── tests/Feature/       14 archivos de pruebas (Pest)
├── frontend/                SPA React 19
│   └── src/
│       ├── api/             cliente HTTP, claves de caché, hooks y types.ts (contrato)
│       ├── app/             enrutador, tema
│       ├── components/      interfaz común, formularios, gráficos, vehículos
│       ├── features/        una carpeta por área (auth, garage, vehicle, workshop…)
│       ├── lib/             formato, validación, permisos, etiquetas
│       └── three/           módulo 3D (propiedad del agente experto-3d)
├── docs/                    contrato de la API, ADR, memoria y equipo
├── scripts/                 arranque de la API, piloto automático, GitHub
└── iniciar-carcare.bat      arranque local con un clic
```

Tamaño por área, contado sobre el árbol de trabajo el 26/10/2026 con `find … | wc -l` (líneas físicas, incluidos comentarios y líneas en blanco):

| Área | Archivos | Líneas |
|------|---------:|-------:|
| `backend/app` | 136 | 7.580 |
| `backend/database` | 11 | 2.106 |
| `backend/tests` | 19 | 4.116 |
| `frontend/src` sin el 3D | 160 | 21.967 |
| `frontend/src/three` | 36 | 7.298 |

Las cifras del backend incluyen cambios sin confirmar de las tareas 27 y 28 que otro agente tenía en curso ese día; son orientativas.

## 7.3 Autorización por espacio y rol

La regla de oro 3 dice que cada recurso se resuelve a través de su espacio y del rol del usuario, y que un recurso ajeno responde 404. La implementación tiene tres piezas.

**1. Cada ruta declara la capacidad que exige** (`backend/routes/api.php`):

```php
Route::prefix('vehicles/{vehicle}')->group(function () {
    Route::get('/', [VehicleController::class, 'show'])->can('view', 'vehicle');
    Route::patch('/', [VehicleController::class, 'update'])->can('operate', 'vehicle');
    Route::delete('/', [VehicleController::class, 'destroy'])->can('manage', 'vehicle');
    Route::post('archive', [VehicleController::class, 'archive'])->can('manage', 'vehicle');
    // …
    Route::get('expenses', [ExpenseController::class, 'index'])->can('manage', 'vehicle');
```

`->can()` añade el middleware de autorización de Laravel, que llama a la *policy* del modelo resuelto por el *route model binding*. Ese middleware se ejecuta antes de que el controlador reciba su *Form Request*, así que **la autorización siempre precede a la validación**. La clase base de los *Form Requests* lo deja escrito para quien lea el código (`backend/app/Http/Requests/ApiRequest.php`): "La autorización NO se hace aquí: cada ruta lleva su middleware `can:` (policies), que se ejecuta antes de validar. Así un recurso ajeno responde 404 aunque el cuerpo sea inválido."

**2. Una sola *policy* base decide entre 404 y 403** (`backend/app/Policies/WorkspaceScopedPolicy.php`):

```php
abstract class WorkspaceScopedPolicy
{
    /** Espacio al que pertenece el recurso (normalmente a través de su vehículo). */
    abstract protected function workspaceIdOf(Model $model): int;

    public static function check(User $user, int $workspaceId, string $capability): Response
    {
        $role = $user->roleIn($workspaceId);

        if ($role === null) {
            return Response::denyAsNotFound();
        }

        return $role->allows($capability)
            ? Response::allow()
            : Response::deny('No tienes permiso para esta acción.');
    }
}
```

Cada *policy* concreta solo dice cómo llegar al espacio de su recurso. Por ejemplo, `ExpensePolicy::workspaceIdOf()` devuelve `$model->vehicle->workspace_id` y `WorkOrderPolicy`, `$model->workspace_id`. La tabla de verdad de los roles está en `WorkspaceRole::allows()` (§6.3). `WorkspacePolicy` añade dos variantes, `viewWorkshop` y `operateWorkshop`, que responden 404 si el espacio es personal: para un particular, las rutas de clientes, órdenes y elevadores no existen.

**3. Una prueba impide olvidar el caso de aislamiento de una ruta nueva** (`backend/tests/Feature/IsolationTest.php`):

```php
it('los datasets cubren todas las rutas de route:list --path=api', function () {
    // … normaliza método y URI de las rutas registradas y de los datasets …
    expect($routes->diff($covered)->values()->all())->toBe([], 'Rutas sin test de aislamiento/401')
        ->and($covered->diff($routes)->values()->all())->toBe([], 'Entradas del dataset que ya no existen');
});
```

La misma prueba recorre todas las rutas y exige `auth:sanctum` en las no públicas y un middleware `can:` en las que reciben un recurso. Después, un usuario intruso, con sus propios espacios, llama a cada una de las 58 rutas con recurso con un cuerpo incompleto y debe recibir exactamente `{"message": "Recurso no encontrado."}`. Si alguien añade una ruta sin su caso, o sin `can:`, la batería falla. El capítulo 8 da los resultados.

**En el cliente**, `frontend/src/lib/permissions.ts` replica la tabla de capacidades solo para no mostrar botones que el usuario no puede usar (regla de oro 5). Si la SPA se equivocara, el servidor respondería 403 o 404 igualmente.

## 7.4 Reglas de negocio en el servidor

Los controladores se limitan a recibir la petición validada, llamar a un servicio y devolver un *Resource*. Por ejemplo, `MaintenanceController::store()` tiene dos líneas: `$this->maintenance->create($vehicle, $request->validated())` y la respuesta 201. Las reglas están en los servicios.

### 7.4.1 Dinero exacto

`backend/app/Support/Money.php` convierte cualquier importe a céntimos enteros y hace toda la aritmética con enteros:

```php
/** cantidad × precio unitario, redondeo half-up a céntimos. null si no hay precio. */
public static function lineTotal(string|int|float $quantity, string|int|float|null $unitPrice): ?int
{
    // …
    // La cantidad también tiene 2 decimales: se trabaja en centésimas.
    $product = self::toCents($quantity) * self::toCents($unitPrice);

    return intdiv($product + 50, 100);
}

/** Porcentaje de un importe (p. ej. IVA '21.00'), redondeo half-up a céntimos. */
public static function percentOf(int $cents, string|int|float $rate): int
{
    return intdiv($cents * self::toCents($rate) + 5000, 10000);
}
```

`toCents()` analiza la cadena con una expresión regular en lugar de convertirla a `float`, de modo que `"0.10"` son exactamente 10 céntimos. Las sumas de muchos gastos y el IVA de las órdenes no acumulan error de redondeo. El IVA se redondea *half‑up* a céntimos (RF-67). El resultado vuelve a texto con dos decimales (`Money::format()`), que es como viaja en JSON.

### 7.4.2 Gasto vinculado sin doble conteo (ADR‑0003)

`backend/app/Services/MaintenanceService.php`:

```php
/** D3-A: crea, actualiza o elimina el gasto vinculado según el coste y el estado. */
public function syncLinkedExpense(MaintenanceRecord $record): void
{
    $vehicle = $record->vehicle;
    if (! $vehicle->workspace->isPersonal()) {
        return;
    }

    $cents = Money::toCents($record->total_cost);

    if ($record->isArchived() || $cents <= 0) {
        Expense::query()->where('maintenance_record_id', $record->id)->delete();

        return;
    }

    Expense::query()->updateOrCreate(
        ['maintenance_record_id' => $record->id],
        [
            'vehicle_id' => $vehicle->id,
            'category' => $record->type->expenseCategory(),
            'description' => $record->title,
            'amount' => Money::format($cents),
            // … fecha, km y moneda de la intervención; sin datos de repostaje …
        ],
    );
}
```

El método se llama desde `create()`, `update()`, `archive()` y `restore()`, siempre dentro de la misma `DB::transaction` que la intervención. `updateOrCreate` sobre la columna única `maintenance_record_id` garantiza que haya como mucho un gasto por intervención. `ExpenseService` rechaza con 409 editar o borrar un gasto vinculado ("Este gasto se gestiona desde su intervención."). Como todos los totales (resumen, panel, analítica, informe) se calculan solo desde `expenses`, el mismo desembolso no puede contar dos veces; `MaintenanceExpenseTest` y `AnalyticsTest` lo comprueban con importes conocidos.

### 7.4.3 Kilometraje coherente

Toda escritura de kilometraje pasa por `MileageService`. Cualquier dato con km (lectura manual, intervención, gasto, orden, recordatorio completado) mantiene **una** lectura ligada a su origen con `syncForSource()`, y antes de guardarla se comprueba que no rompe la secuencia (`backend/app/Services/MileageService.php`):

```php
public function assertConsistent(Vehicle $vehicle, int $mileage, string $date, bool $confirmed, ?int $ignoreLogId = null): void
{
    if ($confirmed) {
        return;
    }
    // …
    $earlier = (clone $base)
        ->where('recorded_at', '<=', $date)
        ->where('mileage', '>', $mileage)
        ->latestFirst()
        ->first();

    if ($earlier) {
        throw ValidationException::withMessages(['mileage' => [sprintf(
            'El kilometraje no cuadra con lecturas anteriores (último: %s el %s). Confírmalo si es correcto.',
            Km::human($earlier->mileage),
            Dates::human($earlier->recorded_at),
        )]]);
    }
    // … y lo simétrico con una lectura posterior de menos km …
}

/** current_mileage = lectura más reciente por fecha (desempate: mayor km). */
public function recalculate(Vehicle $vehicle): void
{
    $latest = MileageLog::query()->where('vehicle_id', $vehicle->id)->latestFirst()->first();

    $vehicle->forceFill([
        'current_mileage' => $latest?->mileage,
        'mileage_updated_at' => $latest?->recorded_at,
    ])->save();
}
```

Un retroceso no se prohíbe, porque puede ser legítimo (cambio de cuadro de instrumentos, corrección de una lectura mal escrita). Se responde 422 con el valor coherente y solo se acepta si el cliente reenvía `confirm_mileage_drop: true` (RF-23, CU-03). En los talleres, el km de entrada de una orden se acepta aunque sea menor (`confirmed: true` en `WorkOrderService::syncMileage()`), porque el taller anota lo que ve en el cuentakilómetros. Las lecturas que no son manuales solo se pueden borrar desde su origen (409).

### 7.4.4 Numeración de órdenes y elevadores

`backend/app/Services/WorkOrderService.php`:

```php
public function create(Workspace $workspace, array $data): WorkOrder
{
    return DB::transaction(function () use ($workspace, $data) {
        // Bloqueo del espacio: serializa numeración y asignación de elevadores entre peticiones concurrentes.
        $this->lock($workspace);

        $vehicle = Vehicle::query()->where('workspace_id', $workspace->id)->findOrFail($data['vehicle_id']);
        $year = (int) now()->year;
        $sequence = (int) WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->where('year', $year)
            ->max('sequence') + 1;
        // … número OT-AAAA-NNNN, cliente del vehículo, IVA por defecto del taller …
        if ($order->bay !== null) {
            $this->ensureBayIsFree($workspace, $order->bay);
        }
        // … totales, líneas, lectura de km de entrada y actividad …
    });
}

private function lock(Workspace $workspace): void
{
    Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();
}
```

El `SELECT … FOR UPDATE` sobre la fila del taller hace que dos peticiones simultáneas del mismo taller se ejecuten una detrás de otra dentro de esta sección. Con ello, el `máx(sequence) + 1` no puede repetirse y `ensureBayIsFree()` no puede aprobar el mismo elevador dos veces. Si algo falla (un elevador ocupado da 409, un vehículo de otro espacio da 422), la transacción se deshace y el número no se consume: no quedan huecos (RF-62). Los índices únicos `(workspace_id, year, sequence)` y `(workspace_id, number)` son la última defensa. La entrega de la orden, que crea la intervención en el historial, se ha descrito en el §6.6.3.

### 7.4.5 Errores uniformes y en español

Toda la API responde JSON con la forma `{ message, errors? }`, sin trazas ni SQL. Se configura en un solo lugar (`backend/bootstrap/app.php`):

```php
$exceptions->render(function (HttpExceptionInterface $e, Request $request) {
    // …
    $message = match ($status) {
        401 => 'No autenticado.',
        403 => 'No tienes permiso para esta acción.',
        404 => 'Recurso no encontrado.',
        419 => 'La sesión ha caducado. Recarga la página e inténtalo de nuevo.',
        // 409 y 429 llevan mensajes propios en español desde los servicios.
        // …
    };
    return response()->json(['message' => $message], $status, $e->getHeaders());
});

$exceptions->render(function (Throwable $e, Request $request) {
    // Cualquier otro error no previsto: se registra en el log, pero nunca se exponen trazas ni SQL.
    // …
});
```

Los conflictos de estado se lanzan como `ConflictException` (409) desde los servicios, con un mensaje que explica la causa ("El elevador 3 está ocupado por OT-2026-0012"). Los errores de validación llevan sus mensajes en español desde cada *Form Request* y `backend/lang/es.json`. El middleware `ForceJsonResponse` garantiza que Laravel nunca devuelva una página HTML de error a la SPA.

### 7.4.6 Documentos privados

`backend/app/Services/DocumentService.php` guarda cada fichero fuera de `public/`, con un nombre interno aleatorio y la extensión que corresponde a su tipo real:

```php
public function store(Vehicle $vehicle, UploadedFile $file, array $data): Document
{
    $mime = $file->getMimeType() ?? 'application/octet-stream'; // MIME real (fileinfo), no el del cliente
    $extension = self::EXTENSIONS[$mime] ?? 'bin';
    $path = $file->storeAs("documents/{$vehicle->workspace_id}", Str::uuid().'.'.$extension, self::DISK);
    try {
        return DB::transaction(function () use (/* … */) { /* … fila del documento y actividad … */ });
    } catch (\Throwable $e) {
        Storage::disk(self::DISK)->delete($path);
        throw $e;
    }
}
```

El tipo se detecta por el contenido del fichero, no por la extensión ni por lo que declara el navegador; la validación solo admite PDF, JPEG, PNG y WebP de hasta 10 MB. Si la transacción falla, el fichero ya escrito se borra. La descarga pasa por `DocumentController::download()`, protegida por la *policy*, que responde con `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`. El nombre original se sanea (`sanitizeFilename()`) antes de guardarlo y de usarlo en `Content-Disposition`.

### 7.4.7 Registro de actividad

`ActivityLogger` guarda, para cada escritura, una frase en español lista para mostrar y unos metadatos con identificadores y valores de negocio, nunca secretos ni datos personales sensibles. Hoy la frase incluye siempre el nombre de quien actúa ("Lucía Demo registró 54.000 km en Kia Sportage").

> [PENDIENTE: petición 9 del tablero — el contrato (§3.12) ya dice que en los espacios personales la frase va en segunda persona y sin nombre ("Anotaste 54.000 km…"), pero `ActivityLogger` aún no distingue el tipo de espacio.]

## 7.5 La aplicación de página única

### 7.5.1 Enrutado y carga diferida

Cada pantalla es un *chunk* propio que se descarga al visitarla (`frontend/src/app/router.tsx`):

```tsx
// Cada pantalla es un chunk propio (carga inicial ligera; three.js solo llega con las pantallas 3D)
const Landing = lazy(() => import('@/features/landing/LandingPage'))
const Login = lazy(() => import('@/features/auth/LoginPage'))
// … 26 pantallas y pestañas más …
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '/dev/3d', Component: lazy(() => import('@/features/dev/ThreeLabPage')) }]
  : []
```

Las rutas privadas cuelgan de `RequireAuth` (`features/auth/guards.tsx`), que consulta la sesión con `GET /me` y, si no la hay, lleva a `/entrar?volver=…` para regresar después a la ruta pedida. `WorkspaceRoute` resuelve el espacio activo a partir del segmento `:ws` de la URL y ofrece al resto de pantallas su tipo, su rol y la función `can()`. La ruta `/dev/3d` (laboratorio visual del 3D) solo existe en desarrollo.

### 7.5.2 Cliente HTTP y CSRF

No se usa ninguna biblioteca HTTP: `frontend/src/api/client.ts` envuelve `fetch` en 268 líneas. Envía siempre la cookie de sesión (`credentials: 'include'`), añade la cabecera `X-XSRF-TOKEN` leída de la cookie `XSRF-TOKEN` en las peticiones que modifican datos y convierte cualquier respuesta de error en un `ApiError` con el código, el mensaje del servidor y los errores por campo. Si el token CSRF ha caducado (419), pide uno nuevo y repite la petición una sola vez. Un 401 avisa al proveedor de autenticación, que limpia la sesión y vuelve a la pantalla de entrada.

### 7.5.3 Estado del servidor en caché

TanStack Query guarda en caché cada respuesta bajo una clave jerárquica (`frontend/src/api/keys.ts`):

```ts
/**
 * Claves estables de TanStack Query. Jerarquía pensada para invalidar por prefijo:
 *  ['workspaces', ws, …]  → todo lo que cuelga de un espacio (dashboard, listados, agenda…)
 *  ['vehicles', id, …]    → todo lo de un vehículo (resumen, zonas, diario, historial, gastos…)
 */
```

Tras una mutación se invalida el prefijo afectado: al registrar una intervención se invalida `['vehicles', id]`, y con ello el resumen, las zonas, el diario, el historial y los gastos se vuelven a pedir. El cliente no recalcula nada que ya calcula el servidor (totales, estados de recordatorios, coste por km): solo lo muestra.

### 7.5.4 Formularios: validación doble y conflicto de kilometraje

Los formularios usan React Hook Form con esquemas Zod que replican los límites del contrato (`frontend/src/lib/validation.ts`: km entre 0 y 2.000.000, importes hasta 999.999,99, fechas no futuras). La validación del cliente solo da respuesta inmediata; el servidor valida igualmente. Un 422 del servidor se lleva a cada campo con `handleFormError()` (`frontend/src/lib/forms.ts`).

El caso del kilometraje que no cuadra tiene un tratamiento propio (`frontend/src/features/vehicle/dialogs/MileageDialog.tsx`):

```tsx
mutation.mutate(
  {
    recorded_at: values.recorded_at,
    mileage: parseIntegerInput(values.mileage) ?? 0,
    note: values.note.trim() || null,
    ...(conflict && confirmDrop ? { confirm_mileage_drop: true } : {}),
  },
  {
    // …
    onError: (err) => {
      const drop = isMileageConflict(err)
      if (drop) {
        setConflict(drop)
        setConfirmDrop(false)
        return
      }
      handleFormError(err, setError, ['recorded_at', 'mileage', 'note'], setOrphans)
    },
  },
)
```

Si el servidor responde 422 por un retroceso, el diálogo muestra su mensaje ("El kilometraje no cuadra con lecturas anteriores…") con la casilla "Confirmo que el kilometraje es correcto" (`MileageConflictNotice`). Solo si el usuario la marca se reenvía con la confirmación. El formulario de intervención y el de gasto siguen el mismo patrón.

### 7.5.5 Formato con `Intl`

Todas las cifras de la interfaz pasan por `frontend/src/lib/format.ts`, que usa `Intl.NumberFormat` y `Intl.DateTimeFormat` con la configuración regional `es-ES`. El dinero llega como texto del servidor y solo se convierte a número para formatearlo. Se hace en el cliente porque el PHP del entorno no tiene `intl`; el servidor solo formatea las frases de actividad, con `number_format()`.

## 7.6 El módulo 3D

### 7.6.1 Generación procedural del vehículo

El coche no es un modelo descargado: se genera por código para cada uno de los 9 tipos de carrocería (ADR‑0004, D16). La cadena tiene cuatro pasos, y los tres primeros son matemática pura sin three.js:

1. **Especificación paramétrica** (`frontend/src/three/car/specs.ts`). Para cada carrocería: largo, ancho, batalla, voladizo, radio de rueda y las líneas del perfil lateral (línea superior, inferior y de techo), con los puntos de las lunas y los asientos. Su comentario de cabecera lo dice: "Formas genéricas propias: ninguna reproduce un modelo comercial."
2. **Perfiles con esquinas redondeadas** (`car/profile.ts`). `makeProfile()` convierte una polilínea en una curva muestreada, sustituyendo cada esquina por un arco tangente del radio indicado.
3. **Forma derivada** (`car/shape.ts`). Secciones transversales, pasos de rueda, habitáculo y ventanillas.
4. **Ensamblado** (`car/build.ts`). Construye las geometrías con three.js, las **fusiona por material** (unas 15‑20 llamadas de dibujo por coche) y las **memoriza por carrocería**: todos los lienzos y los coches del taller comparten la misma geometría. El color no está en la geometría sino en el material, así que cambiarlo no regenera nada.

Como los pasos 1‑3 no dependen de three.js, la silueta SVG de respaldo (`silhouette/`) se dibuja con los mismos perfiles: el 2D y el 3D tienen exactamente la misma forma. La iluminación de estudio se genera con `Lightformer` de drei, sin descargar mapas de entorno externos.

### 7.6.2 Escenas, rendimiento y movimiento reducido

Cada pantalla con 3D monta un único `<Canvas>` (`frontend/src/three/scenes/CarViewerCanvas.tsx`):

```tsx
const animate = mode === 'showcase' && !reduced && inView
// …
<Canvas
  frameloop={animate ? 'always' : 'demand'}
  dpr={[1, 2]}
  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
  // …
>
```

- `frameloop="demand"`: con la escena quieta no se dibuja ningún fotograma; solo cuando algo cambia (`invalidate()`).
- Solo se anima en modo exhibición, si el usuario no ha pedido movimiento reducido (`prefers-reduced-motion`) y si el lienzo está a la vista y la pestaña visible (`useInView()` en `three/env.ts`).
- La densidad de píxeles se limita a 2.
- Las escenas liberan al desmontarse los recursos que crean ellas mismas (luces, texturas y geometrías de la portada). La fuga de memoria que midió `experto-3d` el 23/10 (unos 1,5 MB de JavaScript por cada ida y vuelta entre pantallas con 3D, porque las geometrías memorizadas retienen los renderizadores antiguos) no consta corregida: `disposeCarBuilds()` existe en `car/build.ts`, pero no se llama desde ninguna escena. [PENDIENTE: tarea 20]

### 7.6.3 Alternativa 2D y accesibilidad

Cada envoltorio público de `frontend/src/three/index.tsx` decide qué mostrar:

```tsx
export function CarViewer(props: CarViewerProps) {
  const webgl = useWebGLAvailable()
  const inspect = props.mode === 'inspect'
  const fallback = inspect ? <ZoneMap2D {...props} /> : <SilhouetteBox /* … */ />
  if (!webgl) return fallback
  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={/* silueta mientras carga */}>
        <CarViewerCanvas {...props} />
      </Suspense>
    </ThreeBoundary>
  )
}
```

`useWebGLAvailable()` intenta crear un contexto WebGL una vez y guarda el resultado; con `?sin3d` en la URL se fuerza el respaldo, lo que sirve para probarlo. En la ficha del vehículo, el mapa de zonas (`frontend/src/components/vehicles/ZoneMap.tsx`) tiene siempre al lado la **lista de zonas en HTML**, con el estado en texto e icono (nunca solo con color), y un selector "3D / Lista". El lienzo tiene un nombre accesible que remite a esa lista ("Usa la lista de zonas para la información detallada") y la cabecera de la sección dice "según tus intervalos, no medido" (R9 del informe de UX). La vista de rayos X lleva la etiqueta "Ilustrativo".

### 7.6.4 Carga diferida: lo que funciona y lo que falta

El módulo está dividido en una parte ligera y una pesada (§6.8), y una prueba lo vigila (`frontend/src/three/light-imports.test.ts`): recorre el grafo de importaciones estáticas desde `three/index.tsx` y falla si alguna llega a `three` o `@react-three/*`. Desde el 25/10, las miniaturas de los listados son siluetas SVG y no descargan three.js (commit `d8a31bb`).

Sin embargo, **en el *build* de producción three.js todavía no llega de forma diferida.** El agente `experto-3d` lo detectó el 23/10 ([informe de rendimiento 3D](../../equipo/informes/2026-10-23-experto-3d-rendimiento.md), §2.2): la configuración `manualChunks` de `frontend/vite.config.ts` mete en el *chunk* `three` dependencias que también usa la entrada (como `scheduler`), y el `index.html` generado precarga ese *chunk* en todas las pantallas. El *build* del 25/10 que hay en `frontend/dist/` lo confirma: su `index.html` contiene `<link rel="modulepreload" … href="/assets/three-CSwm0sEG.js">`, un fichero de 1.005.297 bytes, y lo mismo con el *chunk* de gráficos (404.588 bytes). La prueba de importaciones ligeras no lo detecta porque comprueba el código fuente, no el resultado del empaquetado.

> [PENDIENTE: tarea 20 — corregir la división en *chunks* para que three.js y Recharts solo se descarguen en las pantallas que los usan, y medir el antes y el después. El informe de `experto-3d` tiene la medición inicial (por ejemplo, 10,4 s hasta el primer dibujo de la ficha con WebGL por software) pero aún no la final.]

## 7.7 Datos de demostración

`backend/database/seeders/DemoSeeder.php` crea cuatro cuentas con la contraseña `password`: `demo@carcare.test` (particular con 2 vehículos y unos 18 meses de historial), `taller@carcare.test` (propietario de "Taller Demo", con 4 elevadores, 12 clientes, 20 vehículos y unas 36 órdenes), `gerente@carcare.test` y `mecanico@carcare.test`. Todo es ficticio: teléfonos de la serie 600 000 0xx, correos `@ejemplo.test`, NIF y matrículas inventados. Sus características más útiles para la demostración:

- **Aditivo e idempotente.** Se puede ejecutar sobre una base con datos: identifica lo suyo por claves estables (email, nombre del cliente, matrícula), crea lo que falta y no modifica lo que existe. Ejecutarlo dos veces el mismo día no cambia nada la segunda.
- **Al día.** Rellena lecturas, repostajes y gastos desde la última lectura hasta hoy, y en el taller hace avanzar las órdenes un paso y añade las del día, usando los mismos servicios que la API (`MileageService`, `MaintenanceService`, `WorkOrderService`). Así los datos demo cumplen las mismas reglas que los reales.
- **Seguro.** Aborta en producción, y con `DEMO_DRY_RUN=1` enseña lo que haría y lo deshace.

## 7.8 Trabajo en construcción a 26/10/2026

| Tarea | Qué es | Estado verificable |
|-------|--------|-------------------|
| 27 | Cada lectura de km enlaza con su origen (RF-24) | Contrato aprobado el 24/10 (§3.4.1). `source_id` ya sale en el JSON desde el 25/10. El ocultarlo al mecánico en las lecturas de gastos, la limpieza de lecturas huérfanas (migración `2026_10_26_000001`) y `MileageSourceTest` estaban en el árbol de trabajo sin confirmar. [PENDIENTE: tarea 27 — backend y pantalla `JournalTab`] |
| 28 | Recuperar la contraseña (RF-10, ADR‑0006) | Diseño en el §6.6.5. Controlador, servicio, notificación y pruebas en el árbol de trabajo sin confirmar. [PENDIENTE: tarea 28 — backend con pruebas y dos pantallas] |
| 29 | Exportar y anonimizar al cliente del taller (RF-72, RF-73, ADR‑0005) | Contrato aprobado; `anonymized_at` ya en el JSON (siempre `null`). Sin migración ni rutas. [PENDIENTE: tarea 29] |
| 24 | Resumen imprimible de la orden, "no es una factura" (RF-71) | `frontend/src/features/workshop/OrderSummaryPage.tsx` existe desde el 25/10 (commit `d8a31bb`) con el texto "No es una factura", pero la tarea sigue pendiente en la cola y no hay informe que lo verifique. [PENDIENTE: tarea 24 — revisión y prueba] |
| 16 | Simplificación de la interfaz | Plan aprobado (R1‑R14). Aplicado en parte (miniaturas SVG, contraste de bordes, tabla accesible de gráficos). [PENDIENTE: tarea 16, paso 2] |
| 32‑35 | Solicitudes de reparación de un particular a un taller (E16, RF-74) | En diseño por el arquitecto. [PENDIENTE: tarea 32 — ADR‑0007, contrato e historias] |
