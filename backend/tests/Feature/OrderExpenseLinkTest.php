<?php

use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\Reminder;
use App\Models\WorkOrder;

/*
 * «Apex Telemetry», Fase 4:
 *  - §3.5.1 una orden nacida de una solicitud, al entregarse, deja intervención + gasto vinculado en el vehículo del particular;
 *  - §3.6.1 gasto periódico (renovación = recordatorio) y gasto asociado a una intervención;
 *  - §4.1 detalle de un mes de la analítica.
 */

/** Lucía pide, Marcos presupuesta (120,00 € + 21 %), Lucía acepta. Devuelve [id de la solicitud, id de la orden]. */
function convertedOrder(object $w): array
{
    $id = sendRequest($w);
    loginAs($w->owner);
    $quoteId = test()->postJson("/api/v1/repair-requests/{$id}/accept", ['quote' => quoteInput()])->assertOk()->json('data.quotes.0.id');
    loginAs($w->client);
    $orderId = test()->postJson("/api/v1/repair-requests/{$id}/quote/accept", ['quote_id' => $quoteId])->assertOk()->json('data.work_order.id');

    return [$id, $orderId];
}

function deliverOrder(object $w, int $orderId): void
{
    loginAs($w->owner);
    test()->postJson("/api/v1/work-orders/{$orderId}/status", ['status' => 'delivered'])->assertOk();
}

// ───────────────────────── §3.5.1 Orden entregada → intervención y gasto del particular ─────────────────────────

it('al entregar una orden nacida de una solicitud, el particular recibe la intervención y su gasto, una sola vez', function () {
    $w = e16World();
    [$requestId, $orderId] = convertedOrder($w);

    // Mientras la orden está abierta no hay nada en el garaje del particular
    expect(MaintenanceRecord::where('vehicle_id', $w->car->id)->count())->toBe(0)
        ->and(Expense::where('vehicle_id', $w->car->id)->count())->toBe(0);

    deliverOrder($w, $orderId);
    $order = WorkOrder::findOrFail($orderId);

    loginAs($w->client);
    $records = $this->getJson("/api/v1/vehicles/{$w->car->id}/maintenance")->assertOk()->json('data');
    expect($records)->toHaveCount(1);
    $record = $records[0];
    expect($record)->toMatchArray([
        'type' => 'repair', 'zone' => 'brakes', 'title' => 'Ruido al frenar', 'workshop_name' => 'Taller Destino',
        'parts_cost' => '80.00', 'labor_cost' => '40.00', 'total_cost' => '145.20', 'description' => null,
        'from_order' => ['number' => $order->number, 'repair_request_id' => $requestId],
    ])->and($record['items'])->toHaveCount(2)
        ->and($record['expense_id'])->not->toBeNull();

    $expenses = $this->getJson("/api/v1/vehicles/{$w->car->id}/expenses")->assertOk()->json('data');
    expect($expenses)->toHaveCount(1);
    expect($expenses[0])->toMatchArray([
        'category' => 'repair', 'amount' => '145.20', 'is_linked' => true, 'description' => 'Ruido al frenar',
        'origin' => [
            'record_id' => $record['id'], 'title' => 'Ruido al frenar', 'type' => 'repair', 'workshop_name' => 'Taller Destino',
            'parts_cost' => '80.00', 'labor_cost' => '40.00', 'tax_amount' => '25.20',
            'work_order_number' => $order->number, 'repair_request_id' => $requestId,
        ],
    ]);

    // Sin doble conteo: la analítica del particular suma la reparación una vez
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics")->assertOk()->assertJsonPath('data.total', '145.20');

    // Idempotente: volver a pedirlo no duplica nada
    app(\App\Services\MaintenanceService::class)->createFromDeliveredRequest($order->refresh());
    expect(MaintenanceRecord::where('repair_request_id', $requestId)->count())->toBe(1)
        ->and(Expense::where('vehicle_id', $w->car->id)->count())->toBe(1);

    // La actividad del particular lo cuenta sin autor (lo hizo el taller)
    expect(\App\Models\Activity::query()->where('workspace_id', $w->pws->id)->where('action', 'maintenance.created')->sole())
        ->user_id->toBeNull()
        ->summary->toContain('Taller Destino entregó', $order->number);
});

