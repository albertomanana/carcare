<?php

use App\Models\Reminder;
use Carbon\CarbonImmutable;

/*
 * Recordatorios (contrato §3.7): estado calculado al serializar, progreso según los intervalos
 * del usuario, zona por defecto según el tipo y recurrencia al completar.
 */

beforeEach(function () {
    $this->user = makeUser();
    loginAs($this->user);
    $this->ws = $this->user->personalWorkspace();
    $this->vehicle = makeVehicle($this->ws);
    addReading($this->vehicle, 50000, day());
    $this->base = "/api/v1/vehicles/{$this->vehicle->id}/reminders";
});

it('calcula overdue, soon, ok y unknown', function () {
    $this->postJson($this->base, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(-3)])
        ->assertCreated()->assertJsonPath('data.state', 'overdue')->assertJsonPath('data.days_left', -3);
    $this->postJson($this->base, ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 50800])
        ->assertCreated()->assertJsonPath('data.state', 'soon')->assertJsonPath('data.km_left', 800);
    $this->postJson($this->base, ['title' => 'Seguro', 'kind' => 'insurance', 'due_date' => day(30)])
        ->assertCreated()->assertJsonPath('data.state', 'soon');
    $this->postJson($this->base, ['title' => 'Impuesto', 'kind' => 'tax', 'due_date' => day(31)])
        ->assertCreated()->assertJsonPath('data.state', 'ok');
    $this->postJson($this->base, ['title' => 'Correa', 'kind' => 'timing_belt', 'due_mileage' => 49000, 'due_date' => day(200)])
        ->assertCreated()->assertJsonPath('data.state', 'overdue')->assertJsonPath('data.km_left', -1000);

    $sinKm = makeVehicle($this->ws, ['make' => 'Sin', 'model' => 'Km']);
    $this->postJson("/api/v1/vehicles/{$sinKm->id}/reminders", ['title' => 'Revisión', 'kind' => 'service', 'due_mileage' => 10000])
        ->assertCreated()->assertJsonPath('data.state', 'unknown')->assertJsonPath('data.km_left', null);
});

it('ordena por urgencia: overdue, soon, ok', function () {
    $this->postJson($this->base, ['title' => 'OK', 'kind' => 'tax', 'due_date' => day(200)]);
    $this->postJson($this->base, ['title' => 'Vencido', 'kind' => 'itv', 'due_date' => day(-1)]);
    $this->postJson($this->base, ['title' => 'Próximo', 'kind' => 'insurance', 'due_date' => day(10)]);

    $this->getJson($this->base)->assertOk()
        ->assertJsonPath('data.0.title', 'Vencido')
        ->assertJsonPath('data.1.title', 'Próximo')
        ->assertJsonPath('data.2.title', 'OK')
        ->assertJsonMissingPath('data.0.vehicle');
});

it('asigna la zona por defecto según el tipo', function (string $kind, string $zone) {
    $this->postJson($this->base, ['title' => 'Algo', 'kind' => $kind, 'due_date' => day(60)])->assertCreated()->assertJsonPath('data.zone', $zone);
})->with([
    ['oil', 'engine'], ['timing_belt', 'engine'], ['tyres', 'tyres'], ['brakes', 'brakes'], ['battery', 'electrical'],
    ['itv', 'general'], ['insurance', 'general'], ['tax', 'general'], ['service', 'general'], ['custom', 'general'],
]);

it('calcula el progreso con fechas y km (el mayor de ambos)', function () {
    Reminder::create([
        'vehicle_id' => $this->vehicle->id, 'title' => 'Aceite', 'kind' => 'oil', 'zone' => 'engine', 'status' => 'pending',
        'starts_on' => day(-50), 'due_date' => day(50), 'start_mileage' => 40000, 'due_mileage' => 55000,
    ]);

    // Fecha: 50/100 = 0,5 · km: 10.000/15.000 = 0,6667 ⇒ 0,6667
    $this->getJson($this->base)->assertJsonPath('data.0.progress', 0.6667)->assertJsonPath('data.0.state', 'ok');
});

it('exige fecha o km límite', function () {
    $this->postJson($this->base, ['title' => 'Sin límite', 'kind' => 'custom'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.due_date.0', 'Indica una fecha límite o un kilometraje límite.');

    $id = $this->postJson($this->base, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(10)])->json('data.id');
    $this->patchJson("/api/v1/reminders/{$id}", ['due_date' => null])->assertUnprocessable()->assertJsonValidationErrors('due_date');
});

it('al completar con recurrencia crea el siguiente desde la fecha y el km de realización', function () {
    $id = $this->postJson($this->base, [
        'title' => 'Cambio de aceite', 'kind' => 'oil', 'due_date' => day(5), 'due_mileage' => 50500,
        'recurrence_months' => 12, 'recurrence_km' => 15000,
    ])->json('data.id');

    $response = $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => day(), 'mileage' => 50300])->assertOk();

    $response->assertJsonPath('data.completed.status', 'done')
        ->assertJsonPath('data.completed.completed_at', day())
        ->assertJsonPath('data.completed.completed_mileage', 50300)
        ->assertJsonPath('data.completed.state', null)
        ->assertJsonPath('data.next.status', 'pending')
        ->assertJsonPath('data.next.starts_on', day())
        ->assertJsonPath('data.next.start_mileage', 50300)
        ->assertJsonPath('data.next.due_date', today()->addMonthsNoOverflow(12)->toDateString())
        ->assertJsonPath('data.next.due_mileage', 65300)
        ->assertJsonPath('data.next.recurrence_km', 15000);

    expect($this->vehicle->mileageLogs()->where('source', 'reminder')->value('mileage'))->toBe(50300);

    // Ya no está pendiente: completarlo otra vez es un conflicto.
    $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => day()])->assertStatus(409);
    $this->getJson("{$this->base}?status=done")->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}?status=all")->assertJsonCount(2, 'data');
});

