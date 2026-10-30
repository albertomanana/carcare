<?php

use App\Enums\ReminderState;
use App\Enums\WorkOrderStatus;
use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\Reminder;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\Workspace;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Storage;

/*
 * Datos de demostración (contrato §5): se siembran también en SQLite, cumplen las reglas de negocio
 * (sin doble conteo, km coherentes, numeración sin huecos), se pueden repetir y nunca en producción.
 */

beforeEach(function () {
    Storage::fake('local');
});

function demoCounts(): array
{
    return [
        'users' => User::count(),
        'workspaces' => Workspace::count(),
        'vehicles' => Vehicle::count(),
        'records' => MaintenanceRecord::count(),
        'expenses' => Expense::count(),
        'reminders' => Reminder::count(),
        'orders' => WorkOrder::count(),
        'profiles' => \App\Models\WorkshopProfile::count(),
        'requests' => \App\Models\RepairRequest::count(),
        'quotes' => \App\Models\RepairQuote::count(),
        'notifications' => \Illuminate\Support\Facades\DB::table('notifications')->count(),
    ];
}

it('siembra la cuenta particular con 2 vehículos y ~18 meses de historial coherente', function () {
    $this->seed(DemoSeeder::class);

    $demo = User::where('email', 'demo@carcare.test')->sole();
    $ws = $demo->personalWorkspace();
    $vehicles = $ws->vehicles()->get();
    expect($vehicles)->toHaveCount(2)
        ->and($vehicles->pluck('body_type')->map->value->unique())->toHaveCount(2);

    foreach ($vehicles as $vehicle) {
        $logs = $vehicle->mileageLogs()->oldestFirst()->get();
        expect($logs->count())->toBeGreaterThan(60)
            ->and($logs->first()->recorded_at->diffInMonths(today()))->toBeGreaterThanOrEqual(17)
            // km actual = lectura más reciente y lecturas sin retrocesos.
            ->and($vehicle->current_mileage)->toBe($logs->last()->mileage)
            ->and($logs->pluck('mileage')->all())->toBe($logs->pluck('mileage')->sort()->values()->all());

        expect($vehicle->expenses()->where('category', 'fuel')->where('full_tank', true)->whereNotNull('mileage')->count())->toBeGreaterThanOrEqual(10)
            ->and($vehicle->maintenanceRecords()->has('items')->count())->toBeGreaterThan(0);
    }

    // D3-A: cada intervención activa con coste tiene exactamente un gasto vinculado con el mismo importe.
    $records = MaintenanceRecord::whereIn('vehicle_id', $vehicles->pluck('id'))->whereNull('archived_at')->where('total_cost', '>', 0)->get();
    expect($records)->not->toBeEmpty();
    foreach ($records as $record) {
        expect($record->expense()->count())->toBe(1)
            ->and($record->expense->amount)->toBe($record->total_cost);
    }

    // Recordatorios: al menos uno vencido, uno próximo y varios al día.
    $states = Reminder::whereIn('vehicle_id', $vehicles->pluck('id'))->where('status', 'pending')->with('vehicle')->get()
        ->map(fn (Reminder $r) => $r->evaluate()['state']);
    expect($states->filter(fn ($s) => $s === ReminderState::Overdue)->count())->toBeGreaterThanOrEqual(1)
        ->and($states->filter(fn ($s) => $s === ReminderState::Soon)->count())->toBeGreaterThanOrEqual(1)
        ->and($states->filter(fn ($s) => $s === ReminderState::Ok)->count())->toBeGreaterThanOrEqual(2);

    // Documentos de ejemplo guardados en el disco privado.
    $documents = \App\Models\Document::whereIn('vehicle_id', $vehicles->pluck('id'))->get();
    expect($documents)->not->toBeEmpty();
    $documents->each(fn ($d) => Storage::disk('local')->assertExists($d->path));
});