it('la intervención llegada del taller es del particular: no se ve desde el taller y archivarla retira el gasto', function () {
    $w = e16World();
    [, $orderId] = convertedOrder($w);
    deliverOrder($w, $orderId);
    $record = MaintenanceRecord::where('vehicle_id', $w->car->id)->sole();

    // El taller tiene su propia intervención (en su copia del vehículo), no la del particular
    loginAs($w->owner);
    $this->getJson("/api/v1/maintenance/{$record->id}")->assertNotFound();
    expect(WorkOrder::find($orderId)->maintenance_record_id)->not->toBe($record->id);
    // En el taller una orden no genera gastos (ADR-0003)
    expect(Expense::whereIn('vehicle_id', $w->wws->vehicles()->select('id'))->count())->toBe(0);

    loginAs($w->client);
    $this->postJson("/api/v1/maintenance/{$record->id}/archive")->assertOk();
    expect(Expense::where('vehicle_id', $w->car->id)->count())->toBe(0);
});

it('no toca el kilometraje del particular, y sin vehículo del particular no crea nada', function () {
    $w = e16World();
    [, $orderId] = convertedOrder($w);
    // El taller anotó 84.500 km en la recepción; el coche de Lucía sigue con su última lectura propia
    deliverOrder($w, $orderId);
    expect(MaintenanceRecord::where('vehicle_id', $w->car->id)->sole()->mileage)->toBeNull()
        ->and($w->car->refresh()->current_mileage)->toBe(84200)
        ->and(\App\Models\MileageLog::where('vehicle_id', $w->car->id)->count())->toBe(1);

    // Otra solicitud cuyo coche Lucía elimina antes de la entrega
    $w2 = e16World();
    [$requestId2, $orderId2] = convertedOrder($w2);
    loginAs($w2->client);
    $this->postJson("/api/v1/vehicles/{$w2->car->id}/archive")->assertOk();
    $this->deleteJson("/api/v1/vehicles/{$w2->car->id}")->assertNoContent();
    deliverOrder($w2, $orderId2);
    expect(MaintenanceRecord::where('repair_request_id', $requestId2)->count())->toBe(0);
});

it('una orden normal del taller (sin solicitud) no deja nada en ningún garaje personal', function () {
    $w = world();
    loginAs($w->owner);
    $before = [MaintenanceRecord::count(), Expense::count()];
    $this->postJson("/api/v1/work-orders/{$w->order['id']}/status", ['status' => 'delivered'])->assertOk();
    // Solo la intervención del propio taller
    expect(MaintenanceRecord::count())->toBe($before[0] + 1)
        ->and(Expense::count())->toBe($before[1])
        ->and(MaintenanceRecord::whereNotNull('repair_request_id')->count())->toBe(0);
});

// ───────────────────────── §3.6.1 Gasto periódico ─────────────────────────

it('un gasto periódico crea el recordatorio de su renovación y no cuenta el pago futuro como gasto', function () {
    $w = e16World();
    loginAs($w->client);

    $expense = $this->postJson("/api/v1/vehicles/{$w->car->id}/expenses", [
        'category' => 'insurance', 'amount' => '420.00', 'expense_date' => day(-10), 'description' => 'Póliza anual',
        'recurrence_months' => 12, 'next_due_date' => day(355),
    ])->assertCreated()->json('data');

    expect($expense['recurrence_months'])->toBe(12)
        ->and($expense['renewal'])->toMatchArray(['title' => 'Renovar el seguro', 'due_date' => day(355), 'status' => 'pending']);
    $reminder = Reminder::findOrFail($expense['renewal']['reminder_id']);
    expect($reminder->kind->value)->toBe('insurance')->and($reminder->recurrence_months)->toBe(12)->and($reminder->vehicle_id)->toBe($w->car->id);

    // Solo hay un gasto: la renovación no es dinero gastado
    expect(Expense::where('vehicle_id', $w->car->id)->count())->toBe(1);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics")->assertOk()->assertJsonPath('data.total', '420.00');
});

