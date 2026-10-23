<?php

use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\WorkOrder;
use Carbon\CarbonImmutable;

/*
 * Órdenes de trabajo (contrato §3.11): numeración OT-AAAA-NNNN, totales con IVA, elevadores con
 * una sola orden abierta (409), estados finales de solo lectura y entrega ⇒ intervención.
 */

beforeEach(function () {
    $this->owner = makeUser('Dueña Taller', 'Taller Prueba');
    loginAs($this->owner);
    $this->ws = workshopOf($this->owner);
    $this->customer = $this->ws->customers()->create(['name' => 'Cliente Prueba', 'phone' => '600 000 001']);
    $this->vehicle = makeVehicle($this->ws, ['customer_id' => $this->customer->id, 'plate' => '1234ABC']);
    $this->base = "/api/v1/workspaces/{$this->ws->id}/work-orders";
});

function order(int $vehicleId, array $overrides = []): array
{
    return array_merge([
        'vehicle_id' => $vehicleId, 'title' => 'Cambio de embrague', 'complaint' => 'Patina en cuesta', 'priority' => 'high',
        'mileage_in' => 120500, 'promised_at' => now()->addDay()->toIso8601String(),
        'items' => [
            ['kind' => 'part', 'name' => 'Kit embrague', 'part_number' => 'KE-1', 'quantity' => '2', 'unit_price' => '10.00'],
            ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1', 'unit_price' => '33.33'],
        ],
    ], $overrides);
}

it('crea una orden recibida, numerada, con cliente del vehículo y totales con IVA', function () {
    $response = $this->postJson($this->base, order($this->vehicle->id))->assertCreated();
    $year = now()->year;

    $response->assertJsonPath('data.number', "OT-{$year}-0001")
        ->assertJsonPath('data.status', 'received')
        ->assertJsonPath('data.customer.id', $this->customer->id)
        ->assertJsonPath('data.vehicle.plate', '1234ABC')
        ->assertJsonPath('data.subtotal', '53.33')
        ->assertJsonPath('data.tax_rate', '21.00')
        ->assertJsonPath('data.tax_amount', '11.20')
        ->assertJsonPath('data.total', '64.53')
        ->assertJsonPath('data.is_late', false)
        ->assertJsonPath('data.items.1.total', '33.33');

    expect($this->vehicle->fresh()->current_mileage)->toBe(120500)
        ->and($this->vehicle->mileageLogs()->value('source')->value)->toBe('work_order');

    $this->postJson($this->base, order($this->vehicle->id))->assertCreated()->assertJsonPath('data.number', "OT-{$year}-0002");

    // Cada espacio tiene su propia numeración.
    $other = makeUser('Otro', 'Otro Taller');
    loginAs($other);
    $v = makeVehicle(workshopOf($other));
    $this->postJson('/api/v1/workspaces/'.workshopOf($other)->id.'/work-orders', order($v->id))->assertJsonPath('data.number', "OT-{$year}-0001");
});

it('aplica el IVA indicado o el del espacio', function () {
    $this->patchJson("/api/v1/workspaces/{$this->ws->id}", ['settings' => ['tax_rate' => 10]])->assertOk()->assertJsonPath('data.settings.tax_rate', '10.00');

    $this->postJson($this->base, order($this->vehicle->id))->assertJsonPath('data.tax_rate', '10.00')->assertJsonPath('data.tax_amount', '5.33');
    $this->postJson($this->base, order($this->vehicle->id, ['tax_rate' => '0']))->assertJsonPath('data.total', '53.33');
});