it('siembra el taller con 4 elevadores, equipo, ~12 clientes, ~20 vehículos y ~30 órdenes', function () {
    $this->seed(DemoSeeder::class);

    $owner = User::where('email', 'taller@carcare.test')->sole();
    $ws = workshopOf($owner);
    expect($ws->name)->toBe('Taller Demo')
        ->and($ws->baysCount())->toBe(4)
        ->and(User::where('email', 'gerente@carcare.test')->sole()->roleIn($ws)?->value)->toBe('manager')
        ->and(User::where('email', 'mecanico@carcare.test')->sole()->roleIn($ws)?->value)->toBe('mechanic')
        ->and($ws->customers()->count())->toBeBetween(10, 15);

    $vehicles = $ws->vehicles()->get();
    expect($vehicles->count())->toBeBetween(18, 25)
        ->and($vehicles->pluck('body_type')->map->value->unique()->count())->toBeGreaterThanOrEqual(5)
        ->and($vehicles->pluck('color_hex')->unique()->count())->toBeGreaterThanOrEqual(5);

    $orders = WorkOrder::where('workspace_id', $ws->id)->get();
    // ~30 órdenes propias del taller, más la que nació de la solicitud convertida de demo@ (E16).
    $fromRequests = \App\Models\RepairRequest::whereNotNull('work_order_id')->pluck('work_order_id');
    expect($fromRequests)->toHaveCount(1)
        ->and($orders->whereNotIn('id', $fromRequests)->count())->toBeBetween(25, 35)
        ->and($orders->pluck('status')->map->value->unique()->sort()->values()->all())->toBe(collect(WorkOrderStatus::values())->sort()->values()->all())
        ->and($orders->filter(fn ($o) => ! $o->isFinal() && $o->bay !== null)->count())->toBe(3)
        ->and($orders->filter(fn ($o) => $o->isLate())->count())->toBeGreaterThanOrEqual(1);

    // Numeración OT-AAAA-NNNN correlativa por año, sin huecos ni repetidos.
    foreach ($orders->groupBy('year') as $year => $group) {
        expect($group->pluck('sequence')->sort()->values()->all())->toBe(range(1, $group->count()));
        $group->each(fn ($o) => expect($o->number)->toBe(sprintf('OT-%d-%04d', $year, $o->sequence)));
    }

    // Toda orden entregada tiene su intervención en el historial; en el taller no hay gastos vinculados.
    $orders->where('status', WorkOrderStatus::Delivered)->each(fn ($o) => expect($o->maintenance_record_id)->not->toBeNull());
    expect(Expense::whereIn('vehicle_id', $vehicles->pluck('id'))->whereNotNull('maintenance_record_id')->count())->toBe(0);
});

it('las cuentas demo inician sesión y sus pantallas principales responden', function () {
    $this->seed(DemoSeeder::class);
    $spa = fn () => $this->withHeaders(['Referer' => 'http://localhost:5173', 'Accept' => 'application/json']);

    $me = $spa()->postJson('/api/v1/auth/login', ['email' => 'demo@carcare.test', 'password' => 'password'])->assertOk();
    $ws = $me->json('data.workspaces.0.id');
    $vehicle = $spa()->getJson("/api/v1/workspaces/{$ws}/vehicles")->assertOk()->json('data.0.id');
    $spa()->getJson("/api/v1/workspaces/{$ws}/dashboard")->assertOk()->assertJsonCount(2, 'data.vehicles');
    $spa()->getJson("/api/v1/vehicles/{$vehicle}/summary")->assertOk()->assertJsonPath('data.consumption.available', true);
    $spa()->getJson("/api/v1/vehicles/{$vehicle}/zones")->assertOk()->assertJsonCount(10, 'data');
    $spa()->getJson("/api/v1/vehicles/{$vehicle}/journal")->assertOk()->assertJsonPath('data', fn ($days) => count($days) > 0);
    $spa()->postJson('/api/v1/auth/logout')->assertNoContent();

    auth()->forgetGuards();
    $taller = $spa()->postJson('/api/v1/auth/login', ['email' => 'mecanico@carcare.test', 'password' => 'password'])->assertOk();
    $workshop = collect($taller->json('data.workspaces'))->firstWhere('type', 'workshop');
    expect($workshop['role'])->toBe('mechanic');
    $spa()->getJson("/api/v1/workspaces/{$workshop['id']}/dashboard")->assertOk()
        ->assertJsonPath('data.revenue', null)
        ->assertJsonCount(4, 'data.bays');
    $spa()->getJson("/api/v1/workspaces/{$workshop['id']}/analytics")->assertForbidden();
});

it('se puede ejecutar varias veces sin duplicar datos', function () {
    $this->seed(DemoSeeder::class);
    $first = demoCounts();

    $this->seed(DemoSeeder::class);

    expect(demoCounts())->toBe($first)
        ->and(User::whereIn('email', DemoSeeder::EMAILS)->count())->toBe(4);
});

it('no siembra datos demo en producción', function () {
    // Se invocan directamente: `db:seed` en producción pediría confirmación por consola.
    app()['env'] = 'production';

    try {
        expect(fn () => app(DemoSeeder::class)->setContainer(app())->run())
            ->toThrow(RuntimeException::class, 'DemoSeeder no se ejecuta en producción');
        app(DatabaseSeeder::class)->setContainer(app())->run();
        expect(User::count())->toBe(0);
    } finally {
        app()['env'] = 'testing';
    }
});
