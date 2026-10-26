<?php

use App\Enums\MileageSource;
use App\Enums\WorkspaceRole;
use App\Models\MileageLog;
use App\Models\Reminder;
use App\Services\MileageService;
use App\Services\ReminderService;

/*
 * Tarea 27 (E7‑1), contrato §3.4.1: cada lectura de km enlaza con su registro de origen (`source_id`).
 *  - Siempre del mismo vehículo; null en las manuales.
 *  - Quien no ve gastos (mechanic en un taller) recibe las lecturas `expense` con `source_id = null`.
 *  - Nunca huérfana: borrar un recordatorio borra su lectura, y una migración repara las antiguas.
 */

/**
 * Furgoneta de un taller con una lectura de cada origen, creadas por la API como lo haría la SPA.
 *
 * @return object{owner: \App\Models\User, mechanic: \App\Models\User, manager: \App\Models\User, vehicle: array, ids: array<string, ?int>}
 */
function sourcesWorld(): object
{
    $owner = makeUser('Olga Origen', 'Taller Origen');
    $wws = workshopOf($owner);
    $mechanic = addMember($wws, makeUser('Mario Origen'), WorkspaceRole::Mechanic);
    $manager = addMember($wws, makeUser('Gema Origen'), WorkspaceRole::Manager);
    loginAs($owner);
    $t = test();

    $vehicle = $t->postJson("/api/v1/workspaces/{$wws->id}/vehicles", [
        'make' => 'Ford', 'model' => 'Transit', 'current_mileage' => 100000,
    ])->assertCreated()->json('data');
    $v = "/api/v1/vehicles/{$vehicle['id']}";

    // Todas hoy y crecientes: el alta del vehículo es la lectura de hoy con su km inicial.
    $t->postJson("{$v}/mileage", ['recorded_at' => day(), 'mileage' => 100500])->assertCreated();
    $record = $t->postJson("{$v}/maintenance", [
        'type' => 'maintenance', 'zone' => 'engine', 'title' => 'Aceite', 'service_date' => day(), 'mileage' => 101000,
    ])->assertCreated()->json('data.id');
    $expense = $t->postJson("{$v}/expenses", [
        'category' => 'fuel', 'amount' => '60.00', 'expense_date' => day(), 'mileage' => 101500, 'fuel_quantity' => '40.00', 'full_tank' => true,
    ])->assertCreated()->json('data.id');
    $order = $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", [
        'vehicle_id' => $vehicle['id'], 'title' => 'Frenos', 'mileage_in' => 102000,
    ])->assertCreated()->json('data.id');
    $reminder = $t->postJson("{$v}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(30)])->assertCreated()->json('data.id');
    $t->postJson("/api/v1/reminders/{$reminder}/complete", ['completed_at' => day(), 'mileage' => 102500, 'create_next' => false])->assertOk();

    return (object) [
        'owner' => $owner, 'mechanic' => $mechanic, 'manager' => $manager, 'vehicle' => $vehicle, 'v' => $v,
        'ids' => [
            'manual' => null,
            'vehicle_created' => $vehicle['id'],
            'maintenance' => $record,
            'expense' => $expense,
            'work_order' => $order,
            'reminder' => $reminder,
        ],
    ];
}

/** source => source_id de una lista de MileageLog (una lectura por origen en sourcesWorld). */
function sourceIds(array $logs): array
{
    return collect($logs)->mapWithKeys(fn (array $log) => [$log['source'] => $log['source_id']])->sortKeys()->all();
}

it('devuelve source_id en GET /mileage y en el informe del vehículo', function () {
    $w = sourcesWorld();

    $list = $this->getJson("{$w->v}/mileage")->assertOk()->json('data');
    $report = $this->getJson("{$w->v}/report")->assertOk()->json('data.mileage_logs');

    expect($list)->toHaveCount(6)->and($report)->toHaveCount(6);
    foreach ([...$list, ...$report] as $log) {
        expect($log)->toHaveKey('source_id');
    }
});

it('el propietario recibe el id del origen en los cinco orígenes, y null en la lectura manual', function () {
    $w = sourcesWorld();
    $expected = collect($w->ids)->sortKeys()->all();

    expect(sourceIds($this->getJson("{$w->v}/mileage")->assertOk()->json('data')))->toBe($expected)
        ->and(sourceIds($this->getJson("{$w->v}/report")->assertOk()->json('data.mileage_logs')))->toBe($expected);

    // Cada source_id apunta a un registro real del mismo vehículo.
    $vehicleId = $w->vehicle['id'];
    expect(\App\Models\MaintenanceRecord::find($w->ids['maintenance'])->vehicle_id)->toBe($vehicleId)
        ->and(\App\Models\Expense::find($w->ids['expense'])->vehicle_id)->toBe($vehicleId)
        ->and(\App\Models\WorkOrder::find($w->ids['work_order'])->vehicle_id)->toBe($vehicleId)
        ->and(Reminder::find($w->ids['reminder'])->vehicle_id)->toBe($vehicleId);
});

it('el mecánico recibe null en las lecturas de gastos (y el resto igual); el gerente las ve', function () {
    $w = sourcesWorld();
    $hidden = collect($w->ids)->put('expense', null)->sortKeys()->all();

    loginAs($w->mechanic);
    $list = $this->getJson("{$w->v}/mileage")->assertOk()->json('data');
    expect(sourceIds($list))->toBe($hidden)
        ->and(collect($list)->firstWhere('source', 'expense'))->not->toBeNull() // la lectura llega, sin su origen
        ->and(sourceIds($this->getJson("{$w->v}/report")->assertOk()->json('data.mileage_logs')))->toBe($hidden);

    loginAs($w->manager);
    expect(sourceIds($this->getJson("{$w->v}/mileage")->assertOk()->json('data'))['expense'])->toBe($w->ids['expense']);
});