it('un elevador solo admite una orden abierta (409)', function () {
    $first = $this->postJson($this->base, order($this->vehicle->id, ['bay' => 2]))->assertCreated();
    $number = $first->json('data.number');
    $other = makeVehicle($this->ws, ['plate' => '9999ZZZ']);

    $this->postJson($this->base, order($other->id, ['bay' => 2]))
        ->assertStatus(409)
        ->assertExactJson(['message' => "El elevador 2 está ocupado por {$number}"]);

    $second = $this->postJson($this->base, order($other->id))->json('data.id');
    $this->postJson("/api/v1/work-orders/{$second}/status", ['status' => 'in_progress', 'bay' => 2])->assertStatus(409);

    // Pasar a «Listo» libera el elevador.
    $this->postJson("/api/v1/work-orders/{$first->json('data.id')}/status", ['status' => 'ready'])
        ->assertOk()->assertJsonPath('data.bay', null)->assertJsonPath('data.completed_at', fn ($v) => $v !== null);
    $this->postJson("/api/v1/work-orders/{$second}/status", ['status' => 'in_progress', 'bay' => 2])->assertOk()->assertJsonPath('data.bay', 2);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/bays")
        ->assertOk()
        ->assertJsonCount(4, 'data')
        ->assertJsonPath('data.1.number', 2)
        ->assertJsonPath('data.1.work_order.id', $second)
        ->assertJsonPath('data.0.work_order', null);
});

it('al pasar a listo puede quedarse en el elevador indicado; un estado final nunca ocupa elevador', function () {
    $id = $this->postJson($this->base, order($this->vehicle->id, ['bay' => 3]))->assertCreated()->json('data.id');

    // «Listo» con elevador indicado: sigue ocupándolo (la orden sigue abierta).
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'ready', 'bay' => 3])
        ->assertOk()->assertJsonPath('data.bay', 3)->assertJsonPath('data.completed_at', fn ($v) => $v !== null);
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/bays")->assertJsonPath('data.2.work_order.id', $id);

    // Mover de elevador sin cambiar de estado.
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'ready', 'bay' => 4])->assertOk()->assertJsonPath('data.bay', 4);
    $this->assertDatabaseHas('activities', ['action' => 'work_order.updated', 'entity_id' => $id]);

    // Cancelar libera el elevador aunque se indique uno.
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'cancelled', 'bay' => 4])->assertOk()->assertJsonPath('data.bay', null);
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/bays")->assertJsonPath('data', fn ($bays) => collect($bays)->every(fn ($b) => $b['work_order'] === null));
});

it('mileage_in menor que el km actual se acepta en el taller y la orden mantiene una sola lectura', function () {
    addReading($this->vehicle, 150000, day(-3));

    // Sin confirm_mileage_drop: en talleres se acepta y se registra igualmente (contrato §3.11).
    $id = $this->postJson($this->base, order($this->vehicle->id, ['mileage_in' => 149000]))->assertCreated()->json('data.id');
    $logs = fn () => $this->vehicle->mileageLogs()->where('source', 'work_order')->where('source_id', $id);
    expect($logs()->sole()->mileage)->toBe(149000)
        ->and($logs()->sole()->recorded_at->toDateString())->toBe(day())
        ->and($this->vehicle->fresh()->current_mileage)->toBe(149000); // lectura más reciente por fecha

    // Editar mileage_in actualiza la misma lectura (no crea otra).
    $this->patchJson("/api/v1/work-orders/{$id}", ['mileage_in' => 150500])->assertOk()->assertJsonPath('data.mileage_in', 150500);
    expect($logs()->count())->toBe(1)
        ->and($this->vehicle->fresh()->current_mileage)->toBe(150500);

    // Borrar la orden (recibida) elimina su lectura y recalcula el km actual.
    $this->deleteJson("/api/v1/work-orders/{$id}")->assertNoContent();
    expect($logs()->count())->toBe(0)
        ->and($this->vehicle->fresh()->current_mileage)->toBe(150000);
});

