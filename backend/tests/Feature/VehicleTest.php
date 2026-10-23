<?php

use App\Models\Document;
use App\Models\Expense;
use App\Models\MaintenanceItem;
use App\Models\MaintenanceRecord;
use App\Models\MileageLog;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Services\ExpenseService;
use App\Services\MaintenanceService;
use App\Services\ReminderService;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->user = makeUser('Ana Dueña');
    $this->ws = $this->user->personalWorkspace();
    loginAs($this->user);
});

it('crea un vehículo con su primera lectura de km y normaliza la matrícula', function () {
    $response = $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", [
        'make' => 'Toyota', 'model' => 'Corolla', 'nickname' => 'El blanco', 'year' => 2020, 'fuel_type' => 'hybrid',
        'transmission' => 'automatic', 'body_type' => 'sedan', 'color_hex' => '#F5F5F4', 'plate' => '1234-abc ',
        'vin' => 'jtdbr32e720012345', 'current_mileage' => 45210, 'purchase_date' => '2020-05-02',
    ])->assertCreated();

    $response->assertJsonPath('data.plate', '1234ABC')
        ->assertJsonPath('data.vin', 'JTDBR32E720012345')
        ->assertJsonPath('data.display_name', 'El blanco')
        ->assertJsonPath('data.current_mileage', 45210)
        ->assertJsonPath('data.mileage_updated_at', day())
        ->assertJsonPath('data.customer', null)
        ->assertJsonPath('data.stats.records_count', 0)
        ->assertJsonPath('data.stats.open_work_order', null);

    $vehicle = Vehicle::findOrFail($response->json('data.id'));
    expect($vehicle->mileageLogs()->first()->source->value)->toBe('vehicle_created');
    $this->assertDatabaseHas('activities', ['action' => 'vehicle.created', 'entity_id' => $vehicle->id]);
});

it('devuelve la forma exacta de Vehicle', function () {
    $vehicle = makeVehicle($this->ws);

    $this->getJson("/api/v1/vehicles/{$vehicle->id}")->assertOk()->assertJsonStructure(['data' => [
        'id', 'workspace_id', 'customer', 'nickname', 'make', 'model', 'version', 'year', 'fuel_type', 'transmission',
        'engine', 'body_type', 'color_hex', 'plate', 'vin', 'purchase_date', 'purchase_mileage', 'current_mileage',
        'mileage_updated_at', 'display_name', 'archived_at', 'created_at', 'updated_at',
        'stats' => ['records_count', 'pending_reminders', 'overdue_reminders', 'soon_reminders', 'open_work_order'],
    ]])->assertJsonPath('data.display_name', 'Seat Ibiza');
});

it('edita sin tocar el kilometraje (se usa /mileage)', function () {
    $vehicle = makeVehicle($this->ws);
    addReading($vehicle, 1000, day(-1));

    $this->patchJson("/api/v1/vehicles/{$vehicle->id}", ['model' => 'León', 'current_mileage' => 5])
        ->assertOk()
        ->assertJsonPath('data.model', 'León')
        ->assertJsonPath('data.current_mileage', 1000);
});

it('valida los datos del vehículo', function () {
    makeVehicle($this->ws, ['plate' => '1234ABC']);

    $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", [
        'make' => '', 'model' => 'X', 'year' => 1850, 'color_hex' => 'rojo', 'plate' => '1234 abc',
        'vin' => 'CORTO', 'current_mileage' => 3000000, 'customer_id' => 1, 'body_type' => 'tanque',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['make', 'year', 'color_hex', 'plate', 'vin', 'current_mileage', 'customer_id', 'body_type'])
        ->assertJsonPath('errors.plate.0', 'Ya hay un vehículo activo con esa matrícula en este espacio.')
        ->assertJsonPath('errors.customer_id.0', 'Los vehículos de un espacio personal no tienen cliente.')
        ->assertJsonPath('errors.color_hex.0', 'El color debe tener el formato #RRGGBB.');
});

it('permite repetir matrícula si el otro vehículo está archivado', function () {
    makeVehicle($this->ws, ['plate' => '1234ABC', 'archived_at' => now()]);

    $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", ['make' => 'Seat', 'model' => 'Ibiza', 'plate' => '1234ABC'])
        ->assertCreated();
});

it('el VIN es único por espacio y la matrícula no choca consigo misma al editar', function () {
    $mine = makeVehicle($this->ws, ['plate' => '1234ABC', 'vin' => 'VSSZZZKJZKR000001']);

    $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", ['make' => 'Seat', 'model' => 'León', 'vin' => 'vsszzzkjzkr000001'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.vin.0', 'Ya hay un vehículo con ese número de bastidor en este espacio.');

    // Editar el propio vehículo con su misma matrícula y VIN no es un duplicado.
    $this->patchJson("/api/v1/vehicles/{$mine->id}", ['plate' => '1234-abc', 'vin' => 'VSSZZZKJZKR000001', 'nickname' => 'Mío'])
        ->assertOk()->assertJsonPath('data.plate', '1234ABC');

    // Otro espacio puede tener la misma matrícula y el mismo VIN.
    $other = makeUser('Otra Dueña');
    loginAs($other);
    $this->postJson("/api/v1/workspaces/{$other->personalWorkspace()->id}/vehicles", [
        'make' => 'Seat', 'model' => 'Ibiza', 'plate' => '1234ABC', 'vin' => 'VSSZZZKJZKR000001',
    ])->assertCreated();
});