it('reutiliza el recordatorio pendiente del mismo tipo en vez de crear otro, y por defecto renueva a fecha + periodicidad', function () {
    $w = e16World();
    loginAs($w->client);
    $existing = $this->postJson("/api/v1/vehicles/{$w->car->id}/reminders", ['title' => 'Seguro a todo riesgo', 'kind' => 'insurance', 'due_date' => day(40)])->assertCreated()->json('data.id');

    $expense = $this->postJson("/api/v1/vehicles/{$w->car->id}/expenses", [
        'category' => 'insurance', 'amount' => '210.00', 'expense_date' => day(), 'recurrence_months' => 6,
    ])->assertCreated()->json('data');

    $due = now()->startOfDay()->addMonthsNoOverflow(6)->toDateString();
    expect($expense['renewal'])->toMatchArray(['reminder_id' => $existing, 'title' => 'Seguro a todo riesgo', 'due_date' => $due])
        ->and(Reminder::where('vehicle_id', $w->car->id)->count())->toBe(1)
        ->and(Reminder::find($existing)->recurrence_months)->toBe(6);

    // Cambiar la renovación mueve el mismo recordatorio; quitar la periodicidad suelta el gasto y deja el recordatorio
    $this->patchJson("/api/v1/expenses/{$expense['id']}", ['next_due_date' => day(200)])->assertOk()->assertJsonPath('data.renewal.due_date', day(200));
    $this->patchJson("/api/v1/expenses/{$expense['id']}", ['recurrence_months' => null])->assertOk()
        ->assertJsonPath('data.recurrence_months', null)->assertJsonPath('data.renewal', null);
    expect(Reminder::find($existing))->not->toBeNull();
});

it('valida la periodicidad: solo 1, 3, 6 o 12 meses, renovación posterior al gasto y solo en categorías periódicas', function () {
    $w = e16World();
    loginAs($w->client);
    $url = "/api/v1/vehicles/{$w->car->id}/expenses";
    $base = ['category' => 'tax', 'amount' => '64.00', 'expense_date' => day()];

    $this->postJson($url, $base + ['recurrence_months' => 5])->assertStatus(422)->assertJsonValidationErrors('recurrence_months');
    $this->postJson($url, $base + ['recurrence_months' => 12, 'next_due_date' => day(-1)])->assertStatus(422)->assertJsonValidationErrors('next_due_date');
    expect(Expense::count())->toBe(0)->and(Reminder::count())->toBe(0);

    // El combustible no es periódico: se guarda sin periodicidad y sin recordatorio
    $fuel = $this->postJson($url, ['category' => 'fuel', 'amount' => '50.00', 'expense_date' => day(), 'recurrence_months' => 1])->assertCreated()->json('data');
    expect($fuel['recurrence_months'])->toBeNull()->and($fuel['renewal'])->toBeNull()->and(Reminder::count())->toBe(0);

    // Aparcamiento mensual: recordatorio propio con su título
    $parking = $this->postJson($url, ['category' => 'parking', 'amount' => '90.00', 'expense_date' => day(), 'recurrence_months' => 1])->assertCreated()->json('data');
    expect($parking['renewal']['title'])->toBe('Renovar el aparcamiento')
        ->and(Reminder::find($parking['renewal']['reminder_id'])->kind->value)->toBe('custom');
});

// ───────────────────────── §3.6.1 Gasto asociado a una intervención ─────────────────────────