it('valida el elevador, el vehículo y la persona asignada', function () {
    $foreign = makeVehicle(makeUser()->personalWorkspace());
    $stranger = makeUser('Desconocido');

    $this->postJson($this->base, order($foreign->id, ['bay' => 9, 'assigned_to' => $stranger->id, 'title' => '']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['vehicle_id', 'bay', 'assigned_to', 'title'])
        ->assertJsonPath('errors.bay.0', 'El elevador debe estar entre 1 y 4.')
        ->assertJsonPath('errors.assigned_to.0', 'La persona asignada no es miembro de este taller.');
});

it('al entregar crea la intervención en el historial y la orden queda en solo lectura', function () {
    $id = $this->postJson($this->base, order($this->vehicle->id, ['diagnosis' => 'Disco gastado', 'bay' => 1]))->json('data.id');

    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'delivered'])
        ->assertOk()
        ->assertJsonPath('data.status', 'delivered')
        ->assertJsonPath('data.bay', null)
        ->assertJsonPath('data.delivered_at', fn ($v) => $v !== null)
        ->assertJsonPath('data.maintenance_record_id', fn ($v) => $v !== null);

    $order = WorkOrder::findOrFail($id);
    $record = MaintenanceRecord::findOrFail($order->maintenance_record_id);
    expect($record)
        ->type->value->toBe('repair')
        ->zone->value->toBe('general')
        ->title->toBe('Cambio de embrague')
        ->description->toBe('Disco gastado')
        ->mileage->toBe(120500)
        ->workshop_name->toBe('Taller Prueba')
        ->total_cost->toBe('64.53')
        ->and($record->service_date->toDateString())->toBe(today()->toDateString())
        ->and($record->items)->toHaveCount(2)
        ->and(Expense::count())->toBe(0); // en talleres no hay gasto vinculado

    $this->getJson("/api/v1/maintenance/{$record->id}")->assertJsonPath('data.work_order_id', $id);

    $this->patchJson("/api/v1/work-orders/{$id}", ['title' => 'Otro'])
        ->assertStatus(409)->assertJsonPath('message', "La orden {$order->number} está entregada y ya no admite cambios.");
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'in_progress'])->assertStatus(409);
    $this->deleteJson("/api/v1/work-orders/{$id}")->assertStatus(409);
});

it('los estados intermedios se mueven libremente y ready fija completed_at', function () {
    $id = $this->postJson($this->base, order($this->vehicle->id))->json('data.id');

    foreach (['in_progress', 'diagnosing', 'waiting_parts', 'received'] as $status) {
        $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => $status])->assertOk()->assertJsonPath('data.status', $status);
    }
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'ready'])->assertJsonPath('data.completed_at', fn ($v) => $v !== null);
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'in_progress'])->assertJsonPath('data.completed_at', null);
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'volando'])->assertUnprocessable();

    $this->assertDatabaseHas('activities', ['action' => 'work_order.status_changed', 'entity_id' => $id]);
});

it('marca como tarde las órdenes con fecha prometida pasada', function () {
    $id = $this->postJson($this->base, order($this->vehicle->id, ['promised_at' => now()->subHour()->toIso8601String()]))
        ->assertJsonPath('data.is_late', true)->json('data.id');

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/dashboard")->assertJsonPath('data.counts.late_orders', 1)->assertJsonPath('data.late.0.id', $id);
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'ready'])->assertJsonPath('data.is_late', false);
});

it('edita líneas y recalcula totales; solo borra recibidas o canceladas', function () {
    $id = $this->postJson($this->base, order($this->vehicle->id))->json('data.id');

    $this->patchJson("/api/v1/work-orders/{$id}", ['items' => [['kind' => 'labor', 'name' => 'Diagnosis', 'quantity' => '1', 'unit_price' => '35.00']]])
        ->assertOk()->assertJsonPath('data.subtotal', '35.00')->assertJsonPath('data.total', '42.35');

    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'in_progress']);
    $this->deleteJson("/api/v1/work-orders/{$id}")->assertStatus(409);
    $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'cancelled'])->assertOk();
    $this->deleteJson("/api/v1/work-orders/{$id}")->assertNoContent();
});