it('en un espacio personal el propietario ve el origen de sus gastos', function () {
    $user = makeUser();
    loginAs($user);
    $vehicle = makeVehicle($user->personalWorkspace());

    $expense = $this->postJson("/api/v1/vehicles/{$vehicle->id}/expenses", [
        'category' => 'fuel', 'amount' => '50.00', 'expense_date' => day(), 'mileage' => 20000,
    ])->assertCreated()->json('data.id');

    $this->getJson("/api/v1/vehicles/{$vehicle->id}/mileage")
        ->assertOk()
        ->assertJsonPath('data.0.source', 'expense')
        ->assertJsonPath('data.0.source_id', $expense);
});

it('al borrar un recordatorio completado se borra su lectura y se recalcula el km actual', function () {
    $user = makeUser();
    loginAs($user);
    $vehicle = makeVehicle($user->personalWorkspace());
    addReading($vehicle, 1000, day(-10));
    $r = $this->postJson("/api/v1/vehicles/{$vehicle->id}/reminders", ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 2000])->json('data.id');
    $this->postJson("/api/v1/reminders/{$r}/complete", ['completed_at' => day(-1), 'mileage' => 1500, 'create_next' => false])->assertOk();
    expect($vehicle->fresh()->current_mileage)->toBe(1500)
        ->and($vehicle->mileageLogs()->where('source', 'reminder')->where('source_id', $r)->exists())->toBeTrue();

    $this->deleteJson("/api/v1/reminders/{$r}")->assertNoContent();

    $vehicle->refresh();
    expect(Reminder::find($r))->toBeNull()
        ->and($vehicle->mileageLogs()->where('source', 'reminder')->exists())->toBeFalse()
        ->and($vehicle->mileageLogs()->count())->toBe(1)
        ->and($vehicle->current_mileage)->toBe(1000)
        ->and($vehicle->mileage_updated_at->toDateString())->toBe(day(-10));
});

it('borrar un recordatorio sin km no toca las lecturas', function () {
    $user = makeUser();
    loginAs($user);
    $vehicle = makeVehicle($user->personalWorkspace());
    addReading($vehicle, 1000, day(-10));
    $r = app(ReminderService::class)->create($vehicle, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(10)]);
    app(ReminderService::class)->complete($r, ['completed_at' => day(), 'create_next' => false]);

    $this->deleteJson("/api/v1/reminders/{$r->id}")->assertNoContent();

    expect($vehicle->mileageLogs()->count())->toBe(1)
        ->and($vehicle->fresh()->current_mileage)->toBe(1000);
});

it('la migración de datos convierte las lecturas huérfanas de recordatorios en manuales con su nota', function () {
    $user = makeUser();
    loginAs($user);
    $vehicle = makeVehicle($user->personalWorkspace());
    addReading($vehicle, 1000, day(-20));
    $service = app(ReminderService::class);

    // Huérfana: el recordatorio se borró antes de este cambio, sin pasar por el servicio.
    $gone = $service->create($vehicle, ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 5000]);
    $service->complete($gone, ['completed_at' => day(-5), 'mileage' => 1800, 'create_next' => false]);
    Reminder::query()->whereKey($gone->id)->delete();
    // Sana: su recordatorio sigue existiendo.
    $kept = $service->create($vehicle, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(10)]);
    $service->complete($kept, ['completed_at' => day(-1), 'mileage' => 2000, 'create_next' => false]);
    $vehicle->refresh();
    $before = [$vehicle->current_mileage, $vehicle->mileage_updated_at->toDateString()];

    $migration = require database_path('migrations/2026_10_26_000001_repair_orphan_reminder_mileage_logs.php');
    $migration->up();

    $orphan = MileageLog::query()->where('vehicle_id', $vehicle->id)->where('mileage', 1800)->sole();
    $healthy = MileageLog::query()->where('vehicle_id', $vehicle->id)->where('mileage', 2000)->sole();
    expect($orphan->source)->toBe(MileageSource::Manual)
        ->and($orphan->source_id)->toBeNull()
        ->and($orphan->note)->toBe('Recordatorio eliminado')
        ->and($healthy->source)->toBe(MileageSource::Reminder)
        ->and($healthy->source_id)->toBe($kept->id)
        ->and($healthy->note)->toBeNull();

    // No cambia ningún km y la antigua huérfana ya se puede borrar como cualquier lectura manual.
    $vehicle->refresh();
    expect([$vehicle->current_mileage, $vehicle->mileage_updated_at->toDateString()])->toBe($before);
    $this->deleteJson("/api/v1/mileage/{$orphan->id}")->assertNoContent();

    // Volver a ejecutarla no cambia nada más.
    $migration->up();
    expect($healthy->fresh()->source)->toBe(MileageSource::Reminder);
});

it('la lectura de alta apunta al propio vehículo, la manual no tiene origen y cada vehículo solo lista las suyas', function () {
    $user = makeUser();
    loginAs($user);
    $a = makeVehicle($user->personalWorkspace());
    $b = makeVehicle($user->personalWorkspace());
    app(MileageService::class)->record($a, 500, day(-3), MileageSource::VehicleCreated, $a->id);
    $this->postJson("/api/v1/vehicles/{$a->id}/mileage", ['recorded_at' => day(), 'mileage' => 600])->assertCreated();

    $logs = collect($this->getJson("/api/v1/vehicles/{$a->id}/mileage")->json('data'))->keyBy('source');
    expect($logs['vehicle_created']['source_id'])->toBe($a->id)
        ->and($logs['manual']['source_id'])->toBeNull()
        ->and($this->getJson("/api/v1/vehicles/{$b->id}/mileage")->json('data'))->toBe([]);
});