it('no crea el siguiente si create_next es false o no hay recurrencia', function () {
    $a = $this->postJson($this->base, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(5), 'recurrence_months' => 24])->json('data.id');
    $b = $this->postJson($this->base, ['title' => 'Única', 'kind' => 'custom', 'due_date' => day(5)])->json('data.id');

    $this->postJson("/api/v1/reminders/{$a}/complete", ['completed_at' => day(), 'create_next' => false])->assertOk()->assertJsonPath('data.next', null);
    $this->postJson("/api/v1/reminders/{$b}/complete", ['completed_at' => day()])->assertOk()->assertJsonPath('data.next', null);
});

it('descarta, edita y borra', function () {
    $id = $this->postJson($this->base, ['title' => 'Escobillas', 'kind' => 'custom', 'due_date' => day(5)])->json('data.id');

    $this->patchJson("/api/v1/reminders/{$id}", ['kind' => 'battery'])->assertOk()->assertJsonPath('data.zone', 'electrical');
    $this->postJson("/api/v1/reminders/{$id}/dismiss")->assertOk()->assertJsonPath('data.status', 'dismissed')->assertJsonPath('data.state', null);
    $this->getJson($this->base)->assertJsonCount(0, 'data');
    $this->getJson("{$this->base}?status=dismissed")->assertJsonCount(1, 'data');
    $this->deleteJson("/api/v1/reminders/{$id}")->assertNoContent();
});

it('la agenda del espacio incluye el vehículo, solo pendientes y filtra por estado', function () {
    $this->postJson($this->base, ['title' => 'Vencido', 'kind' => 'itv', 'due_date' => day(-1)]);
    $this->postJson($this->base, ['title' => 'Al día', 'kind' => 'tax', 'due_date' => day(100)]);
    $done = $this->postJson($this->base, ['title' => 'Hecho', 'kind' => 'custom', 'due_date' => day(3)])->json('data.id');
    $this->postJson("/api/v1/reminders/{$done}/complete", ['completed_at' => day()]);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/reminders")
        ->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('data.0.title', 'Vencido')
        ->assertJsonPath('data.0.vehicle.id', $this->vehicle->id)
        ->assertJsonPath('data.0.vehicle.display_name', 'Seat Ibiza');

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/reminders?state=ok")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.title', 'Al día');
});

it('el progreso pasa de 1 si está vencido y es null si no hay intervalo calculable', function () {
    Reminder::create([
        'vehicle_id' => $this->vehicle->id, 'title' => 'ITV', 'kind' => 'itv', 'zone' => 'general', 'status' => 'pending',
        'starts_on' => day(-100), 'due_date' => day(-10),
    ]);
    // 100 días transcurridos de 90 ⇒ 1,1111
    $this->getJson($this->base)->assertJsonPath('data.0.progress', 1.1111)->assertJsonPath('data.0.state', 'overdue');

    $sinKm = makeVehicle($this->ws, ['make' => 'Sin', 'model' => 'Km']);
    $this->postJson("/api/v1/vehicles/{$sinKm->id}/reminders", ['title' => 'Revisión', 'kind' => 'service', 'due_mileage' => 10000])
        ->assertCreated()
        ->assertJsonPath('data.start_mileage', null)
        ->assertJsonPath('data.progress', null);
});

it('la recurrencia mensual no se desborda a final de mes (31/01 + 1 mes = 28/02)', function () {
    $this->travelTo(CarbonImmutable::parse('2027-01-31 10:00'));
    $id = $this->postJson($this->base, ['title' => 'Lavado', 'kind' => 'custom', 'due_date' => '2027-02-05', 'recurrence_months' => 1])->json('data.id');

    $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => '2027-01-31'])
        ->assertOk()
        ->assertJsonPath('data.next.starts_on', '2027-01-31')
        ->assertJsonPath('data.next.due_date', '2027-02-28');
});

it('si se completa sin km, el siguiente por km parte del km actual del vehículo', function () {
    $id = $this->postJson($this->base, ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 50500, 'recurrence_km' => 15000])->json('data.id');

    $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => day()])
        ->assertOk()
        ->assertJsonPath('data.completed.completed_mileage', null)
        ->assertJsonPath('data.next.start_mileage', 50000)
        ->assertJsonPath('data.next.due_mileage', 65000)
        ->assertJsonPath('data.next.due_date', null);
});

it('completar con un km menor que el actual exige confirmación (regla de kilometraje)', function () {
    $id = $this->postJson($this->base, ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 50500])->json('data.id');

    $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => day(), 'mileage' => 49000])
        ->assertUnprocessable()->assertJsonValidationErrors('mileage');
    expect(Reminder::find($id)->status->value)->toBe('pending');

    $this->postJson("/api/v1/reminders/{$id}/complete", ['completed_at' => day(), 'mileage' => 49000, 'confirm_mileage_drop' => true])->assertOk();
});