it('filtra el listado (open, estados, búsqueda) y admite per_page 200', function () {
    $a = $this->postJson($this->base, order($this->vehicle->id))->json('data.id');
    $other = makeVehicle($this->ws, ['plate' => '5555XYZ']);
    $b = $this->postJson($this->base, order($other->id, ['title' => 'Revisión']))->json('data.id');
    $this->postJson("/api/v1/work-orders/{$b}/status", ['status' => 'cancelled']);

    $this->getJson("{$this->base}?status=open")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $a);
    $this->getJson("{$this->base}?status=cancelled,delivered")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b);
    $this->getJson("{$this->base}?search=5555 xyz")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b);
    $this->getJson("{$this->base}?search=Cliente Prueba")->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}?per_page=200")->assertJsonPath('meta.per_page', 200);
    $this->getJson("{$this->base}?status=open,fantasma")->assertUnprocessable();
});

it('gestiona clientes y no borra los que tienen órdenes abiertas', function () {
    $this->postJson("/api/v1/workspaces/{$this->ws->id}/customers", ['name' => 'Nueva Cliente', 'email' => 'NUEVA@ejemplo.test'])
        ->assertCreated()->assertJsonPath('data.email', 'nueva@ejemplo.test')->assertJsonPath('data.vehicles_count', 0);

    $this->postJson($this->base, order($this->vehicle->id));
    $this->getJson("/api/v1/customers/{$this->customer->id}")->assertJsonPath('data.vehicles_count', 1)->assertJsonPath('data.open_orders_count', 1);
    $this->getJson("/api/v1/customers/{$this->customer->id}/vehicles")->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/customers?search=nueva")->assertJsonCount(1, 'data');

    $this->deleteJson("/api/v1/customers/{$this->customer->id}")
        ->assertStatus(409)->assertExactJson(['message' => 'No se puede eliminar un cliente con órdenes de trabajo abiertas.']);

    $orderId = WorkOrder::first()->id;
    $this->postJson("/api/v1/work-orders/{$orderId}/status", ['status' => 'cancelled']);
    $this->deleteJson("/api/v1/customers/{$this->customer->id}")->assertNoContent();
    expect($this->vehicle->fresh()->customer_id)->toBeNull();
});

it('valida que el cliente del vehículo sea del mismo taller', function () {
    $otherWs = workshopOf(makeUser('Ajeno', 'Taller Ajeno'));
    $foreignCustomer = $otherWs->customers()->create(['name' => 'Cliente Ajeno']);

    $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", ['make' => 'Ford', 'model' => 'Transit', 'customer_id' => $foreignCustomer->id])
        ->assertUnprocessable()->assertJsonPath('errors.customer_id.0', 'El cliente no existe en este taller.');

    $this->postJson("/api/v1/workspaces/{$this->ws->id}/vehicles", ['make' => 'Ford', 'model' => 'Transit', 'customer_id' => $this->customer->id])
        ->assertCreated()->assertJsonPath('data.customer.name', 'Cliente Prueba');
});

it('numera sin huecos: una creación rechazada no consume número y cada año empieza en 0001', function () {
    $this->travelTo(CarbonImmutable::parse('2026-12-31 18:00'));
    $other = makeVehicle($this->ws, ['plate' => '7777HHH']);

    $this->postJson($this->base, order($this->vehicle->id, ['bay' => 1]))->assertCreated()->assertJsonPath('data.number', 'OT-2026-0001');
    $this->postJson($this->base, order($other->id, ['bay' => 1]))->assertStatus(409);      // elevador ocupado: se deshace la transacción
    $this->postJson($this->base, order($other->id, ['title' => '']))->assertUnprocessable(); // validación: ni llega al servicio
    $this->postJson($this->base, order($other->id))->assertCreated()->assertJsonPath('data.number', 'OT-2026-0002');

    $this->travelTo(CarbonImmutable::parse('2027-01-01 09:00'));
    $this->postJson($this->base, order($other->id))->assertCreated()->assertJsonPath('data.number', 'OT-2027-0001');
    $this->postJson($this->base, order($this->vehicle->id))->assertCreated()->assertJsonPath('data.number', 'OT-2027-0002');

    expect(WorkOrder::orderBy('id')->pluck('number')->all())->toBe(['OT-2026-0001', 'OT-2026-0002', 'OT-2027-0001', 'OT-2027-0002']);
});

