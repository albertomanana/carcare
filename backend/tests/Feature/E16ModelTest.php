<?php

use App\Enums\RepairQuoteStatus;
use App\Enums\RepairRequestStatus;
use App\Models\RepairQuote;
use App\Models\RepairRequest;
use Illuminate\Support\Facades\Schema;

/*
 * E16, bloque 1 (contrato §3.13, ADR‑0007): tablas, enums y modelos. Las reglas se prueban por la API en
 * DirectoryTest, RepairRequestTest, RepairQuoteTest y AppNotificationTest.
 */

/** Solicitud guardada directamente (sin la API) con la copia fija del coche de Lucía. */
function storedRequest(object $w, array $attributes = []): RepairRequest
{
    return RepairRequest::create(array_merge([
        'requester_workspace_id' => $w->pws->id, 'requester_user_id' => $w->client->id,
        'workshop_workspace_id' => $w->wws->id, 'vehicle_id' => $w->car->id, 'status' => 'pending',
        'vehicle_make' => 'Seat', 'vehicle_model' => 'Ibiza', 'vehicle_plate' => '1234ABC',
        'title' => 'Ruido al frenar', 'description' => 'Chirrían los frenos.', 'preferred_date' => day(2),
        'mileage' => 84500, 'share_history' => true,
    ], $attributes));
}

it('crea las tablas de E16 y la columna interna vehicles.source_vehicle_id', function () {
    foreach (['workshop_profiles', 'repair_requests', 'repair_quotes', 'notifications'] as $table) {
        expect(Schema::hasTable($table))->toBeTrue("Falta la tabla {$table}");
    }
    expect(Schema::hasColumn('vehicles', 'source_vehicle_id'))->toBeTrue();
});

it('source_vehicle_id no sale en el JSON del vehículo', function () {
    $w = e16World();
    $copy = makeVehicle($w->wws, ['plate' => '1234ABC']);
    $copy->forceFill(['source_vehicle_id' => $w->car->id])->save();
    loginAs($w->owner);

    $json = $this->getJson("/api/v1/vehicles/{$copy->id}")->assertOk()->json('data');
    expect($json)->not->toHaveKey('source_vehicle_id');
});

it('la copia fija da el nombre "marca modelo (matrícula)" sin el apodo', function () {
    $w = e16World();
    $request = storedRequest($w);

    expect($request->vehicleName())->toBe('Seat Ibiza')
        ->and($request->vehicleLabel())->toBe('Seat Ibiza (1234ABC)')
        ->and(storedRequest($w, ['vehicle_plate' => null, 'status' => 'rejected'])->vehicleLabel())->toBe('Seat Ibiza');
});

it('history_available exige consentimiento, solicitud abierta y coche sin borrar', function () {
    $w = e16World();

    expect(storedRequest($w)->historyAvailable())->toBeTrue()
        ->and(storedRequest($w, ['share_history' => false])->historyAvailable())->toBeFalse()
        ->and(storedRequest($w, ['status' => 'converted'])->historyAvailable())->toBeFalse()
        ->and(storedRequest($w, ['vehicle_id' => null])->historyAvailable())->toBeFalse()
        ->and(RepairRequestStatus::openValues())->toBe(['pending', 'accepted', 'quoted']);
});

it('un presupuesto caduca al día siguiente de valid_until y solo si está vigente', function () {
    $w = e16World();
    $request = storedRequest($w, ['status' => 'quoted']);
    $quote = fn (string $validUntil, string $status = 'sent') => new RepairQuote([
        'repair_request_id' => $request->id, 'version' => 1, 'status' => $status, 'items' => [],
        'valid_days' => 15, 'valid_until' => $validUntil,
    ]);

    expect($quote(day())->isExpired())->toBeFalse()
        ->and($quote(day(-1))->isExpired())->toBeTrue()
        ->and($quote(day(-1), RepairQuoteStatus::Rejected->value)->isExpired())->toBeFalse();
});

it('los avisos del taller van al owner y a los managers, no al mecánico', function () {
    $w = e16World();

    expect($w->wws->managers()->pluck('users.id')->sort()->values()->all())
        ->toBe(collect([$w->owner->id, $w->manager->id])->sort()->values()->all());
});