it('archiva, restaura y solo borra vehículos archivados', function () {
    $vehicle = makeVehicle($this->ws);

    $this->deleteJson("/api/v1/vehicles/{$vehicle->id}")->assertStatus(409)
        ->assertExactJson(['message' => 'Archiva el vehículo antes de eliminarlo.']);

    $this->postJson("/api/v1/vehicles/{$vehicle->id}/archive")->assertOk()->assertJsonPath('data.archived_at', fn ($v) => $v !== null);
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles")->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?archived=1")->assertJsonCount(1, 'data');

    $this->postJson("/api/v1/vehicles/{$vehicle->id}/restore")->assertOk()->assertJsonPath('data.archived_at', null);
    $this->postJson("/api/v1/vehicles/{$vehicle->id}/archive")->assertOk();
    $this->deleteJson("/api/v1/vehicles/{$vehicle->id}")->assertNoContent();
    expect(Vehicle::find($vehicle->id))->toBeNull();
});

it('busca, ordena y pagina con el meta del contrato', function () {
    makeVehicle($this->ws, ['make' => 'Seat', 'model' => 'Ibiza', 'plate' => '1111AAA', 'current_mileage' => 50000]);
    makeVehicle($this->ws, ['make' => 'Kia', 'model' => 'Sportage', 'plate' => '2222BBB', 'current_mileage' => 90000]);
    makeVehicle($this->ws, ['make' => 'Audi', 'model' => 'A3', 'nickname' => 'Zeta', 'plate' => '3333CCC']);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?search=2222 bbb")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.model', 'Sportage');

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?sort=name")
        ->assertJsonPath('data.0.make', 'Kia')->assertJsonPath('data.2.nickname', 'Zeta');

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?sort=mileage")->assertJsonPath('data.0.model', 'Sportage');

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?per_page=2&page=2")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta', ['current_page' => 2, 'last_page' => 2, 'per_page' => 2, 'total' => 3])
        ->assertJsonMissingPath('links');
});

it('recorta per_page al máximo de 100', function () {
    makeVehicle($this->ws);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?per_page=500")->assertJsonPath('meta.per_page', 100);
});

it('al borrar un vehículo archivado elimina en cascada su historial y sus ficheros, y no toca los de otro', function () {
    Storage::fake('local');
    $vehicle = makeVehicle($this->ws, ['plate' => '1111AAA']);
    addReading($vehicle, 1000, day(-10));
    $record = app(MaintenanceService::class)->create($vehicle, [
        'type' => 'repair', 'zone' => 'engine', 'title' => 'Bujías', 'service_date' => day(-5), 'mileage' => 1100,
        'items' => [['kind' => 'part', 'name' => 'Bujía', 'quantity' => '4', 'unit_price' => '20.00']],
    ]);
    app(ExpenseService::class)->create($vehicle, ['category' => 'parking', 'amount' => '3.50', 'expense_date' => day(-1)]);
    app(ReminderService::class)->create($vehicle, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(60)]);
    $document = makeDocument($vehicle);
    $other = makeVehicle($this->ws, ['plate' => '2222BBB']);
    $kept = makeDocument($other);

    $this->postJson("/api/v1/vehicles/{$vehicle->id}/archive")->assertOk();
    $this->deleteJson("/api/v1/vehicles/{$vehicle->id}")->assertNoContent();

    expect(MileageLog::where('vehicle_id', $vehicle->id)->count())->toBe(0)
        ->and(MaintenanceRecord::where('vehicle_id', $vehicle->id)->count())->toBe(0)
        ->and(MaintenanceItem::where('maintenance_record_id', $record->id)->count())->toBe(0)
        ->and(Expense::where('vehicle_id', $vehicle->id)->count())->toBe(0)
        ->and(Reminder::where('vehicle_id', $vehicle->id)->count())->toBe(0)
        ->and(Document::where('vehicle_id', $vehicle->id)->count())->toBe(0)
        ->and(Document::find($kept->id))->not->toBeNull();
    Storage::disk('local')->assertMissing($document->path);
    Storage::disk('local')->assertExists($kept->path);
    // La auditoría se conserva (sin vínculo al vehículo borrado).
    $this->assertDatabaseHas('activities', ['action' => 'vehicle.deleted', 'entity_id' => $vehicle->id, 'vehicle_id' => null]);
});