it('un gasto de reparación puede crear su intervención en el mismo paso: un solo apunte, vinculado', function () {
    $w = e16World();
    loginAs($w->client);

    $expense = $this->postJson("/api/v1/vehicles/{$w->car->id}/expenses", [
        'category' => 'modification', 'amount' => '350.00', 'expense_date' => day(-2), 'description' => 'Con homologación',
        'record' => ['title' => 'Llantas de 17 pulgadas', 'zone' => 'tyres', 'workshop_name' => 'Neumáticos Sur'],
    ])->assertCreated()->json('data');

    expect($expense)->toMatchArray(['category' => 'modification', 'amount' => '350.00', 'is_linked' => true, 'expense_date' => day(-2)])
        ->and($expense['origin'])->toMatchArray(['title' => 'Llantas de 17 pulgadas', 'type' => 'modification', 'workshop_name' => 'Neumáticos Sur', 'work_order_number' => null]);
    $record = MaintenanceRecord::findOrFail($expense['origin']['record_id']);
    expect($record->zone->value)->toBe('tyres')->and($record->total_cost)->toBe('350.00')->and($record->description)->toBe('Con homologación')
        ->and(Expense::where('vehicle_id', $w->car->id)->count())->toBe(1);

    // Vinculado: se gestiona desde la intervención
    $this->patchJson("/api/v1/expenses/{$expense['id']}", ['amount' => '1.00'])->assertStatus(409);
});

it('un gasto puede asociarse a una intervención que aún no tenía coste; si ya lo tiene, 409; si es de otro coche, 422', function () {
    $w = e16World();
    loginAs($w->client);
    $v = "/api/v1/vehicles/{$w->car->id}";
    $free = $this->postJson("{$v}/maintenance", ['type' => 'repair', 'zone' => 'brakes', 'title' => 'Cambio de discos', 'service_date' => day(-5)])->assertCreated()->json('data.id');
    $paid = $this->postJson("{$v}/maintenance", ['type' => 'maintenance', 'zone' => 'engine', 'title' => 'Aceite', 'service_date' => day(-9), 'total_cost' => '60.00'])->assertCreated()->json('data.id');
    $other = makeVehicle($w->pws, ['plate' => '9999ZZZ']);
    $foreign = $this->postJson("/api/v1/vehicles/{$other->id}/maintenance", ['type' => 'repair', 'zone' => 'general', 'title' => 'Otro coche', 'service_date' => day(-1)])->assertCreated()->json('data.id');
    $input = ['category' => 'repair', 'amount' => '180.00', 'expense_date' => day()];

    $expense = $this->postJson("{$v}/expenses", $input + ['maintenance_record_id' => $free])->assertCreated()->json('data');
    // La fecha la manda la intervención
    expect($expense)->toMatchArray(['maintenance_record_id' => $free, 'is_linked' => true, 'amount' => '180.00', 'expense_date' => day(-5), 'description' => 'Cambio de discos'])
        ->and(MaintenanceRecord::find($free)->total_cost)->toBe('180.00');

    $this->postJson("{$v}/expenses", $input + ['maintenance_record_id' => $paid])->assertStatus(409);
    $this->postJson("{$v}/expenses", $input + ['maintenance_record_id' => $foreign])->assertStatus(422)->assertJsonValidationErrors('maintenance_record_id');
    $this->postJson("{$v}/expenses", $input + ['maintenance_record_id' => $free, 'record' => ['title' => 'Las dos cosas']])->assertStatus(422);
    $this->postJson("{$v}/expenses", $input + ['record' => ['zone' => 'brakes']])->assertStatus(422)->assertJsonValidationErrors('record.title');
    // 60 (aceite) + 180 (discos): nada se ha contado dos veces
    expect(Expense::where('vehicle_id', $w->car->id)->sum('amount'))->toEqual(240);
});

// ───────────────────────── §4.1 Detalle de un mes ─────────────────────────

