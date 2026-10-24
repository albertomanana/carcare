<?php

namespace Database\Seeders;

use App\Enums\MileageSource;
use App\Enums\ReminderStatus;
use App\Enums\WorkOrderStatus;
use App\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\Customer;
use App\Models\Document;
use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\MileageLog;
use App\Models\Reminder;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Services\AccountService;
use App\Services\MaintenanceService;
use App\Services\MileageService;
use App\Services\WorkOrderService;
use App\Services\WorkspaceService;
use App\Support\Km;
use App\Support\LineItems;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Datos de demostración (contrato §5). Todo es FICTICIO: personas, empresas, teléfonos
 * (600 000 0xx), emails (@ejemplo.test), NIF y matrículas están inventados.
 *
 *  - demo@carcare.test      → particular (Lucía) con 2 vehículos y ~18 meses de historial.
 *  - taller@carcare.test    → "Taller Demo" (Marcos, owner) con 4 elevadores, 12 clientes, 20 vehículos y ~36 órdenes.
 *  - gerente@carcare.test   → manager del taller (Elena).
 *  - mecanico@carcare.test  → mechanic del taller (Andrés).
 * Contraseña de todas: "password".
 *
 * ADITIVO E IDEMPOTENTE (se puede ejecutar sobre una base con datos reales):
 *  - Nunca borra nada que no sea un resto de pruebas (ver TEST_RESIDUE_PATTERNS) dentro de un espacio demo.
 *  - Identifica lo suyo por claves estables: email de la cuenta, propietario del taller, nombre del cliente
 *    dentro del taller y matrícula dentro del espacio. Lo que falta se crea con su historial; lo que ya
 *    existe no se modifica.
 *  - Pone al día lo que ya existía: lecturas de km, repostajes y gastos menores desde la última lectura
 *    hasta hoy (continuando desde el km más alto, así que respeta las lecturas que haya metido una persona)
 *    y, en el taller, el movimiento del día (las órdenes avanzan un paso y entran las de hoy) con las mismas
 *    reglas de la API. Ejecutarlo dos veces el mismo día no cambia nada la segunda vez.
 *  - Simulación: DEMO_DRY_RUN=1 lista los cambios y lo deshace todo (no escribe ficheros).
 *  - Los ficheros de documentos se escriben después de confirmar la transacción; nunca se borran carpetas.
 * Aborta en producción.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'password';

    public const EMAILS = ['demo@carcare.test', 'taller@carcare.test', 'gerente@carcare.test', 'mecanico@carcare.test'];

    /** Textos que delatan restos de pruebas manuales o automáticas dentro de los espacios demo. */
    public const TEST_RESIDUE_PATTERNS = ['Prueba QA', 'QA frontend'];

    private const TABLES = [
        'users', 'workspaces', 'customers', 'vehicles', 'mileage_logs', 'maintenance_records',
        'expenses', 'reminders', 'documents', 'work_orders', 'activities',
    ];

    private CarbonImmutable $today;

    private bool $dryRun = false;

    /** @var array<string, array<string, int>> km al final de cada día, por clave de vehículo */
    private array $odometers = [];

    /** @var list<array<string, mixed>> actividad pendiente de insertar (se ordena al final) */
    private array $activities = [];

    /** @var array<string, string> ficheros pendientes de escribir tras confirmar (ruta → contenido) */
    private array $files = [];

    /** @var list<string> qué ha hecho (o haría) esta ejecución */
    private array $notes = [];

    public function __construct(
        private readonly AccountService $accounts,
        private readonly MileageService $mileage,
        private readonly MaintenanceService $maintenance,
        private readonly WorkOrderService $workOrders,
        private readonly WorkspaceService $workspaces,
    ) {}

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder no se ejecuta en producción: los datos de demostración son ficticios.');
        }

        mt_srand(20261022);
        $this->today = CarbonImmutable::today();
        $this->dryRun = (bool) config('app.demo_dry_run', false);

        $before = $this->counts();
        DB::beginTransaction();
        try {
            Model::unguarded(function () {
                $this->removeTestResidue();
                $this->seedPersonal();
                $this->seedWorkshop();
                $this->flushActivities();
            });
            $after = $this->counts();
            $this->dryRun ? DB::rollBack() : DB::commit();
        } catch (Throwable $e) {
            DB::rollBack();
            throw $e;
        } finally {
            Auth::guard()->forgetUser();
        }

        if (! $this->dryRun) {
            foreach ($this->files as $path => $content) {
                Storage::disk('local')->put($path, $content);
            }
        }

        $this->report($before, $after);
    }

    // ═══════════════════════════════ Utilidades ═══════════════════════════════

    /** @return array<string, int> */
    private function counts(): array
    {
        return collect(self::TABLES)->mapWithKeys(fn (string $t) => [$t => DB::table($t)->count()])->all();
    }

    private function report(array $before, array $after): void
    {
        if (! $this->command) {
            return;
        }

        $this->command->info($this->dryRun
            ? 'SIMULACIÓN (DEMO_DRY_RUN=1): esto es lo que haría. No se ha guardado nada.'
            : 'Demo al día: demo@carcare.test y taller@carcare.test (también gerente@ y mecanico@), contraseña "password".');
        foreach ($this->notes as $note) {
            $this->command->line('  · '.$note);
        }
        $this->command->table(
            ['Tabla', 'Antes', 'Después', 'Cambio'],
            collect(self::TABLES)->map(fn (string $t) => [$t, $before[$t], $after[$t], sprintf('%+d', $after[$t] - $before[$t])])->all(),
        );
    }

    private function note(string $text): void
    {
        $this->notes[] = $text;
    }

    /** Cuenta demo: si existe se usa tal cual (no se toca su contraseña ni sus datos); si no, se crea. */
    private function ensureUser(string $name, string $email, string $type, ?string $workshopName, int $daysAgo): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user) {
            return $user;
        }

        $user = $this->accounts->register([
            'name' => $name,
            'email' => $email,
            'password' => self::PASSWORD,
            'account_type' => $type,
            'workshop_name' => $workshopName,
        ]);
        $created = $this->today->subDays($daysAgo)->setTime(10, 0);
        $user->forceFill(['created_at' => $created, 'updated_at' => $created, 'email_verified_at' => $created])->save();
        $user->workspaces()->each(fn (Workspace $w) => $w->forceFill(['created_at' => $created, 'updated_at' => $created])->save());
        DB::table('workspace_user')->where('user_id', $user->id)->update(['created_at' => $created, 'updated_at' => $created]);
        $this->note("Cuenta creada: {$email}");

        return $user;
    }

    /** Ejecuta $callback con $user como autor (la actividad que registran los servicios lleva su nombre). */
    private function actingAs(User $user, callable $callback): mixed
    {
        Auth::guard()->setUser($user);
        try {
            return $callback();
        } finally {
            Auth::guard()->forgetUser();
        }
    }

    private function rand(float $min, float $max, int $decimals = 2): string
    {
        $factor = 10 ** $decimals;

        return number_format(mt_rand((int) round($min * $factor), (int) round($max * $factor)) / $factor, $decimals, '.', '');
    }

    /** Odómetro diario simulado: entre semana trayectos cortos; algunos fines de semana, viaje. */
    private function simulateOdometer(string $key, CarbonImmutable $start, int $startKm, array $weekday, int $tripChance): void
    {
        $km = $startKm;
        $days = [];
        for ($d = $start; $d <= $this->today; $d = $d->addDay()) {
            if ($d > $start) {
                $km += $d->isWeekend()
                    ? (mt_rand(1, 100) <= $tripChance ? mt_rand(110, 330) : mt_rand(0, 25))
                    : mt_rand($weekday[0], $weekday[1]);
            }
            $days[$d->toDateString()] = $km;
        }
        $this->odometers[$key] = $days;
    }

    private function odo(string $key, CarbonImmutable $date): int
    {
        return $this->odometers[$key][$date->toDateString()];
    }

    /** Último día cuyo odómetro no supera $km. */
    private function dayAtKm(string $key, int $km): CarbonImmutable
    {
        $found = array_key_first($this->odometers[$key]);
        foreach ($this->odometers[$key] as $date => $value) {
            if ($value > $km) {
                break;
            }
            $found = $date;
        }

        return CarbonImmutable::parse($found);
    }

    private function log(Vehicle $vehicle, CarbonImmutable $date, int $km, MileageSource $source, ?int $sourceId = null, ?string $note = null): MileageLog
    {
        $at = $date->setTime(20, mt_rand(0, 59));

        return MileageLog::create([
            'vehicle_id' => $vehicle->id,
            'recorded_at' => $date->toDateString(),
            'mileage' => $km,
            'source' => $source,
            'source_id' => $sourceId,
            'note' => $note,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }

    private function activity(Workspace $ws, ?User $user, ?Vehicle $vehicle, string $action, string $entityType, int $entityId, string $summary, CarbonImmutable $at, array $meta = []): void
    {
        $this->activities[] = [
            'workspace_id' => $ws->id,
            'user_id' => $user?->id,
            'vehicle_id' => $vehicle?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'summary' => mb_substr($summary, 0, 255),
            'metadata' => $meta === [] ? null : json_encode($meta),
            'created_at' => $at,
        ];
    }

    private function flushActivities(): void
    {
        usort($this->activities, fn ($a, $b) => $a['created_at'] <=> $b['created_at']);
        foreach (array_chunk($this->activities, 200) as $chunk) {
            Activity::insert(array_map(fn ($row) => ['created_at' => $row['created_at']->toDateTimeString()] + $row, $chunk));
        }
    }

    // ═══════════════════════════════ Restos de pruebas ═══════════════════════════════

    /**
     * Espacios demo: el personal de cada cuenta demo y los talleres de los que taller@ es propietario.
     *
     * @return list<int>
     */
    private function demoWorkspaceIds(): array
    {
        $users = User::query()->whereIn('email', self::EMAILS)->pluck('id', 'email');
        if ($users->isEmpty()) {
            return [];
        }

        return DB::table('workspace_user')
            ->join('workspaces', 'workspaces.id', '=', 'workspace_user.workspace_id')
            ->where(function ($q) use ($users) {
                $q->where(fn ($p) => $p->whereIn('workspace_user.user_id', $users->values())->where('workspaces.type', 'personal'))
                    ->orWhere(fn ($w) => $w->where('workspace_user.user_id', $users['taller@carcare.test'] ?? 0)
                        ->where('workspaces.type', 'workshop')->where('workspace_user.role', WorkspaceRole::Owner->value));
            })
            ->distinct()
            ->pluck('workspaces.id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** where (col1 LIKE '%patrón%' OR col2 LIKE …) para todos los patrones de restos de pruebas. */
    private function matchesResidue($query, array $columns)
    {
        return $query->where(function ($q) use ($columns) {
            foreach ($columns as $column) {
                foreach (self::TEST_RESIDUE_PATTERNS as $pattern) {
                    $q->orWhere($column, 'like', '%'.$pattern.'%');
                }
            }
        });
    }

    /**
     * Borra SOLO lo que contiene "Prueba QA" o "QA frontend" dentro de los espacios demo, con lo que
     * cuelga de ello (líneas, gasto vinculado, lectura de km, actividad que lo nombra o lo referencia).
     */
    private function removeTestResidue(): void
    {
        $workspaceIds = $this->demoWorkspaceIds();
        if ($workspaceIds === []) {
            return;
        }
        $vehicleIds = Vehicle::query()->whereIn('workspace_id', $workspaceIds)->pluck('id');
        $deleted = []; // [entity_type, id]
        $touchedVehicles = [];

        $records = $this->matchesResidue(MaintenanceRecord::query()->whereIn('vehicle_id', $vehicleIds), ['title', 'description'])->with('vehicle')->get();
        foreach ($records as $record) {
            $items = $record->items()->count();
            $this->note("Resto de pruebas borrado: intervención #{$record->id} «{$record->title}» de {$record->vehicle->displayName()} (con {$items} línea(s))");
            MileageLog::query()->where('source', MileageSource::Maintenance->value)->where('source_id', $record->id)->delete();
            $record->delete(); // líneas y gasto vinculado en cascada; documentos quedan sin vincular
            $deleted[] = ['maintenance_record', $record->id];
            $touchedVehicles[$record->vehicle_id] = true;
        }

        $expenses = $this->matchesResidue(Expense::query()->whereIn('vehicle_id', $vehicleIds), ['description'])->get();
        foreach ($expenses as $expense) {
            $this->note("Resto de pruebas borrado: gasto #{$expense->id} «{$expense->description}» ({$expense->amount} €)");
            MileageLog::query()->where('source', MileageSource::Expense->value)->where('source_id', $expense->id)->delete();
            $expense->delete();
            $deleted[] = ['expense', $expense->id];
            $touchedVehicles[$expense->vehicle_id] = true;
        }

        $reminders = $this->matchesResidue(Reminder::query()->whereIn('vehicle_id', $vehicleIds), ['title', 'notes'])->get();
        foreach ($reminders as $reminder) {
            $this->note("Resto de pruebas borrado: recordatorio #{$reminder->id} «{$reminder->title}»");
            MileageLog::query()->where('source', MileageSource::Reminder->value)->where('source_id', $reminder->id)->delete();
            $reminder->delete();
            $deleted[] = ['reminder', $reminder->id];
            $touchedVehicles[$reminder->vehicle_id] = true;
        }

        $documents = $this->matchesResidue(Document::query()->whereIn('vehicle_id', $vehicleIds), ['title'])->get();
        foreach ($documents as $document) {
            $this->note("Resto de pruebas borrado: documento #{$document->id} «{$document->title}»");
            if (! $this->dryRun) {
                DB::afterCommit(fn () => Storage::disk($document->disk)->delete($document->path));
            }
            $document->delete();
            $deleted[] = ['document', $document->id];
        }

        $logs = $this->matchesResidue(MileageLog::query()->whereIn('vehicle_id', $vehicleIds)->where('source', MileageSource::Manual->value), ['note'])->get();
        foreach ($logs as $log) {
            $this->note("Resto de pruebas borrado: lectura #{$log->id} de ".Km::human($log->mileage)." «{$log->note}»");
            $log->delete();
            $deleted[] = ['mileage_log', $log->id];
            $touchedVehicles[$log->vehicle_id] = true;
        }

        $orders = $this->matchesResidue(WorkOrder::query()->whereIn('workspace_id', $workspaceIds), ['title', 'complaint'])->get();
        foreach ($orders as $order) {
            $this->note("Resto de pruebas borrado: orden {$order->number} «{$order->title}»");
            MileageLog::query()->where('source', MileageSource::WorkOrder->value)->where('source_id', $order->id)->delete();
            $order->delete();
            $deleted[] = ['work_order', $order->id];
            $touchedVehicles[$order->vehicle_id] = true;
        }

        $activities = Activity::query()->whereIn('workspace_id', $workspaceIds)->where(function ($q) use ($deleted) {
            $this->matchesResidue($q, ['summary']);
            foreach ($deleted as [$type, $id]) {
                $q->orWhere(fn ($e) => $e->where('entity_type', $type)->where('entity_id', $id));
            }
        })->orderBy('id')->get();
        foreach ($activities as $activity) {
            $this->note("Resto de pruebas borrado: actividad #{$activity->id} «{$activity->summary}»");
            $activity->delete();
        }

        foreach (array_keys($touchedVehicles) as $vehicleId) {
            if ($vehicle = Vehicle::find($vehicleId)) {
                $this->mileage->recalculate($vehicle);
            }
        }
    }

    // ═══════════════════════════════ Particular ═══════════════════════════════

    private function personalSpecs(): array
    {
        return [
            'ibiza' => [
                'attributes' => [
                    'nickname' => 'El rojo', 'make' => 'Seat', 'model' => 'Ibiza', 'version' => '1.0 TSI FR', 'year' => 2019,
                    'fuel_type' => 'gasoline', 'transmission' => 'manual', 'engine' => '1.0 TSI 110 CV', 'body_type' => 'hatchback',
                    'color_hex' => '#C62828', 'plate' => '4821KTB', 'vin' => 'VSSZZZKJZKR000001',
                    'purchase_date' => '2019-06-14', 'purchase_mileage' => 12,
                ],
                'created_at' => [18, 30], 'start_km' => 52340, 'weekday' => [18, 52], 'trip' => 38,
                'fuel' => ['consumption' => 6.1, 'price' => [1.52, 1.71], 'every' => [470, 610], 'station' => ['Repsol', 'Cepsa', 'BP', 'Galp', 'Gasolinera Ejemplo']],
                'insurance' => '389.40', 'insurance_due_in' => 18, 'tax' => '68.16',
            ],
            'sportage' => [
                'attributes' => [
                    'nickname' => null, 'make' => 'Kia', 'model' => 'Sportage', 'version' => '1.6 CRDi Drive', 'year' => 2021,
                    'fuel_type' => 'diesel', 'transmission' => 'automatic', 'engine' => '1.6 CRDi 136 CV', 'body_type' => 'suv',
                    'color_hex' => '#6B7280', 'plate' => '7310LFW', 'vin' => null,
                    'purchase_date' => '2021-03-02', 'purchase_mileage' => 0,
                ],
                'created_at' => [19, 5], 'start_km' => 30215, 'weekday' => [20, 46], 'trip' => 28,
                'fuel' => ['consumption' => 6.6, 'price' => [1.43, 1.61], 'every' => [560, 760], 'station' => ['Repsol', 'Shell', 'Gasolinera Ejemplo', 'Ballenoil']],
                'insurance' => '512.75', 'insurance_due_in' => 140, 'tax' => '115.20',
            ],
        ];
    }

    private function seedPersonal(): void
    {
        $user = $this->ensureUser('Lucía Demo', 'demo@carcare.test', 'personal', null, 560);
        $ws = $user->personalWorkspace();

        foreach ($this->personalSpecs() as $key => $spec) {
            $vehicle = Vehicle::query()->where('workspace_id', $ws->id)->where('plate', $spec['attributes']['plate'])->first();
            if ($vehicle === null) {
                $vehicle = $this->createPersonalVehicle($ws, $user, $key, $spec);
                $this->note("Vehículo creado con ~18 meses de historial: {$vehicle->displayName()} ({$vehicle->plate})");
            } else {
                $this->topUpPersonalVehicle($ws, $user, $key, $vehicle, $spec);
            }
            $this->repairDocumentFiles($vehicle);
        }
    }

    private function createPersonalVehicle(Workspace $ws, User $user, string $key, array $spec): Vehicle
    {
        $start = $this->today->subMonths(18);
        $at = $start->setTime(...$spec['created_at']);
        $vehicle = Vehicle::create($spec['attributes'] + ['workspace_id' => $ws->id, 'created_at' => $at, 'updated_at' => $at]);

        $this->simulateOdometer($key, $start, $spec['start_km'], $spec['weekday'], $spec['trip']);
        $this->log($vehicle, $start, $this->odo($key, $start), MileageSource::VehicleCreated, $vehicle->id);
        $this->activity($ws, $user, $vehicle, 'vehicle.created', 'vehicle', $vehicle->id, "Lucía Demo añadió el vehículo {$vehicle->displayName()}", $at->addMinute());
        $this->weeklyReadings($ws, $user, $key, $vehicle, $start);
        $this->fuel($ws, $user, $key, $vehicle, $start, $spec['fuel'], $this->odo($key, $start), 0.0);

        $records = $this->personalRecords($ws, $user, $key, $vehicle, $key === 'ibiza' ? $this->ibizaRecords() : $this->sportageRecords());
        $this->annualExpenses($ws, $user, $vehicle, $start, $spec);
        $this->randomExpenses($ws, $user, $vehicle, $start->addDays(3), $this->today);

        $key === 'ibiza' ? $this->ibizaReminders($ws, $user, $vehicle, $records) : $this->sportageReminders($ws, $user, $vehicle, $records);
        $this->personalDocuments($ws, $user, $key, $vehicle, $records);

        $this->mileage->recalculate($vehicle);

        return $vehicle;
    }

    /**
     * Vehículo demo que ya existía: completa el día a día desde su última lectura hasta hoy. Sigue desde el
     * km más alto registrado (sea de la demo o de una persona), así que nunca crea un retroceso.
     */
    private function topUpPersonalVehicle(Workspace $ws, User $user, string $key, Vehicle $vehicle, array $spec): void
    {
        $vehicle->refresh();
        $from = $vehicle->mileage_updated_at;
        $km = $vehicle->current_mileage;
        if ($from === null || $km === null || $from >= $this->today) {
            $this->note("{$vehicle->displayName()}: ya estaba al día (última lectura ".($from?->format('d/m/Y') ?? 'ninguna').')');

            return;
        }

        $logsBefore = $vehicle->mileageLogs()->count();
        $expensesBefore = $vehicle->expenses()->count();

        $this->simulateOdometer($key, $from, $km, $spec['weekday'], $spec['trip']);
        $this->weeklyReadings($ws, $user, $key, $vehicle, $from);

        // Repostajes: el depósito sigue desde el último lleno con km anotado.
        $lastFill = $vehicle->expenses()->where('category', 'fuel')->where('full_tank', true)->whereNotNull('mileage')
            ->orderByDesc('expense_date')->orderByDesc('id')->first();
        $fillKm = ($lastFill && $lastFill->mileage <= $km) ? $lastFill->mileage : $km;
        $this->fuel($ws, $user, $key, $vehicle, $from, $spec['fuel'], $fillKm, ($km - $fillKm) * $spec['fuel']['consumption'] / 100);

        // Gastos menores: siguen el ritmo de cada 6-16 días desde el último.
        $lastMisc = $vehicle->expenses()->whereIn('category', ['parking', 'cleaning', 'tolls', 'other'])->max('expense_date');
        $next = $lastMisc ? CarbonImmutable::parse(substr((string) $lastMisc, 0, 10))->addDays(mt_rand(6, 16)) : $from->addDay();
        $this->randomExpenses($ws, $user, $vehicle, $next->max($from->addDay()), $this->today);

        // Impuesto de circulación de abril si cae en el tramo y no está ya.
        for ($year = $from->year; $year <= $this->today->year; $year++) {
            $date = CarbonImmutable::create($year, 4, 20);
            if ($date > $from && $date <= $this->today && ! $vehicle->expenses()->where('category', 'tax')->whereYear('expense_date', $year)->exists()) {
                $this->expense($ws, $user, $vehicle, $date, 'tax', 'Impuesto de circulación '.$year, $spec['tax']);
            }
        }

        $this->mileage->recalculate($vehicle);
        $vehicle->refresh();
        $this->note(sprintf('%s: puesto al día del %s al %s (+%d lecturas, +%d gastos; km actual %s)',
            $vehicle->displayName(), $from->format('d/m/Y'), $this->today->format('d/m/Y'),
            $vehicle->mileageLogs()->count() - $logsBefore, $vehicle->expenses()->count() - $expensesBefore, Km::human($vehicle->current_mileage)));
    }

    /** Lectura manual cada domingo posterior a $start y otra hoy. */
    private function weeklyReadings(Workspace $ws, User $user, string $key, Vehicle $vehicle, CarbonImmutable $start): void
    {
        $notes = ['Antes del viaje', 'Vuelta de vacaciones', null, null, null, null, null, null];
        for ($d = $start->next(CarbonImmutable::SUNDAY); $d < $this->today; $d = $d->addWeek()) {
            $km = $this->odo($key, $d);
            $log = $this->log($vehicle, $d, $km, MileageSource::Manual, note: $notes[mt_rand(0, count($notes) - 1)]);
            if ($d >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'mileage.recorded', 'mileage_log', $log->id,
                    'Lucía Demo registró '.Km::human($km).' en '.$vehicle->displayName(), $d->setTime(21, 10), ['mileage' => $km]);
            }
        }
        $km = $this->odo($key, $this->today);
        $log = $this->log($vehicle, $this->today, $km, MileageSource::Manual, note: 'Lectura de hoy');
        $this->activity($ws, $user, $vehicle, 'mileage.recorded', 'mileage_log', $log->id,
            'Lucía Demo registró '.Km::human($km).' en '.$vehicle->displayName(), $this->today->setTime(8, 5), ['mileage' => $km]);
    }

    /**
     * Repostajes con depósito lleno (y alguno parcial) para que el consumo lleno-a-lleno sea calculable.
     * $fillKm y $consumed describen el depósito al empezar: km del último repostaje y litros gastados desde él.
     */
    private function fuel(Workspace $ws, User $user, string $key, Vehicle $vehicle, CarbonImmutable $start, array $fuel, int $fillKm, float $consumed): void
    {
        $lastFillKm = $fillKm;
        $partials = 0.0;
        $threshold = mt_rand($fuel['every'][0], $fuel['every'][1]);
        $previousKm = $this->odo($key, $start);
        $station = $fuel['station'];

        for ($d = $start->addDay(); $d <= $this->today->subDay(); $d = $d->addDay()) {
            $km = $this->odo($key, $d);
            $consumed += ($km - $previousKm) * $fuel['consumption'] * (mt_rand(92, 109) / 100) / 100;
            $previousKm = $km;

            if ($km - $lastFillKm < $threshold) {
                continue;
            }

            $full = mt_rand(1, 7) !== 1;
            $liters = $full ? max(8.0, $consumed - $partials) : (float) mt_rand(15, 22);
            $liters = round($liters, 2);
            $unitPrice = (float) $this->rand($fuel['price'][0], $fuel['price'][1], 3);
            $amount = Money::format((int) round($liters * $unitPrice * 100));

            $expense = Expense::create([
                'vehicle_id' => $vehicle->id, 'category' => 'fuel',
                'description' => $station[mt_rand(0, count($station) - 1)].' · '.number_format($unitPrice, 3, ',', '').' €/l',
                'amount' => $amount, 'currency' => 'EUR', 'expense_date' => $d->toDateString(), 'mileage' => $km,
                'fuel_quantity' => number_format($liters, 2, '.', ''), 'fuel_unit' => 'l', 'full_tank' => $full,
                'created_at' => $d->setTime(19, 40), 'updated_at' => $d->setTime(19, 40),
            ]);
            $this->log($vehicle, $d, $km, MileageSource::Expense, $expense->id);

            if ($d >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'expense.created', 'expense', $expense->id,
                    'Lucía Demo añadió un gasto de '.Money::human($amount).' (Combustible) en '.$vehicle->displayName(),
                    $d->setTime(19, 41), ['category' => 'fuel', 'amount' => $amount]);
            }

            if ($full) {
                $consumed = 0.0;
                $partials = 0.0;
                $lastFillKm = $km;
                $threshold = mt_rand($fuel['every'][0], $fuel['every'][1]);
            } else {
                $partials += $liters;
                $lastFillKm = $km;
                $threshold = mt_rand(150, 300);
            }
        }
    }

    /**
     * Intervenciones de un vehículo personal. Cada una con km del odómetro, líneas y gasto vinculado (D3-A).
     *
     * @return array<string, MaintenanceRecord>
     */
    private function personalRecords(Workspace $ws, User $user, string $key, Vehicle $vehicle, array $specs): array
    {
        $records = [];
        foreach ($specs as $ref => $spec) {
            $date = $spec['date'];
            $km = $this->odo($key, $date);
            $rows = LineItems::rows($spec['items']);
            $total = LineItems::sumCents($rows);

            $record = MaintenanceRecord::create([
                'vehicle_id' => $vehicle->id, 'type' => $spec['type'], 'zone' => $spec['zone'],
                'service_kind' => $spec['kind'] ?? null, 'title' => $spec['title'], 'description' => $spec['description'] ?? null,
                'service_date' => $date->toDateString(), 'mileage' => $km, 'workshop_name' => $spec['workshop'] ?? null,
                'parts_cost' => Money::format(LineItems::sumCents(array_filter($rows, fn ($r) => $r['kind'] !== 'labor')) ?? 0),
                'labor_cost' => Money::format(LineItems::sumCents(array_filter($rows, fn ($r) => $r['kind'] === 'labor')) ?? 0),
                'total_cost' => $total === null ? null : Money::format($total), 'currency' => 'EUR',
                'archived_at' => ($spec['archived'] ?? false) ? $date->addDays(2)->setTime(10, 0) : null,
                'created_at' => $date->setTime(17, 15), 'updated_at' => $date->setTime(17, 15),
            ]);
            $record->items()->createMany($rows);
            $record->setRelation('vehicle', $vehicle);
            $this->maintenance->syncLinkedExpense($record);
            Expense::query()->where('maintenance_record_id', $record->id)->update(['created_at' => $date->setTime(17, 15), 'updated_at' => $date->setTime(17, 15)]);

            if (! ($spec['archived'] ?? false)) {
                $this->log($vehicle, $date, $km, MileageSource::Maintenance, $record->id);
            }
            if ($date >= $this->today->subDays(60)) {
                $this->activity($ws, $user, $vehicle, 'maintenance.created', 'maintenance_record', $record->id,
                    "Lucía Demo registró la intervención «{$record->title}» en ".$vehicle->displayName(), $date->setTime(17, 16),
                    ['type' => $spec['type'], 'zone' => $spec['zone']]);
            }
            $records[$ref] = $record;
        }

        return $records;
    }

    private function ibizaRecords(): array
    {
        // El cambio de aceite queda ~15.400 km atrás: su recordatorio (cada 15.000 km) sale VENCIDO por km.
        $oilDate = $this->dayAtKm('ibiza', $this->odo('ibiza', $this->today) - 15420);

        return [
            'service' => [
                'date' => $this->today->subDays(468), 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'service',
                'title' => 'Revisión de los 60.000 km', 'workshop' => 'AutoServicio Ejemplo',
                'description' => 'Revisión según plan del fabricante. Sin incidencias.',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 5W-30 (litros)', 'part_number' => null, 'quantity' => '4.20', 'unit_price' => '9.80'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-1042', 'quantity' => '1', 'unit_price' => '12.50'],
                    ['kind' => 'part', 'name' => 'Filtro de aire', 'part_number' => 'FA-2210', 'quantity' => '1', 'unit_price' => '18.90'],
                    ['kind' => 'part', 'name' => 'Filtro de habitáculo', 'part_number' => 'FH-0871', 'quantity' => '1', 'unit_price' => '16.40'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.50', 'unit_price' => '45.00'],
                ],
            ],
            'oil' => [
                'date' => $oilDate, 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'oil',
                'title' => 'Cambio de aceite y filtro', 'workshop' => 'AutoServicio Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 5W-30 (litros)', 'part_number' => null, 'quantity' => '4.20', 'unit_price' => '10.20'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-1042', 'quantity' => '1', 'unit_price' => '12.90'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '45.00'],
                ],
            ],
            'itv' => [
                'date' => $this->today->subDays(305), 'type' => 'inspection', 'zone' => 'general', 'kind' => 'itv',
                'title' => 'ITV periódica (favorable)', 'workshop' => 'Estación ITV Ejemplo',
                'items' => [['kind' => 'other', 'name' => 'Tasa de inspección', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.50']],
            ],
            'brakes' => [
                'date' => $this->today->subDays(248), 'type' => 'maintenance', 'zone' => 'brakes', 'kind' => 'brakes',
                'title' => 'Pastillas de freno delanteras', 'workshop' => 'Taller Demo Norte',
                'description' => 'Pastillas al 15 %. Discos dentro de tolerancia.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Juego de pastillas delanteras', 'part_number' => 'PF-3302', 'quantity' => '1', 'unit_price' => '42.60'],
                    ['kind' => 'fluid', 'name' => 'Líquido de frenos DOT 4 (litros)', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '14.00'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.00'],
                ],
            ],
            'ac' => [
                'date' => $this->today->subDays(176), 'type' => 'maintenance', 'zone' => 'interior', 'kind' => 'ac',
                'title' => 'Recarga del aire acondicionado', 'workshop' => 'Taller Demo Norte',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Gas R1234yf (kg)', 'part_number' => null, 'quantity' => '0.45', 'unit_price' => '98.00'],
                    ['kind' => 'labor', 'name' => 'Comprobación de fugas y carga', 'part_number' => null, 'quantity' => '1', 'unit_price' => '35.00'],
                ],
            ],
            'ac_dup' => [
                'date' => $this->today->subDays(175), 'type' => 'maintenance', 'zone' => 'interior', 'kind' => 'ac',
                'title' => 'Recarga del aire acondicionado (duplicado)', 'workshop' => 'Taller Demo Norte', 'archived' => true,
                'items' => [['kind' => 'labor', 'name' => 'Comprobación de fugas y carga', 'part_number' => null, 'quantity' => '1', 'unit_price' => '35.00']],
            ],
            'body' => [
                'date' => $this->today->subDays(118), 'type' => 'bodywork', 'zone' => 'body', 'kind' => null,
                'title' => 'Arañazo en el paragolpes trasero', 'workshop' => 'Chapa y Pintura Muestra',
                'description' => 'Lijado, imprimación y pintura del paragolpes.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Pintura y barniz', 'part_number' => null, 'quantity' => '1', 'unit_price' => '64.00'],
                    ['kind' => 'labor', 'name' => 'Chapa y pintura', 'part_number' => null, 'quantity' => '3', 'unit_price' => '42.00'],
                ],
            ],
            'tyres' => [
                'date' => $this->today->subDays(64), 'type' => 'tyres', 'zone' => 'tyres', 'kind' => 'tyres',
                'title' => 'Neumáticos delanteros nuevos', 'workshop' => 'Neumáticos Muestra',
                'items' => [
                    ['kind' => 'part', 'name' => 'Neumático 215/45 R16', 'part_number' => null, 'quantity' => '2', 'unit_price' => '89.90'],
                    ['kind' => 'labor', 'name' => 'Montaje y equilibrado', 'part_number' => null, 'quantity' => '2', 'unit_price' => '12.00'],
                    ['kind' => 'other', 'name' => 'Ecotasa', 'part_number' => null, 'quantity' => '2', 'unit_price' => '1.45'],
                ],
            ],
            'battery' => [
                'date' => $this->today->subDays(19), 'type' => 'repair', 'zone' => 'electrical', 'kind' => 'battery',
                'title' => 'Cambio de batería', 'workshop' => 'AutoServicio Ejemplo',
                'description' => 'No arrancaba en frío. Batería original agotada.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Batería 60 Ah 540 A', 'part_number' => 'BT-60540', 'quantity' => '1', 'unit_price' => '109.90'],
                    ['kind' => 'labor', 'name' => 'Sustitución y registro', 'part_number' => null, 'quantity' => '0.30', 'unit_price' => '45.00'],
                ],
            ],
        ];
    }

    private function sportageRecords(): array
    {
        // Último aceite hace ~9.300 km: su recordatorio (cada 10.000 km) queda PRÓXIMO.
        $oilDate = $this->dayAtKm('sportage', $this->odo('sportage', $this->today) - 9300);

        return [
            'service' => [
                'date' => $this->today->subDays(430), 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'service',
                'title' => 'Revisión oficial 30.000 km', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 0W-30 (litros)', 'part_number' => null, 'quantity' => '5.30', 'unit_price' => '11.40'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-2620', 'quantity' => '1', 'unit_price' => '14.20'],
                    ['kind' => 'part', 'name' => 'Filtro de combustible', 'part_number' => 'FC-0411', 'quantity' => '1', 'unit_price' => '38.70'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '2', 'unit_price' => '52.00'],
                ],
            ],
            'itv' => [
                'date' => $this->today->subDays(392), 'type' => 'inspection', 'zone' => 'general', 'kind' => 'itv',
                'title' => 'Primera ITV (favorable)', 'workshop' => 'Estación ITV Ejemplo',
                'items' => [['kind' => 'other', 'name' => 'Tasa de inspección', 'part_number' => null, 'quantity' => '1', 'unit_price' => '47.20']],
            ],
            'exhaust' => [
                'date' => $this->today->subDays(272), 'type' => 'repair', 'zone' => 'exhaust', 'kind' => null,
                'title' => 'Abrazadera del escape suelta', 'workshop' => 'Taller Demo Norte',
                'items' => [
                    ['kind' => 'part', 'name' => 'Abrazadera de escape', 'part_number' => 'AE-55', 'quantity' => '2', 'unit_price' => '6.80'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.50', 'unit_price' => '45.00'],
                ],
            ],
            'oil' => [
                'date' => $oilDate, 'type' => 'maintenance', 'zone' => 'engine', 'kind' => 'oil',
                'title' => 'Cambio de aceite y filtros', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite 0W-30 (litros)', 'part_number' => null, 'quantity' => '5.30', 'unit_price' => '11.40'],
                    ['kind' => 'part', 'name' => 'Filtro de aceite', 'part_number' => 'FO-2620', 'quantity' => '1', 'unit_price' => '14.20'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '0.80', 'unit_price' => '52.00'],
                ],
            ],
            'breakdown' => [
                'date' => $this->today->subDays(150), 'type' => 'breakdown', 'zone' => 'electrical', 'kind' => null,
                'title' => 'Avería: sensor de aparcamiento trasero', 'workshop' => 'Taller Demo Norte',
                'description' => 'Pitido continuo al meter la marcha atrás. Sensor central sustituido.',
                'items' => [
                    ['kind' => 'part', 'name' => 'Sensor de aparcamiento', 'part_number' => 'SP-9031', 'quantity' => '1', 'unit_price' => '58.30'],
                    ['kind' => 'labor', 'name' => 'Diagnosis y sustitución', 'part_number' => null, 'quantity' => '1', 'unit_price' => '45.00'],
                ],
            ],
            'alignment' => [
                'date' => $this->today->subDays(96), 'type' => 'maintenance', 'zone' => 'suspension', 'kind' => null,
                'title' => 'Alineación de la dirección', 'workshop' => 'Neumáticos Muestra',
                'items' => [['kind' => 'labor', 'name' => 'Alineación 3D', 'part_number' => null, 'quantity' => '1', 'unit_price' => '39.00']],
            ],
            'gearbox' => [
                'date' => $this->today->subDays(33), 'type' => 'maintenance', 'zone' => 'transmission', 'kind' => 'other',
                'title' => 'Cambio de aceite del cambio automático', 'workshop' => 'Concesionario Ejemplo',
                'items' => [
                    ['kind' => 'fluid', 'name' => 'Aceite ATF (litros)', 'part_number' => null, 'quantity' => '6', 'unit_price' => '14.90'],
                    ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.20', 'unit_price' => '52.00'],
                ],
            ],
        ];
    }

    private function expense(Workspace $ws, User $user, Vehicle $vehicle, CarbonImmutable $date, string $category, string $description, string $amount): Expense
    {
        $expense = Expense::create([
            'vehicle_id' => $vehicle->id, 'category' => $category, 'description' => $description,
            'amount' => $amount, 'currency' => 'EUR', 'expense_date' => $date->toDateString(),
            'created_at' => $date->setTime(13, 20), 'updated_at' => $date->setTime(13, 20),
        ]);
        if ($date >= $this->today->subDays(45)) {
            $this->activity($ws, $user, $vehicle, 'expense.created', 'expense', $expense->id,
                'Lucía Demo añadió un gasto de '.Money::human($amount).' ('.$expense->category->label().') en '.$vehicle->displayName(),
                $date->setTime(13, 21), ['category' => $category, 'amount' => $amount]);
        }

        return $expense;
    }

    /** Seguro anual, impuesto de circulación de cada abril y alguna multa (solo en el historial inicial). */
    private function annualExpenses(Workspace $ws, User $user, Vehicle $vehicle, CarbonImmutable $start, array $spec): void
    {
        // Seguro anual: la última renovación fue hace (12 meses − días hasta el vencimiento).
        $renewal = $this->today->addDays($spec['insurance_due_in'])->subYear();
        foreach ([$renewal->subYear(), $renewal] as $date) {
            if ($date >= $start) {
                $this->expense($ws, $user, $vehicle, $date, 'insurance', 'Seguro anual (póliza ficticia)', $spec['insurance']);
            }
        }

        for ($year = $start->year; $year <= $this->today->year; $year++) {
            $date = CarbonImmutable::create($year, 4, 20);
            if ($date >= $start && $date <= $this->today) {
                $this->expense($ws, $user, $vehicle, $date, 'tax', 'Impuesto de circulación '.$year, $spec['tax']);
            }
        }

        if ($vehicle->make === 'Seat') {
            $this->expense($ws, $user, $vehicle, $this->today->subDays(201), 'fines', 'Multa de aparcamiento (ejemplo)', '90.00');
        }
    }

    /** Aparcamiento, lavados, peajes y pequeños gastos cada 6-16 días entre $from y $to. */
    private function randomExpenses(Workspace $ws, User $user, Vehicle $vehicle, CarbonImmutable $from, CarbonImmutable $to): void
    {
        for ($d = $from; $d <= $to; $d = $d->addDays(mt_rand(6, 16))) {
            $roll = mt_rand(1, 100);
            [$category, $description, $amount] = match (true) {
                $roll <= 45 => ['parking', mt_rand(0, 1) ? 'Parking del centro' : 'Zona azul', $this->rand(1.8, 14.5)],
                $roll <= 70 => ['cleaning', mt_rand(0, 1) ? 'Lavado exterior' : 'Lavado completo', $this->rand(6.0, 18.0)],
                $roll <= 92 => ['tolls', 'Peaje autopista', $this->rand(4.2, 21.6)],
                default => ['other', mt_rand(0, 1) ? 'Alfombrillas y ambientador' : 'Líquido limpiaparabrisas', $this->rand(4.5, 29.9)],
            };
            $this->expense($ws, $user, $vehicle, $d, $category, $description, $amount);
        }
    }

    private function reminder(Vehicle $vehicle, array $data): Reminder
    {
        return Reminder::create($data + [
            'vehicle_id' => $vehicle->id,
            'status' => ReminderStatus::Pending,
            'created_at' => CarbonImmutable::parse($data['starts_on'])->setTime(9, 0),
            'updated_at' => CarbonImmutable::parse($data['starts_on'])->setTime(9, 0),
        ]);
    }

    /** @param array<string, MaintenanceRecord> $records */
    private function ibizaReminders(Workspace $ws, User $user, Vehicle $v, array $records): void
    {
        $oil = $records['oil'];
        $itv = $records['itv'];
        $tyres = $records['tyres'];
        $brakes = $records['brakes'];
        $battery = $records['battery'];
        $insuranceStart = $this->today->addDays(18)->subYear();

        // Vencido: aceite (por km).
        $this->reminder($v, [
            'title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $oil->service_date->addYear()->toDateString(), 'due_mileage' => $oil->mileage + 15000,
            'recurrence_months' => 12, 'recurrence_km' => 15000,
            'starts_on' => $oil->service_date->toDateString(), 'start_mileage' => $oil->mileage,
        ]);
        // Hecho: el aceite anterior.
        $this->reminder($v, [
            'title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $records['service']->service_date->addYear()->toDateString(), 'due_mileage' => $records['service']->mileage + 15000,
            'recurrence_months' => 12, 'recurrence_km' => 15000,
            'starts_on' => $records['service']->service_date->toDateString(), 'start_mileage' => $records['service']->mileage,
            'status' => ReminderStatus::Done, 'completed_at' => $oil->service_date->toDateString(), 'completed_mileage' => $oil->mileage,
        ]);
        // Próximo: seguro (vence en 18 días).
        $this->reminder($v, [
            'title' => 'Renovar el seguro', 'kind' => 'insurance', 'zone' => 'general', 'notes' => 'Comparar al menos dos ofertas antes de renovar.',
            'due_date' => $this->today->addDays(18)->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $insuranceStart->toDateString(),
        ]);
        // Al día.
        $this->reminder($v, [
            'title' => 'ITV', 'kind' => 'itv', 'zone' => 'general',
            'due_date' => $itv->service_date->addMonths(24)->toDateString(), 'recurrence_months' => 24,
            'starts_on' => $itv->service_date->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Revisar neumáticos', 'kind' => 'tyres', 'zone' => 'tyres',
            'due_mileage' => $tyres->mileage + 40000, 'recurrence_km' => 40000,
            'starts_on' => $tyres->service_date->toDateString(), 'start_mileage' => $tyres->mileage,
        ]);
        $this->reminder($v, [
            'title' => 'Pastillas de freno', 'kind' => 'brakes', 'zone' => 'brakes',
            'due_date' => $brakes->service_date->addMonths(30)->toDateString(), 'due_mileage' => $brakes->mileage + 35000,
            'starts_on' => $brakes->service_date->toDateString(), 'start_mileage' => $brakes->mileage,
        ]);
        $batteryReminder = $this->reminder($v, [
            'title' => 'Revisar la batería', 'kind' => 'battery', 'zone' => 'electrical',
            'due_date' => $battery->service_date->addYears(4)->toDateString(),
            'starts_on' => $battery->service_date->toDateString(),
        ]);
        $nextTax = CarbonImmutable::create($this->today->month > 4 ? $this->today->year + 1 : $this->today->year, 4, 30);
        $this->reminder($v, [
            'title' => 'Impuesto de circulación', 'kind' => 'tax', 'zone' => 'general',
            'due_date' => $nextTax->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $nextTax->subYear()->toDateString(),
        ]);
        // Descartado.
        $this->reminder($v, [
            'title' => 'Cambiar escobillas', 'kind' => 'custom', 'zone' => 'body',
            'due_date' => $this->today->subDays(40)->toDateString(),
            'starts_on' => $this->today->subDays(160)->toDateString(), 'status' => ReminderStatus::Dismissed,
        ]);

        $this->activity($ws, $user, $v, 'reminder.created', 'reminder', $batteryReminder->id, "Lucía Demo creó el recordatorio «Revisar la batería» para {$v->displayName()}", $battery->service_date->setTime(17, 30));
    }

    /** @param array<string, MaintenanceRecord> $records */
    private function sportageReminders(Workspace $ws, User $user, Vehicle $v, array $records): void
    {
        $oil = $records['oil'];
        $itv = $records['itv'];

        // Próximo: aceite (quedan < 1.000 km).
        $this->reminder($v, [
            'title' => 'Cambio de aceite y filtros', 'kind' => 'oil', 'zone' => 'engine',
            'due_date' => $oil->service_date->addYear()->toDateString(), 'due_mileage' => $oil->mileage + 10000,
            'recurrence_months' => 12, 'recurrence_km' => 10000,
            'starts_on' => $oil->service_date->toDateString(), 'start_mileage' => $oil->mileage,
        ]);
        $this->reminder($v, [
            'title' => 'Correa de distribución', 'kind' => 'timing_belt', 'zone' => 'engine',
            'notes' => 'Según el plan de mantenimiento del manual.', 'due_mileage' => 120000,
            'starts_on' => '2021-03-02', 'start_mileage' => 0,
        ]);
        $this->reminder($v, [
            'title' => 'ITV', 'kind' => 'itv', 'zone' => 'general',
            'due_date' => $itv->service_date->addMonths(24)->toDateString(), 'recurrence_months' => 24,
            'starts_on' => $itv->service_date->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Renovar el seguro', 'kind' => 'insurance', 'zone' => 'general',
            'due_date' => $this->today->addDays(140)->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $this->today->addDays(140)->subYear()->toDateString(),
        ]);
        $this->reminder($v, [
            'title' => 'Revisión anual', 'kind' => 'service', 'zone' => 'general',
            'due_date' => $records['service']->service_date->addYear()->toDateString(), 'recurrence_months' => 12,
            'starts_on' => $records['service']->service_date->toDateString(),
            'status' => ReminderStatus::Done, 'completed_at' => $oil->service_date->toDateString(), 'completed_mileage' => $oil->mileage,
        ]);
    }

    /** Documentos de ejemplo de cada vehículo personal: [título, tipo, nombre de fichero, intervención, caduca, fecha]. */
    private function personalDocumentSpecs(string $key, array $records): array
    {
        return $key === 'ibiza'
            ? [
                ['Póliza del seguro (ejemplo)', 'insurance', 'poliza-seguro-ejemplo.pdf', null, $this->today->addDays(18), $this->today->addDays(18)->subYear()],
                ['Factura del cambio de batería', 'invoice', 'factura-bateria.pdf', $records['battery'] ?? null, null, ($records['battery'] ?? null)?->service_date],
                ['Informe ITV', 'itv', 'informe-itv.pdf', $records['itv'] ?? null, null, ($records['itv'] ?? null)?->service_date],
                ['Foto del arañazo', 'photo', 'foto-aranazo.png', $records['body'] ?? null, null, ($records['body'] ?? null)?->service_date],
            ]
            : [
                ['Permiso de circulación (copia)', 'registration', 'permiso-circulacion.pdf', null, null, $this->today->subDays(520)],
                ['Manual de mantenimiento', 'manual', 'manual-mantenimiento.pdf', null, null, $this->today->subDays(6)],
            ];
    }

    /** @param array<string, MaintenanceRecord> $records */
    private function personalDocuments(Workspace $ws, User $user, string $key, Vehicle $vehicle, array $records): void
    {
        foreach ($this->personalDocumentSpecs($key, $records) as [$title, $type, $filename, $record, $expires, $date]) {
            $date = CarbonImmutable::parse($date);
            $document = $this->storeDocument($ws, $vehicle, $title, $type, $filename, $record, $expires, $date->setTime(18, 0));
            if ($date >= $this->today->subDays(45)) {
                $this->activity($ws, $user, $vehicle, 'document.uploaded', 'document', $document->id,
                    "Lucía Demo subió el documento «{$title}» a ".$vehicle->displayName(), $date->setTime(18, 1), ['document_type' => $type]);
            }
        }
    }

    private function documentContent(Vehicle $vehicle, string $title, bool $png): string
    {
        return $png ? $this->demoPng() : $this->demoPdf($title, [
            'Documento de demostración generado por CarCare.',
            'Todos los datos son ficticios.',
            'Vehículo: '.$vehicle->displayName().' ('.$vehicle->plate.')',
        ]);
    }

    private function storeDocument(Workspace $ws, Vehicle $vehicle, string $title, string $type, string $filename, ?MaintenanceRecord $record, ?CarbonImmutable $expires, CarbonImmutable $at): Document
    {
        $isPng = str_ends_with($filename, '.png');
        $content = $this->documentContent($vehicle, $title, $isPng);
        $path = "documents/{$ws->id}/".Str::uuid().($isPng ? '.png' : '.pdf');
        $this->files[$path] = $content; // se escribe al confirmar

        return Document::create([
            'vehicle_id' => $vehicle->id, 'maintenance_record_id' => $record?->id, 'title' => $title,
            'document_type' => $type, 'disk' => 'local', 'path' => $path, 'original_filename' => $filename,
            'mime_type' => $isPng ? 'image/png' : 'application/pdf', 'size' => strlen($content),
            'expires_at' => $expires?->toDateString(), 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    /**
     * Si falta el fichero de un documento de ejemplo (p. ej. en un equipo nuevo: `storage/` no va a git),
     * se regenera en la misma ruta. Los documentos que no son de la demo no se pueden regenerar: se avisa.
     */
    private function repairDocumentFiles(Vehicle $vehicle): void
    {
        $demoTitles = collect(['ibiza', 'sportage'])->flatMap(fn ($k) => array_column($this->personalDocumentSpecs($k, []), 0))->all();

        foreach ($vehicle->documents()->get() as $document) {
            if (isset($this->files[$document->path]) || Storage::disk($document->disk)->exists($document->path)) {
                continue;
            }
            if (! in_array($document->title, $demoTitles, true) || $document->disk !== 'local') {
                $this->note("Aviso: falta el fichero del documento #{$document->id} «{$document->title}» y no es de la demo (no se regenera)");

                continue;
            }
            $content = $this->documentContent($vehicle, $document->title, $document->mime_type === 'image/png');
            $this->files[$document->path] = $content;
            if ($document->size !== strlen($content)) {
                $document->forceFill(['size' => strlen($content)])->saveQuietly();
            }
            $this->note("Fichero regenerado: documento #{$document->id} «{$document->title}» ({$document->path})");
        }
    }

    /** PDF mínimo válido de una página (Helvetica, WinAnsi) sin dependencias. */
    private function demoPdf(string $title, array $lines): string
    {
        $esc = fn (string $s) => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], mb_convert_encoding($s, 'Windows-1252', 'UTF-8'));
        $text = 'BT /F1 18 Tf 56 770 Td ('.$esc($title).") Tj ET\n";
        $y = 730;
        foreach ($lines as $line) {
            $text .= "BT /F1 11 Tf 56 {$y} Td (".$esc($line).") Tj ET\n";
            $y -= 18;
        }
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            '<< /Length '.strlen($text)." >>\nstream\n".$text.'endstream',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer'."\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }

    /** PNG 160×100 con un degradado (imagen de ejemplo) generado sin GD. */
    private function demoPng(): string
    {
        $w = 160;
        $h = 100;
        $raw = '';
        for ($y = 0; $y < $h; $y++) {
            $raw .= "\0";
            for ($x = 0; $x < $w; $x++) {
                $scratch = abs(($y - 30) - (int) ($x * 0.35)) < 2 && $x > 40 && $x < 130;
                $raw .= $scratch ? "\xE5\xE7\xEB" : chr(150 + (int) ($x / 4)).chr(30 + (int) ($y / 5)).chr(32);
            }
        }
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n"
            .$chunk('IHDR', pack('NNCCCCC', $w, $h, 8, 2, 0, 0, 0))
            .$chunk('IDAT', gzcompress($raw, 9))
            .$chunk('IEND', '');
    }

    // ═══════════════════════════════ Taller ═══════════════════════════════

    private function seedWorkshop(): void
    {
        $owner = $this->ensureUser('Marcos Demo', 'taller@carcare.test', 'workshop', 'Taller Demo', 420);
        $manager = $this->ensureUser('Elena Demo', 'gerente@carcare.test', 'personal', null, 410);
        $mechanic = $this->ensureUser('Andrés Demo', 'mecanico@carcare.test', 'personal', null, 405);

        $ws = $owner->workspaces()->where('type', 'workshop')->wherePivot('role', WorkspaceRole::Owner->value)->orderBy('workspaces.id')->first();
        $isNew = $ws === null || ! WorkOrder::query()->where('workspace_id', $ws->id)->exists() && ! $ws->customers()->exists();
        if ($ws === null) {
            $ws = $this->workspaces->createWorkshop($owner, 'Taller Demo');
            $this->note('Taller creado: Taller Demo');
        }
        if ($isNew) {
            $ws->forceFill(['settings' => ['bays_count' => 4, 'currency' => 'EUR', 'tax_rate' => '21.00']])->save();
        }
        foreach ([[$manager, WorkspaceRole::Manager, 410], [$mechanic, WorkspaceRole::Mechanic, 405]] as [$member, $role, $daysAgo]) {
            if (! $ws->members()->whereKey($member->id)->exists()) {
                $at = $this->today->subDays($daysAgo);
                $ws->members()->attach($member->id, ['role' => $role->value, 'created_at' => $at, 'updated_at' => $at]);
                $this->note("{$member->email} añadido al taller como {$role->value}");
            }
        }

        $customers = $this->workshopCustomers($ws, $owner, $manager);
        $vehicles = $this->workshopVehicles($ws, $customers);

        if (! WorkOrder::query()->where('workspace_id', $ws->id)->exists()) {
            $this->workOrders($ws, $owner, $manager, $mechanic, $vehicles);
            foreach ($vehicles as $entry) {
                $this->mileage->recalculate($entry['vehicle']);
            }
            $this->fleetReminders($vehicles);
            $this->note('Órdenes del taller creadas (12 meses de entregas y tablero abierto de hoy)');
        } else {
            $this->refreshWorkshopDay($ws, $owner, $mechanic, $vehicles);
        }
    }

    /** @return list<Customer> */
    private function workshopCustomers(Workspace $ws, User $owner, User $manager): array
    {
        $rows = [
            ['Transportes Ejemplo S.L.', 'flota@transportes-ejemplo.test', '600 000 001', 'B00000001', 'Flota de reparto. Facturar a fin de mes.'],
            ['Autoescuela Muestra', 'info@autoescuela-muestra.test', '600 000 002', 'B00000002', 'Coches de prácticas: priorizar, no pueden parar más de un día.'],
            ['Carmen Ficticia Ruiz', 'carmen.ficticia@ejemplo.test', '600 000 003', null, null],
            ['Javier Inventado López', 'javier.inventado@ejemplo.test', '600 000 004', null, 'Prefiere que le llamen por la tarde.'],
            ['Floristería Demo', 'pedidos@floristeria-demo.test', '600 000 005', 'B00000005', null],
            ['Nuria Ejemplo Sanz', null, '600 000 006', null, null],
            ['Pablo Supuesto Gil', 'pablo.supuesto@ejemplo.test', '600 000 007', null, null],
            ['Marta Imaginaria Vidal', 'marta.imaginaria@ejemplo.test', '600 000 008', null, 'Cliente desde la apertura.'],
            ['Taxi Demo 24h', 'taxi24@ejemplo.test', '600 000 009', 'B00000009', 'Taxi: trabajo urgente siempre que sea posible.'],
            ['Sergio Hipotético Mora', null, '600 000 010', null, null],
            ['Lucas Ficticio Pardo', 'lucas.ficticio@ejemplo.test', '600 000 011', null, null],
            ['Inés Muestra Calvo', 'ines.muestra@ejemplo.test', '600 000 012', null, null],
        ];

        $customers = [];
        $created = 0;
        foreach ($rows as $i => [$name, $email, $phone, $taxId, $notes]) {
            $customer = Customer::query()->where('workspace_id', $ws->id)->where('name', $name)->first();
            if ($customer === null) {
                $at = $this->today->subDays(400 - $i * 23)->setTime(11, 0);
                $customer = Customer::create([
                    'workspace_id' => $ws->id, 'name' => $name, 'email' => $email, 'phone' => $phone,
                    'tax_id' => $taxId, 'notes' => $notes, 'created_at' => $at, 'updated_at' => $at,
                ]);
                $by = $i % 3 === 0 ? $manager : $owner;
                $this->activity($ws, $by, null, 'customer.created', 'customer', $customer->id, "{$by->name} dio de alta al cliente {$name}", $at);
                $created++;
            }
            $customers[] = $customer;
        }
        if ($created > 0) {
            $this->note("Clientes del taller creados: {$created}");
        }

        return $customers;
    }

    /** @return list<array{vehicle: Vehicle, base: ?int, daily: int, since: CarbonImmutable}> */
    private function workshopVehicles(Workspace $ws, array $customers): array
    {
        // [cliente, marca, modelo, versión, año, combustible, cambio, carrocería, color, matrícula, km al alta, km/día, apodo]
        $rows = [
            [0, 'Ford', 'Transit Custom', '2.0 EcoBlue', 2020, 'diesel', 'manual', 'van', '#F5F5F4', '2207LBC', 148200, 160, 'Reparto 1'],
            [0, 'Renault', 'Kangoo', '1.5 dCi', 2019, 'diesel', 'manual', 'van', '#F5F5F4', '9930KZF', 171500, 130, 'Reparto 2'],
            [0, 'Citroën', 'Berlingo', '1.5 BlueHDi', 2022, 'diesel', 'manual', 'van', '#1E3A8A', '5512MDK', 64300, 120, 'Reparto 3'],
            [0, 'Toyota', 'Hilux', '2.4 D-4D', 2021, 'diesel', 'manual', 'pickup', '#111827', '3348LTV', 88900, 90, null],
            [1, 'Volkswagen', 'Polo', '1.0 TSI', 2022, 'gasoline', 'manual', 'hatchback', '#0EA5E9', '6701MCH', 71200, 110, 'Prácticas 1'],
            [1, 'Renault', 'Clio', '1.0 TCe', 2021, 'gasoline', 'manual', 'hatchback', '#EA580C', '1185LXR', 98600, 115, 'Prácticas 2'],
            [2, 'Toyota', 'Corolla', '1.8 Hybrid', 2020, 'hybrid', 'automatic', 'sedan', '#9CA3AF', '4470LJD', 76100, 45, null],
            [3, 'Skoda', 'Octavia Combi', '2.0 TDI', 2018, 'diesel', 'manual', 'wagon', '#065F46', '8823KJP', 182400, 70, null],
            [4, 'Fiat', 'Doblò', '1.6 Multijet', 2017, 'diesel', 'manual', 'van', '#F59E0B', '0391KBN', 203300, 60, null],
            [5, 'Peugeot', '3008', '1.5 BlueHDi', 2021, 'diesel', 'automatic', 'suv', '#B91C1C', '7764LWS', 58700, 40, null],
            [6, 'BMW', 'Serie 4 Coupé', '420d', 2019, 'diesel', 'automatic', 'coupe', '#111827', '2650KVY', 94200, 35, null],
            [7, 'Mazda', 'MX-5', '2.0 Skyactiv-G', 2018, 'gasoline', 'manual', 'convertible', '#B91C1C', '5106KHG', null, 0, null],
            [8, 'Toyota', 'Prius+', '1.8 Hybrid', 2019, 'hybrid', 'automatic', 'minivan', '#F5F5F4', '6629KSM', 311500, 260, 'Taxi 24h'],
            [9, 'Seat', 'León', '1.5 TSI', 2020, 'gasoline', 'manual', 'hatchback', '#7C3AED', '3902LGZ', 67800, 38, null],
            [10, 'Dacia', 'Duster', '1.5 dCi 4x4', 2019, 'diesel', 'manual', 'suv', '#78350F', '1477KTN', 121900, 55, null],
            [11, 'Hyundai', 'Kona Eléctrico', '64 kWh', 2022, 'electric', 'automatic', 'suv', '#0EA5E9', '8215MBF', 39400, 42, null],
            [2, 'Opel', 'Zafira', '1.6 CDTi', 2016, 'diesel', 'manual', 'minivan', '#9CA3AF', '9058JRW', 214600, 48, null],
            [5, 'Audi', 'A4 Avant', '2.0 TDI', 2017, 'diesel', 'automatic', 'wagon', '#1F2937', '4731JZB', 167300, 52, null],
            [3, 'Ford', 'Ranger', '2.0 EcoBlue', 2023, 'diesel', 'manual', 'pickup', '#9A3412', '2584MNX', 31200, 65, null],
            [6, 'Kia', 'Ceed', '1.6 CRDi', 2018, 'diesel', 'manual', 'sedan', '#047857', '6340KMW', 139800, 47, null],
        ];

        $vehicles = [];
        $created = 0;
        foreach ($rows as $i => [$c, $make, $model, $version, $year, $fuel, $gearbox, $body, $color, $plate, $baseKm, $daily, $nickname]) {
            $since = $this->today->subDays(380 - $i * 9);
            $vehicle = Vehicle::query()->where('workspace_id', $ws->id)->where('plate', $plate)->first();
            if ($vehicle === null) {
                $vehicle = Vehicle::create([
                    'workspace_id' => $ws->id, 'customer_id' => $customers[$c]->id, 'nickname' => $nickname,
                    'make' => $make, 'model' => $model, 'version' => $version, 'year' => $year, 'fuel_type' => $fuel,
                    'transmission' => $gearbox, 'body_type' => $body, 'color_hex' => $color, 'plate' => $plate,
                    'created_at' => $since->setTime(12, 0), 'updated_at' => $since->setTime(12, 0),
                ]);
                if ($baseKm !== null) {
                    $this->log($vehicle, $since, $baseKm, MileageSource::VehicleCreated, $vehicle->id);
                }
                $this->mileage->recalculate($vehicle);
                $created++;
            }
            $vehicles[] = ['vehicle' => $vehicle, 'base' => $baseKm, 'daily' => $daily, 'since' => $since];
        }
        if ($created > 0) {
            $this->note("Vehículos del taller creados: {$created}");
        }

        return $vehicles;
    }

    /** km estimado del vehículo de taller en una fecha (para mileage_in). */
    private function fleetKm(array $entry, CarbonImmutable $date): ?int
    {
        if ($entry['base'] === null) {
            return null;
        }

        return $entry['base'] + max(0, (int) $entry['since']->diffInDays($date)) * $entry['daily'];
    }

    /** Trabajos tipo con sus líneas (precios orientativos ficticios). */
    private function jobs(): array
    {
        $labor = fn (string $hours, string $name = 'Mano de obra') => ['kind' => 'labor', 'name' => $name, 'part_number' => null, 'quantity' => $hours, 'unit_price' => '48.00'];
        $part = fn (string $name, string $qty, string $price, ?string $ref = null) => ['kind' => 'part', 'name' => $name, 'part_number' => $ref, 'quantity' => $qty, 'unit_price' => $price];
        $fluid = fn (string $name, string $qty, string $price) => ['kind' => 'fluid', 'name' => $name, 'part_number' => null, 'quantity' => $qty, 'unit_price' => $price];

        return [
            'oil' => ['Cambio de aceite y filtros', 'Toca revisión de aceite.', 'Aceite y filtros sustituidos. Nivel correcto.', [$fluid('Aceite 5W-30 (litros)', '5.00', '9.80'), $part('Filtro de aceite', '1', '12.50', 'FO-1042'), $part('Filtro de aire', '1', '18.90', 'FA-2210'), $labor('0.80')]],
            'brakes' => ['Discos y pastillas delanteros', 'Ruido metálico al frenar.', 'Pastillas al límite y discos rayados.', [$part('Disco de freno delantero', '2', '48.60', 'DF-118'), $part('Juego de pastillas', '1', '39.90', 'PF-3302'), $labor('1.50')]],
            'diagnosis' => ['Diagnóstico de testigo de motor', 'Testigo de motor encendido desde ayer.', 'Sonda lambda con lectura errática.', [$labor('1.00', 'Diagnosis electrónica'), $part('Sonda lambda', '1', '86.40', 'SL-2290')]],
            'clutch' => ['Sustitución del embrague', 'El embrague patina en cuesta.', 'Disco de embrague desgastado.', [$part('Kit de embrague', '1', '289.00', 'KE-5510'), $fluid('Líquido hidráulico (litros)', '0.50', '12.00'), $labor('5.00')]],
            'timing' => ['Correa de distribución y bomba de agua', 'Mantenimiento por kilometraje.', 'Kit de distribución sustituido según fabricante.', [$part('Kit de distribución', '1', '189.50', 'KD-7781'), $part('Bomba de agua', '1', '64.30', 'BA-0912'), $fluid('Refrigerante (litros)', '3.00', '6.20'), $labor('4.00')]],
            'pre_itv' => ['Revisión pre-ITV', 'Pasa la ITV la semana que viene.', 'Luces y holguras revisadas; una lámpara fundida.', [$labor('1.00', 'Revisión pre-ITV'), $part('Lámpara H7', '2', '7.90')]],
            'tyres' => ['Cuatro neumáticos nuevos', 'Neumáticos gastados.', 'Dibujo por debajo de 2 mm.', [$part('Neumático 205/55 R16', '4', '79.90'), $labor('4.00', 'Montaje y equilibrado')]],
            'ac' => ['Carga de aire acondicionado', 'El aire no enfría.', 'Falta de gas; sin fugas detectadas.', [$fluid('Gas R1234yf (kg)', '0.50', '96.00'), $labor('0.70')]],
            'alternator' => ['Reparación del alternador', 'Se enciende el testigo de batería.', 'Alternador sin carga.', [$part('Alternador reacondicionado', '1', '210.00', 'AL-3307'), $labor('2.00')]],
            'shocks' => ['Amortiguadores traseros', 'Rebota mucho en los baches.', 'Amortiguadores traseros sin efecto.', [$part('Amortiguador trasero', '2', '74.50', 'AM-2041'), $labor('2.00')]],
            'battery' => ['Cambio de batería', 'No arranca por las mañanas.', 'Batería con un 40 % de capacidad.', [$part('Batería 70 Ah', '1', '119.90', 'BT-70640'), $labor('0.30')]],
            'exhaust' => ['Fuga en el escape', 'Hace mucho ruido el tubo de escape.', 'Silenciador intermedio perforado.', [$part('Silenciador intermedio', '1', '96.40', 'SI-118'), $part('Abrazadera', '2', '4.50'), $labor('1.20')]],
            'service' => ['Revisión oficial', 'Revisión de mantenimiento anual.', 'Revisión completa según plan del fabricante.', [$fluid('Aceite 0W-30 (litros)', '5.30', '11.40'), $part('Filtro de aceite', '1', '14.20'), $part('Filtro de habitáculo', '1', '16.40'), $part('Filtro de combustible', '1', '38.70'), $labor('2.00')]],
            'alignment' => ['Alineación de dirección', 'El volante tira hacia la derecha.', 'Convergencia fuera de cotas.', [$labor('1.00', 'Alineación 3D')]],
            'wipers' => ['Escobillas y lámparas', 'Escobillas que dejan marcas.', null, [$part('Juego de escobillas', '1', '24.90'), $labor('0.20')]],
        ];
    }

    private function workOrders(Workspace $ws, User $owner, User $manager, User $mechanic, array $vehicles): void
    {
        $now = CarbonImmutable::now();
        $today = $this->today;
        $at = fn (int $daysAgo, int $h, int $m = 0) => $today->subDays($daysAgo)->setTime($h, $m);

        // [vehículo, trabajo, estado, recibida, prometida, elevador, asignada, prioridad]
        $specs = [
            // Entregadas: repartidas en los últimos 12 meses (analítica) y más densas en los últimos 2.
            [0, 'oil', 'delivered', $at(340, 8, 30), $at(339, 18), null, $mechanic, 'normal'],
            [7, 'timing', 'delivered', $at(318, 9, 10), $at(316, 19), null, $mechanic, 'normal'],
            [12, 'brakes', 'delivered', $at(296, 8, 5), $at(296, 19), null, $owner, 'urgent'],
            [3, 'service', 'delivered', $at(271, 10, 0), $at(270, 18), null, $mechanic, 'normal'],
            [8, 'clutch', 'delivered', $at(244, 8, 45), $at(241, 19), null, $mechanic, 'high'],
            [5, 'pre_itv', 'delivered', $at(219, 9, 30), $at(219, 14), null, $owner, 'high'],
            [13, 'ac', 'delivered', $at(193, 11, 0), $at(193, 18), null, $mechanic, 'low'],
            [1, 'alternator', 'delivered', $at(168, 8, 15), $at(167, 18), null, $mechanic, 'high'],
            [16, 'shocks', 'delivered', $at(141, 9, 0), $at(140, 19), null, $owner, 'normal'],
            [12, 'tyres', 'delivered', $at(117, 8, 20), $at(117, 13), null, $mechanic, 'urgent'],
            [9, 'battery', 'delivered', $at(89, 9, 40), $at(89, 12), null, $mechanic, 'normal'],
            [17, 'exhaust', 'delivered', $at(63, 10, 15), $at(62, 18), null, $owner, 'normal'],
            [6, 'battery', 'delivered', $at(55, 9, 0), $at(54, 18), null, $mechanic, 'normal'],
            [11, 'oil', 'delivered', $at(48, 8, 30), $at(48, 17), null, $mechanic, 'low'],
            [4, 'brakes', 'delivered', $at(41, 8, 0), $at(41, 19), null, $mechanic, 'high'],
            [15, 'tyres', 'delivered', $at(34, 10, 0), $at(34, 14), null, $owner, 'normal'],
            [8, 'pre_itv', 'delivered', $at(29, 9, 15), $at(29, 13), null, $mechanic, 'high'],
            [19, 'service', 'delivered', $at(22, 9, 20), $at(21, 18), null, $mechanic, 'normal'],
            [2, 'shocks', 'delivered', $at(15, 8, 45), $at(14, 18), null, $owner, 'normal'],
            [14, 'alignment', 'delivered', $at(8, 12, 0), $at(8, 17), null, $owner, 'low'],
            // Canceladas.
            [10, 'diagnosis', 'cancelled', $at(131, 10, 30), $at(130, 18), null, null, 'normal'],
            [18, 'wipers', 'cancelled', $at(27, 16, 0), null, null, null, 'low'],
            // Abiertas: 3 en elevadores (1, 2 y 3), algunas tarde y algunas para hoy.
            [0, 'brakes', 'in_progress', $at(2, 8, 30), $today->setTime(18, 0), 1, $mechanic, 'high'],
            [12, 'clutch', 'in_progress', $at(3, 9, 0), $at(1, 19), 2, $mechanic, 'urgent'],
            [6, 'ac', 'in_progress', $at(1, 16, 30), $today->addDay()->setTime(13, 0), null, $owner, 'normal'],
            [1, 'diagnosis', 'diagnosing', $at(1, 8, 10), $today->setTime(19, 0), 3, $mechanic, 'high'],
            [15, 'diagnosis', 'diagnosing', $at(2, 11, 45), $today->addDays(2)->setTime(18, 0), null, null, 'normal'],
            [2, 'timing', 'waiting_parts', $at(6, 9, 0), $at(2, 18), null, $mechanic, 'high'],
            [7, 'alternator', 'waiting_parts', $at(4, 10, 30), $today->addDays(3)->setTime(18, 0), null, $owner, 'normal'],
            [16, 'exhaust', 'waiting_parts', $at(9, 9, 15), $at(1, 13), null, $mechanic, 'normal'],
            [5, 'pre_itv', 'ready', $at(1, 8, 0), $today->setTime(13, 30), null, $mechanic, 'high'],
            [9, 'tyres', 'ready', $at(2, 9, 30), $at(1, 18), null, $owner, 'normal'],
            [13, 'battery', 'ready', $at(1, 17, 40), null, null, $mechanic, 'low'],
            [4, 'oil', 'received', $today->setTime(8, 40), $today->addDays(1)->setTime(14, 0), null, null, 'normal'],
            [10, 'shocks', 'received', $at(1, 18, 10), $today->addDays(2)->setTime(19, 0), null, null, 'normal'],
        ];

        usort($specs, fn ($a, $b) => $a[3] <=> $b[3]);

        $jobs = $this->jobs();
        $sequences = [];

        foreach ($specs as [$vIndex, $jobKey, $status, $receivedAt, $promisedAt, $bay, $assignee, $priority]) {
            $entry = $vehicles[$vIndex];
            /** @var Vehicle $vehicle */
            $vehicle = $entry['vehicle'];
            [$title, $complaint, $diagnosis, $items] = $jobs[$jobKey];
            $status = WorkOrderStatus::from($status);
            $receivedAt = $receivedAt->min($now);

            $year = $receivedAt->year;
            $sequences[$year] = ($sequences[$year] ?? 0) + 1;
            $number = sprintf('OT-%d-%04d', $year, $sequences[$year]);

            $rows = LineItems::rows($items);
            $subtotal = LineItems::sumCents($rows) ?? 0;
            $tax = Money::percentOf($subtotal, '21.00');

            $completedAt = null;
            $deliveredAt = null;
            if ($status === WorkOrderStatus::Delivered) {
                $deliveredAt = ($promisedAt ?? $receivedAt->addDay())->subMinutes(mt_rand(0, 90));
                $completedAt = $deliveredAt->subHours(mt_rand(1, 5));
            } elseif ($status === WorkOrderStatus::Ready) {
                $completedAt = $receivedAt->addHours(mt_rand(3, 8))->min($now->subMinutes(20));
            }

            $mileageIn = $this->fleetKm($entry, $receivedAt->startOfDay());
            $updatedAt = $deliveredAt ?? $completedAt ?? $receivedAt->addHours(2)->min($now);

            $order = WorkOrder::create([
                'workspace_id' => $ws->id, 'vehicle_id' => $vehicle->id, 'customer_id' => $vehicle->customer_id,
                'number' => $number, 'year' => $year, 'sequence' => $sequences[$year],
                'title' => $title, 'complaint' => $complaint,
                'diagnosis' => in_array($status, [WorkOrderStatus::Received], true) ? null : $diagnosis,
                'status' => $status, 'priority' => $priority, 'bay' => $bay, 'assigned_to' => $assignee?->id,
                'mileage_in' => $mileageIn, 'received_at' => $receivedAt, 'promised_at' => $promisedAt,
                'completed_at' => $completedAt, 'delivered_at' => $deliveredAt,
                'subtotal' => Money::format($subtotal), 'tax_rate' => '21.00', 'tax_amount' => Money::format($tax),
                'total' => Money::format($subtotal + $tax),
                'created_at' => $receivedAt, 'updated_at' => $updatedAt,
            ]);
            $order->items()->createMany($rows);

            if ($mileageIn !== null) {
                $this->log($vehicle, $receivedAt->startOfDay(), $mileageIn, MileageSource::WorkOrder, $order->id);
            }

            if ($status === WorkOrderStatus::Delivered) {
                $record = $this->maintenance->createFromWorkOrder($order);
                $record->forceFill(['created_at' => $deliveredAt, 'updated_at' => $deliveredAt])->save();
                $order->forceFill(['maintenance_record_id' => $record->id])->saveQuietly();
            }

            $this->workOrderActivity($ws, $owner, $manager, $mechanic, $order, $vehicle, $status);
        }
    }

    private function workOrderActivity(Workspace $ws, User $owner, User $manager, User $mechanic, WorkOrder $order, Vehicle $vehicle, WorkOrderStatus $status): void
    {
        $received = $order->received_at->toImmutable();
        if ($received < $this->today->subDays(45)) {
            return;
        }

        $label = $vehicle->displayName().($vehicle->plate ? " ({$vehicle->plate})" : '');
        $opener = $order->id % 2 === 0 ? $manager : $owner;
        $this->activity($ws, $opener, $vehicle, 'work_order.created', 'work_order', $order->id,
            "{$opener->name} abrió la orden {$order->number} para {$label}", $received, ['status' => 'received']);

        $path = match ($status) {
            WorkOrderStatus::Diagnosing => ['diagnosing'],
            WorkOrderStatus::WaitingParts => ['diagnosing', 'waiting_parts'],
            WorkOrderStatus::InProgress => ['diagnosing', 'in_progress'],
            WorkOrderStatus::Ready => ['diagnosing', 'in_progress', 'ready'],
            WorkOrderStatus::Delivered => ['diagnosing', 'in_progress', 'ready', 'delivered'],
            WorkOrderStatus::Cancelled => ['cancelled'],
            default => [],
        };

        $end = ($order->delivered_at ?? $order->completed_at ?? CarbonImmutable::now())->toImmutable();
        $step = max(10, (int) ($received->diffInMinutes($end) / (count($path) + 1)));
        $from = 'received';
        foreach ($path as $i => $to) {
            $at = $received->addMinutes($step * ($i + 1))->min(CarbonImmutable::now()->subMinutes(5));
            $actor = in_array($to, ['delivered', 'cancelled'], true) ? $owner : $mechanic;
            $toLabel = WorkOrderStatus::from($to)->label();
            $this->activity($ws, $actor, $vehicle, 'work_order.status_changed', 'work_order', $order->id,
                "{$actor->name} movió {$order->number} a «{$toLabel}»", $at, ['from' => $from, 'to' => $to]);
            $from = $to;
        }
    }

    /**
     * Taller que ya tenía órdenes: el movimiento del día, con las reglas de la API (WorkOrderService).
     * Solo si hoy no ha entrado ninguna orden demo (si no, ya está al día). Las órdenes abiertas de la demo
     * que no se han tocado hoy avanzan un paso (las listas se entregan y crean su intervención) y entran
     * tres nuevas. Solo toca órdenes de vehículos demo con títulos del catálogo de trabajos de la demo.
     */
    private function refreshWorkshopDay(Workspace $ws, User $owner, User $mechanic, array $vehicles): void
    {
        $vehicleIds = collect($vehicles)->map(fn (array $e) => $e['vehicle']->id)->all();
        $titles = collect($this->jobs())->map(fn (array $job) => $job[0])->values()->all();
        $demoOrders = fn () => WorkOrder::query()->where('workspace_id', $ws->id)->whereIn('vehicle_id', $vehicleIds)->whereIn('title', $titles);

        if ($demoOrders()->where('received_at', '>=', $this->today->startOfDay())->exists()) {
            $this->note('Taller: ya había movimiento de hoy, no se cambia nada');

            return;
        }

        $next = [
            'ready' => [WorkOrderStatus::Delivered, $owner],
            'in_progress' => [WorkOrderStatus::Ready, $mechanic],
            'waiting_parts' => [WorkOrderStatus::InProgress, $mechanic],
            'diagnosing' => [WorkOrderStatus::InProgress, $mechanic],
            'received' => [WorkOrderStatus::Diagnosing, $mechanic],
        ];
        $open = $demoOrders()->open()->where('updated_at', '<', $this->today->startOfDay())
            ->orderBy('received_at')->orderBy('id')->get();
        $moved = 0;
        foreach (array_keys($next) as $from) {
            foreach ($open->filter(fn (WorkOrder $o) => $o->status->value === $from)->values() as $i => $order) {
                [$to, $actor] = $next[$from];
                // Una de cada dos en diagnóstico se queda esperando recambios.
                if ($from === 'diagnosing' && $i % 2 === 1) {
                    $to = WorkOrderStatus::WaitingParts;
                }
                $bay = ($to === WorkOrderStatus::InProgress && $order->bay === null) ? $this->freeBay($ws) : null;
                $this->actingAs($actor, fn () => $this->workOrders->changeStatus($order->fresh(), $to, $bay !== null, $bay));
                $this->note("Taller: {$order->number} pasa de «".WorkOrderStatus::from($from)->label()."» a «{$to->label()}»".($bay ? " (elevador {$bay})" : ''));
                $moved++;
            }
        }

        // Entran tres órdenes nuevas hoy, de vehículos sin orden abierta.
        $busy = WorkOrder::query()->where('workspace_id', $ws->id)->open()->pluck('vehicle_id')->all();
        $candidates = collect($vehicles)
            ->filter(fn (array $e) => ! in_array($e['vehicle']->id, $busy, true) && $e['vehicle']->archived_at === null)
            ->values();
        $jobs = $this->jobs();
        $jobKeys = array_keys($jobs);
        for ($n = 0; $n < 3 && $candidates->isNotEmpty(); $n++) {
            $entry = $candidates->pull(mt_rand(0, $candidates->count() - 1));
            $candidates = $candidates->values();
            /** @var Vehicle $vehicle */
            $vehicle = $entry['vehicle']->fresh();
            [$title, $complaint, , $items] = $jobs[$jobKeys[mt_rand(0, count($jobKeys) - 1)]];
            $mileageIn = $vehicle->current_mileage === null ? null
                : $vehicle->current_mileage + max(0, (int) ($vehicle->mileage_updated_at?->diffInDays($this->today) ?? 0)) * $entry['daily'];
            $order = $this->actingAs($n === 1 ? $owner : $mechanic, fn () => $this->workOrders->create($ws, [
                'vehicle_id' => $vehicle->id,
                'title' => $title,
                'complaint' => $complaint,
                'priority' => ['normal', 'high', 'low'][$n],
                'assigned_to' => $n === 2 ? null : $mechanic->id,
                'promised_at' => $n === 0 ? $this->today->setTime(19, 0) : $this->today->addDays($n)->setTime(18, 0),
                'mileage_in' => $mileageIn,
                'items' => $items,
            ]));
            $this->note("Taller: entra hoy {$order->number} «{$title}» para {$vehicle->displayName()}");
        }

        if ($moved === 0) {
            $this->note('Taller: no había órdenes demo abiertas que mover');
        }
    }

    private function freeBay(Workspace $ws): ?int
    {
        $used = WorkOrder::query()->where('workspace_id', $ws->id)->open()->whereNotNull('bay')->pluck('bay')->all();
        foreach (range(1, $ws->baysCount()) as $bay) {
            if (! in_array($bay, $used)) {
                return $bay;
            }
        }

        return null;
    }

    /** Alertas de flota: ITV vencida, ITV y aceite próximos, y una revisión sin datos de km. */
    private function fleetReminders(array $vehicles): void
    {
        $today = $this->today;
        // Último km conocido por el taller (lecturas de alta y de entrada de órdenes).
        $km = fn (int $i) => (int) $vehicles[$i]['vehicle']->fresh()->current_mileage;

        $specs = [
            [0, ['title' => 'ITV de la furgoneta', 'kind' => 'itv', 'zone' => 'general', 'due_date' => $today->subDays(9)->toDateString(), 'recurrence_months' => 12, 'starts_on' => $today->subDays(9)->subYear()->toDateString()]],
            [1, ['title' => 'ITV', 'kind' => 'itv', 'zone' => 'general', 'due_date' => $today->addDays(12)->toDateString(), 'recurrence_months' => 12, 'starts_on' => $today->addDays(12)->subYear()->toDateString()]],
            [3, ['title' => 'Cambio de aceite', 'kind' => 'oil', 'zone' => 'engine', 'due_mileage' => $km(3) + 600, 'recurrence_km' => 15000, 'starts_on' => $today->subDays(160)->toDateString(), 'start_mileage' => $km(3) - 14400]],
            [12, ['title' => 'Revisión de taxi', 'kind' => 'service', 'zone' => 'general', 'due_date' => $today->addDays(47)->toDateString(), 'due_mileage' => $km(12) + 9000, 'recurrence_months' => 6, 'starts_on' => $today->subDays(135)->toDateString(), 'start_mileage' => $km(12) - 6000]],
            [11, ['title' => 'Revisión de la capota', 'kind' => 'custom', 'zone' => 'body', 'notes' => 'El cliente no recuerda el kilometraje.', 'due_mileage' => 60000, 'starts_on' => $today->subDays(30)->toDateString()]],
            [5, ['title' => 'Pastillas de freno', 'kind' => 'brakes', 'zone' => 'brakes', 'due_mileage' => $km(5) + 4200, 'starts_on' => $today->subDays(219)->toDateString(), 'start_mileage' => $km(5) - 20800]],
        ];

        foreach ($specs as [$i, $data]) {
            $vehicle = $vehicles[$i]['vehicle'];
            if (! $vehicle->reminders()->where('title', $data['title'])->exists()) {
                $this->reminder($vehicle, $data);
            }
        }
    }
}
