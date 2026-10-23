<?php

use App\Enums\MileageSource;

/*
 * Regla de kilometraje (contrato §3.4): km actual = lectura más reciente por fecha (desempate: mayor km);
 * retroceso respecto a lecturas anteriores (o salto sobre posteriores) ⇒ 422 salvo confirm_mileage_drop.
 */

beforeEach(function () {
    $this->user = makeUser();
    loginAs($this->user);
    $this->vehicle = makeVehicle($this->user->personalWorkspace());
});

it('registra lecturas y actualiza el km actual', function () {
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-20), 'mileage' => 10000, 'note' => 'ITV'])
        ->assertCreated()
        ->assertJsonPath('data.source', 'manual')
        ->assertJsonPath('data.note', 'ITV')
        ->assertJsonPath('data.recorded_at', day(-20));

    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-5), 'mileage' => 10450])->assertCreated();

    expect($this->vehicle->fresh())
        ->current_mileage->toBe(10450)
        ->mileage_updated_at->toDateString()->toBe(day(-5));

    $this->getJson("/api/v1/vehicles/{$this->vehicle->id}/mileage")
        ->assertOk()
        ->assertJsonPath('data.0.mileage', 10450)
        ->assertJsonPath('data.1.mileage', 10000)
        ->assertJsonPath('meta.total', 2);
});

it('rechaza un retroceso de km con el mensaje del contrato salvo confirmación', function () {
    addReading($this->vehicle, 84200, today()->subDays(30)->toDateString());
    $human = today()->subDays(30)->format('d/m/Y');

    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-1), 'mileage' => 84000])
        ->assertUnprocessable()
        ->assertJsonPath('errors.mileage.0', "El kilometraje no cuadra con lecturas anteriores (último: 84.200 km el {$human}). Confírmalo si es correcto.");

    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-1), 'mileage' => 84000, 'confirm_mileage_drop' => true])
        ->assertCreated();

    // El km actual es el de la lectura más reciente por fecha, aunque sea menor.
    expect($this->vehicle->fresh()->current_mileage)->toBe(84000);
});

it('rechaza una lectura antigua mayor que una posterior', function () {
    addReading($this->vehicle, 5000, day(-2));

    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-10), 'mileage' => 7000])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('mileage');
});

it('a igual fecha gana la lectura de mayor km', function () {
    addReading($this->vehicle, 1000, day(-1));
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(-1), 'mileage' => 1200])->assertCreated();

    expect($this->vehicle->fresh()->current_mileage)->toBe(1200);
});

it('lista por fecha descendente y, a igual fecha, por km descendente', function () {
    addReading($this->vehicle, 1000, day(-5));
    addReading($this->vehicle, 1300, day(-1));
    addReading($this->vehicle, 1200, day(-1));

    $this->getJson("/api/v1/vehicles/{$this->vehicle->id}/mileage")
        ->assertOk()
        ->assertJsonPath('data', fn ($logs) => array_column($logs, 'mileage') === [1300, 1200, 1000]);
    expect($this->vehicle->fresh()->current_mileage)->toBe(1300);
});

it('no admite fechas futuras ni km fuera de rango', function () {
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/mileage", ['recorded_at' => day(1), 'mileage' => -5])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['recorded_at', 'mileage'])
        ->assertJsonPath('errors.recorded_at.0', 'La fecha de la lectura no puede ser futura.');
});

it('borra solo lecturas manuales y recalcula el km actual', function () {
    addReading($this->vehicle, 1000, day(-10), MileageSource::VehicleCreated);
    addReading($this->vehicle, 1500, day(-1));
    $manual = $this->vehicle->mileageLogs()->where('source', 'manual')->first();
    $created = $this->vehicle->mileageLogs()->where('source', 'vehicle_created')->first();

    $this->deleteJson("/api/v1/mileage/{$created->id}")->assertStatus(409);
    $this->deleteJson("/api/v1/mileage/{$manual->id}")->assertNoContent();

    expect($this->vehicle->fresh()->current_mileage)->toBe(1000);
});

it('las intervenciones y gastos con km también crean lecturas', function () {
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/maintenance", [
        'type' => 'maintenance', 'zone' => 'engine', 'title' => 'Aceite', 'service_date' => day(-3), 'mileage' => 20000,
    ])->assertCreated();
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/expenses", [
        'category' => 'fuel', 'amount' => '50.00', 'expense_date' => day(-1), 'mileage' => 20300, 'fuel_quantity' => '30.00', 'full_tank' => true,
    ])->assertCreated();

    expect($this->vehicle->mileageLogs()->pluck('source')->map->value->all())->toEqualCanonicalizing(['maintenance', 'expense'])
        ->and($this->vehicle->fresh()->current_mileage)->toBe(20300);

    // Un gasto con km menor que la intervención anterior también se comprueba.
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/expenses", [
        'category' => 'parking', 'amount' => '3.00', 'expense_date' => day(), 'mileage' => 19000,
    ])->assertUnprocessable()->assertJsonValidationErrors('mileage');
});