it('el detalle del mes del particular da total, comparación, categorías y cada gasto con su vehículo y su origen', function () {
    $w = e16World();
    [$requestId, $orderId] = convertedOrder($w);
    deliverOrder($w, $orderId);
    loginAs($w->client);
    $v = "/api/v1/vehicles/{$w->car->id}";
    $this->postJson("{$v}/expenses", ['category' => 'fuel', 'amount' => '54.80', 'expense_date' => day()])->assertCreated();
    $prev = now()->startOfMonth()->subDay()->toDateString();
    $this->postJson("{$v}/expenses", ['category' => 'tolls', 'amount' => '100.00', 'expense_date' => $prev])->assertCreated();

    $month = now()->format('Y-m');
    $data = $this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics/month?month={$month}")->assertOk()->json('data');

    expect($data['month'])->toBe($month)
        ->and($data['total'])->toBe('200.00')
        ->and($data['previous'])->toBe(['month' => now()->startOfMonth()->subDay()->format('Y-m'), 'total' => '100.00'])
        ->and($data['change_pct'])->toEqual(100.0)
        ->and($data['orders'])->toBe([])
        ->and(collect($data['by_category'])->pluck('total', 'category')->all())->toBe(['repair' => '145.20', 'fuel' => '54.80'])
        ->and($data['expenses'])->toHaveCount(2);
    $repair = collect($data['expenses'])->firstWhere('category', 'repair');
    expect($repair['vehicle']['id'])->toBe($w->car->id)
        ->and($repair['origin']['repair_request_id'])->toBe($requestId);

    // Un mes sin nada: ceros y sin porcentaje
    $empty = $this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics/month?month=2020-01")->assertOk()->json('data');
    expect($empty['total'])->toBe('0.00')->and($empty['change_pct'])->toBeNull()->and($empty['expenses'])->toBe([]);
});

it('el detalle del mes del taller lista las órdenes entregadas; exige manage y no se ve desde otro espacio', function () {
    $w = e16World();
    [, $orderId] = convertedOrder($w);
    deliverOrder($w, $orderId);
    $month = now()->format('Y-m');
    $url = "/api/v1/workspaces/{$w->wws->id}/analytics/month";

    $data = $this->getJson("{$url}?month={$month}")->assertOk()->json('data');
    expect($data['total'])->toBe('145.20')->and($data['expenses'])->toBe([])->and($data['by_category'])->toBe([])
        ->and($data['orders'])->toHaveCount(1)
        ->and($data['orders'][0])->toMatchArray(['id' => $orderId, 'title' => 'Ruido al frenar', 'total' => '145.20']);

    $this->getJson($url)->assertStatus(422)->assertJsonValidationErrors('month');
    $this->getJson("{$url}?month=2026-13")->assertStatus(422);
    loginAs($w->mechanic);
    $this->getJson("{$url}?month={$month}")->assertForbidden();
    loginAs($w->intruder);
    $this->getJson("{$url}?month={$month}")->assertNotFound();
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics/month?month={$month}")->assertNotFound();
});

// ───────────────────────── Puesta al día de órdenes ya entregadas ─────────────────────────

it('el comando de puesta al día crea lo que falta para las órdenes ya entregadas y se puede repetir', function () {
    $w = e16World();
    [$requestId, $orderId] = convertedOrder($w);
    deliverOrder($w, $orderId);
    // Como si la entrega fuera anterior a la Fase 4: sin intervención ni gasto en el garaje del particular
    MaintenanceRecord::where('repair_request_id', $requestId)->get()->each(function (MaintenanceRecord $r) {
        Expense::where('maintenance_record_id', $r->id)->delete();
        $r->delete();
    });
    // Y otra solicitud cuya orden sigue abierta: esa no se toca
    $w2 = e16World();
    convertedOrder($w2);

    $this->artisan('carcare:sync-order-expenses --dry-run')->expectsOutputToContain('Se crearían 1')->assertSuccessful();
    expect(MaintenanceRecord::whereNotNull('repair_request_id')->count())->toBe(0);

    $this->artisan('carcare:sync-order-expenses')->expectsOutputToContain('Creadas 1')->assertSuccessful();
    $this->artisan('carcare:sync-order-expenses')->expectsOutputToContain('Creadas 0')->assertSuccessful();
    expect(MaintenanceRecord::where('repair_request_id', $requestId)->count())->toBe(1)
        ->and(Expense::where('vehicle_id', $w->car->id)->sole()->amount)->toBe('145.20')
        ->and(MaintenanceRecord::where('vehicle_id', $w2->car->id)->count())->toBe(0);
});