it('el centro de control cuenta órdenes por estado, retrasos, elevadores y alertas de flota', function () {
    $this->travelTo(today()->setTime(10, 0));
    $create = fn (array $overrides = []) => $this->postJson($this->base, order($this->vehicle->id, $overrides))->assertCreated()->json('data.id');
    $move = fn (int $id, string $status) => $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => $status])->assertOk();

    $forToday = $create(['bay' => 1, 'promised_at' => today()->setTime(18, 0)->toIso8601String()]);
    $late = $create(['promised_at' => now()->subDay()->toIso8601String()]);
    $move($late, 'in_progress');
    $move($create(), 'waiting_parts');
    $move($create(['promised_at' => now()->subDay()->toIso8601String()]), 'ready'); // listo: ya no cuenta como tarde
    $move($create(), 'delivered');
    $move($create(), 'cancelled');
    $this->postJson("/api/v1/vehicles/{$this->vehicle->id}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(-1)])->assertCreated();

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/dashboard")->assertOk()
        ->assertJsonPath('data.counts', ['vehicles' => 1, 'customers' => 1, 'open_orders' => 4, 'late_orders' => 1, 'overdue_reminders' => 1])
        ->assertJsonPath('data.orders_by_status', [
            'received' => 1, 'diagnosing' => 0, 'waiting_parts' => 1, 'in_progress' => 1, 'ready' => 1, 'delivered' => 1, 'cancelled' => 1,
        ])
        ->assertJsonCount(4, 'data.bays')
        ->assertJsonPath('data.bays.0.work_order.id', $forToday)
        ->assertJsonPath('data.bays.1.work_order', null)
        ->assertJsonCount(1, 'data.due_today')
        ->assertJsonPath('data.due_today.0.id', $forToday)
        ->assertJsonCount(1, 'data.late')
        ->assertJsonPath('data.late.0.id', $late)
        ->assertJsonCount(1, 'data.fleet_alerts')
        ->assertJsonPath('data.fleet_alerts.0.vehicle.plate', '1234ABC')
        ->assertJsonPath('data.revenue.month', '64.53');
});

it('filtra órdenes por vehículo, cliente y persona asignada, y clientes por teléfono o NIF', function () {
    $mechanic = addMember($this->ws, makeUser('Mario Filtro'), \App\Enums\WorkspaceRole::Mechanic);
    $otherCustomer = $this->ws->customers()->create(['name' => 'Otra Clienta', 'phone' => '600 000 077', 'tax_id' => 'B00000077']);
    $otherVehicle = makeVehicle($this->ws, ['customer_id' => $otherCustomer->id, 'plate' => '4444DDD']);
    $mine = $this->postJson($this->base, order($this->vehicle->id, ['assigned_to' => $mechanic->id]))->json('data.id');
    $theirs = $this->postJson($this->base, order($otherVehicle->id))->json('data.id');

    $this->getJson("{$this->base}?vehicle_id={$otherVehicle->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $theirs);
    $this->getJson("{$this->base}?customer_id={$this->customer->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine);
    $this->getJson("{$this->base}?assigned_to={$mechanic->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.assigned_to.name', 'Mario Filtro');

    $customers = "/api/v1/workspaces/{$this->ws->id}/customers";
    $this->getJson("{$customers}?search=000 077")->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Otra Clienta');
    $this->getJson("{$customers}?search=B00000077")->assertJsonCount(1, 'data');
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?customer_id={$otherCustomer->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.plate', '4444DDD');
    $this->getJson("/api/v1/workspaces/{$this->ws->id}/vehicles?search=Otra Clienta")->assertJsonCount(1, 'data');
});
