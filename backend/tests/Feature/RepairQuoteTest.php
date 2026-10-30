<?php

use App\Enums\MileageSource;
use App\Models\Activity;
use App\Models\Customer;
use App\Models\MileageLog;
use App\Models\RepairQuote;
use App\Models\RepairRequest;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Services\CustomerService;

/*
 * E16 · Presupuesto en versiones inmutables (contrato §3.13.5) y conversión en orden (§3.13.6).
 * "Presupuesto (no es una factura)" (D12): CarCare calcula importes, no emite facturas.
 */

function rq(int $id, string $suffix = ''): string
{
    return "/api/v1/repair-requests/{$id}{$suffix}";
}

/** Solicitud de Lucía aceptada por Marcos con la v1 (120,00 € + 21 %). Devuelve [id de la solicitud, id de la v1]. */
function quotedRequest(object $w, array $requestOverrides = [], array $quoteOverrides = []): array
{
    $id = sendRequest($w, $requestOverrides);
    loginAs($w->owner);
    $quoteId = test()->postJson(rq($id, '/accept'), ['quote' => quoteInput($quoteOverrides)])->assertOk()->json('data.quotes.0.id');
    loginAs($w->client);

    return [$id, $quoteId];
}

// ───────────────────────── Presupuesto ─────────────────────────

it('aceptar con presupuesto: pending → quoted con la v1, totales half‑up y líneas sin id', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);

    $data = $this->postJson(rq($id, '/accept'), ['quote' => quoteInput(['items' => [
        ['kind' => 'part', 'name' => 'Pastillas delanteras', 'part_number' => 'PF-1', 'quantity' => '2', 'unit_price' => '33.33'],
        ['kind' => 'labor', 'name' => 'Mano de obra', 'quantity' => '1.5', 'unit_price' => '40'],
    ]])])->assertOk()->json('data');

    expect($data['status'])->toBe('quoted')
        ->and($data['responded_at'])->not->toBeNull()
        ->and($data['quotes'])->toHaveCount(1);
    $quote = $data['quotes'][0];
    expect($quote)->toMatchArray([
        'version' => 1, 'status' => 'sent', 'subtotal' => '126.66', 'tax_rate' => '21.00', 'tax_amount' => '26.60',
        'total' => '153.26', 'valid_days' => 15, 'valid_until' => day(15), 'is_expired' => false,
        'note' => 'Incluye revisión de discos.', 'client_reason' => null, 'answered_at' => null,
    ])->and($quote['items'])->toBe([
        ['kind' => 'part', 'name' => 'Pastillas delanteras', 'part_number' => 'PF-1', 'quantity' => '2.00', 'unit_price' => '33.33', 'total' => '66.66'],
        ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.50', 'unit_price' => '40.00', 'total' => '60.00'],
    ]);

    expect(Activity::query()->where('workspace_id', $w->wws->id)->where('action', 'repair_quote.sent')->sole()->summary)
        ->toBe('Marcos Taller envió el presupuesto v1 de Seat Ibiza (1234ABC)');
});

it('el IVA por defecto es el del taller; si llega, se usa el indicado', function () {
    $w = e16World();
    $w->wws->update(['settings' => ['tax_rate' => '10.00']]);
    $first = sendRequest($w);
    $second = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 0]);
    loginAs($w->owner);

    $this->postJson(rq($first, '/accept'), ['quote' => quoteInput()])->assertOk()
        ->assertJsonPath('data.quotes.0.tax_rate', '10.00')
        ->assertJsonPath('data.quotes.0.tax_amount', '12.00')
        ->assertJsonPath('data.quotes.0.total', '132.00');
    $this->postJson(rq($second, '/accept'), ['quote' => quoteInput(['tax_rate' => '4', 'valid_days' => 30])])->assertOk()
        ->assertJsonPath('data.quotes.0.tax_rate', '4.00')
        ->assertJsonPath('data.quotes.0.total', '124.80')
        ->assertJsonPath('data.quotes.0.valid_until', day(30));
});

it('enviar presupuesto: desde accepted crea la v1 y desde quoted la v2 (la v1 pasa a superseded); 201', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->manager);
    $this->postJson(rq($id, '/accept'))->assertOk();

    $this->postJson(rq($id, '/quotes'), quoteInput())->assertCreated()
        ->assertJsonPath('data.status', 'quoted')
        ->assertJsonPath('data.quotes.0.version', 1);
    $data = $this->postJson(rq($id, '/quotes'), quoteInput(['items' => [['kind' => 'labor', 'name' => 'Solo mano de obra', 'quantity' => '1', 'unit_price' => '40.00']], 'note' => null]))
        ->assertCreated()->json('data');

    expect(array_column($data['quotes'], 'version'))->toBe([2, 1])
        ->and(array_column($data['quotes'], 'status'))->toBe(['sent', 'superseded'])
        ->and($data['quotes'][0]['total'])->toBe('48.40')
        ->and($data['quotes'][1]['total'])->toBe('145.20'); // la v1 no cambia: es inmutable
    expect(Activity::query()->where('action', 'repair_quote.sent')->latest('id')->first()->summary)
        ->toBe('Elena Gerente envió el presupuesto v2 de Seat Ibiza (1234ABC)');
});

it('enviar presupuesto a una solicitud pendiente da 409: primero se acepta', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);

    $this->postJson(rq($id, '/quotes'), quoteInput())->assertConflict()
        ->assertExactJson(['message' => 'Acepta la solicitud antes de enviar un presupuesto (o acéptala directamente con presupuesto).']);
    expect(RepairQuote::count())->toBe(0);
});

it('valida el presupuesto: claves items.* en /quotes y quote.items.* en /accept (422)', function (string $route, array $body, string $field) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);
    if ($route === '/quotes') {
        $this->postJson(rq($id, '/accept'))->assertOk();
    }

    $this->postJson(rq($id, $route), $body)->assertUnprocessable()->assertJsonValidationErrors($field);
    expect(RepairQuote::count())->toBe(0);
})->with([
    'sin precio (quotes)' => ['/quotes', quoteInput(['items' => [['kind' => 'part', 'name' => 'Pieza', 'quantity' => '1']]]), 'items.0.unit_price'],
    'sin precio (accept)' => ['/accept', ['quote' => quoteInput(['items' => [['kind' => 'part', 'name' => 'Pieza', 'quantity' => '1', 'unit_price' => null]]])], 'quote.items.0.unit_price'],
    'sin líneas (quotes)' => ['/quotes', quoteInput(['items' => []]), 'items'],
    'sin líneas (accept)' => ['/accept', ['quote' => ['valid_days' => 10]], 'quote.items'],
    '51 líneas' => ['/quotes', quoteInput(['items' => array_fill(0, 51, ['kind' => 'part', 'name' => 'P', 'quantity' => '1', 'unit_price' => '1.00'])]), 'items'],
    'precio negativo' => ['/quotes', quoteInput(['items' => [['kind' => 'part', 'name' => 'P', 'quantity' => '1', 'unit_price' => '-1.00']]]), 'items.0.unit_price'],
    'precio con 3 decimales' => ['/quotes', quoteInput(['items' => [['kind' => 'part', 'name' => 'P', 'quantity' => '1', 'unit_price' => '1.005']]]), 'items.0.unit_price'],
    'precio por encima del máximo' => ['/quotes', quoteInput(['items' => [['kind' => 'part', 'name' => 'P', 'quantity' => '1', 'unit_price' => '1000000.00']]]), 'items.0.unit_price'],
    'cantidad 0' => ['/quotes', quoteInput(['items' => [['kind' => 'part', 'name' => 'P', 'quantity' => '0', 'unit_price' => '1.00']]]), 'items.0.quantity'],
    'tipo de línea inventado' => ['/quotes', quoteInput(['items' => [['kind' => 'regalo', 'name' => 'P', 'quantity' => '1', 'unit_price' => '1.00']]]), 'items.0.kind'],
    'IVA 101' => ['/quotes', quoteInput(['tax_rate' => '101']), 'tax_rate'],
    'validez 0' => ['/quotes', quoteInput(['valid_days' => 0]), 'valid_days'],
    'validez 91' => ['/accept', ['quote' => quoteInput(['valid_days' => 91])], 'quote.valid_days'],
    'nota de 1001' => ['/quotes', quoteInput(['note' => str_repeat('a', 1001)]), 'note'],
    'quote no es un objeto' => ['/accept', ['quote' => 'sí'], 'quote'],
]);

// ───────────────────────── Respuesta del cliente ─────────────────────────

it('rechazar el presupuesto: quoted → accepted, la versión pasa a rejected con el motivo; actividad sin nombre en el taller', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);

    $data = $this->postJson(rq($id, '/quote/reject'), ['quote_id' => $quoteId, 'reason' => '  Es caro, ¿y sin los discos?  '])
        ->assertOk()->json('data');

    expect($data['status'])->toBe('accepted')
        ->and($data['closed_at'])->toBeNull()
        ->and($data['quotes'][0])->toMatchArray(['status' => 'rejected', 'client_reason' => 'Es caro, ¿y sin los discos?'])
        ->and($data['quotes'][0]['answered_at'])->not->toBeNull();

    $personal = Activity::query()->where('workspace_id', $w->pws->id)->where('action', 'repair_quote.rejected')->sole();
    $workshop = Activity::query()->where('workspace_id', $w->wws->id)->where('action', 'repair_quote.rejected')->sole();
    expect($personal->summary)->toBe('Rechazaste el presupuesto de Taller Destino para Seat Ibiza')
        ->and($workshop->summary)->toBe('El cliente rechazó el presupuesto v1 de Seat Ibiza (1234ABC)')
        ->and($workshop->user_id)->toBeNull();

    // El taller puede enviar otra versión.
    loginAs($w->owner);
    $this->postJson(rq($id, '/quotes'), quoteInput())->assertCreated()
        ->assertJsonPath('data.quotes.0.version', 2)
        ->assertJsonPath('data.quotes.1.status', 'rejected');
});

it('responder a una versión que ya no es la vigente da 409', function (string $action) {
    $w = e16World();
    [$id, $v1] = quotedRequest($w);
    loginAs($w->owner);
    $this->postJson(rq($id, '/quotes'), quoteInput())->assertCreated();
    loginAs($w->client);

    $this->postJson(rq($id, "/quote/{$action}"), ['quote_id' => $v1])->assertConflict()
        ->assertExactJson(['message' => 'El taller ha enviado un presupuesto nuevo. Revísalo antes de responder.']);
    $this->postJson(rq($id, "/quote/{$action}"), ['quote_id' => 999999])->assertConflict();
    expect(RepairRequest::find($id)->status->value)->toBe('quoted');
})->with(['accept', 'reject']);

it('responder sin presupuesto pendiente o con la solicitud cerrada da 409', function () {
    $w = e16World();
    [$id, $v1] = quotedRequest($w);
    $this->postJson(rq($id, '/quote/reject'), ['quote_id' => $v1])->assertOk();

    foreach (['accept', 'reject'] as $action) {
        $this->postJson(rq($id, "/quote/{$action}"), ['quote_id' => $v1])->assertConflict()
            ->assertExactJson(['message' => 'Esta solicitud no tiene ningún presupuesto pendiente de respuesta.']);
    }

    $this->postJson(rq($id, '/cancel'))->assertOk();
    $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $v1])->assertConflict()
        ->assertExactJson(['message' => 'Esta solicitud ya está cerrada.']);
});

it('quote_id es obligatorio y entero (422)', function (array $body) {
    $w = e16World();
    [$id] = quotedRequest($w);

    $this->postJson(rq($id, '/quote/accept'), $body)->assertUnprocessable()->assertJsonValidationErrors('quote_id');
    $this->postJson(rq($id, '/quote/reject'), $body + ['reason' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('quote_id');
})->with([[[]], [['quote_id' => 'v1']], [['quote_id' => null]]]);

it('un presupuesto caducado no se puede aceptar (409), pero sí rechazar', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    RepairQuote::query()->whereKey($quoteId)->update(['valid_until' => '2026-01-10']);

    $this->getJson(rq($id))->assertOk()->assertJsonPath('data.quotes.0.is_expired', true);
    $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertConflict()
        ->assertExactJson(['message' => 'El presupuesto caducó el 10/01/2026. Pide al taller uno nuevo.']);
    expect(WorkOrder::count())->toBe(0);

    $this->postJson(rq($id, '/quote/reject'), ['quote_id' => $quoteId])->assertOk()
        ->assertJsonPath('data.status', 'accepted')
        ->assertJsonPath('data.quotes.0.is_expired', false); // ya no está vigente
});

// ───────────────────────── Conversión en orden (§3.13.6) ─────────────────────────

it('aceptar el presupuesto crea cliente, vehículo y orden en una transacción, con las líneas y totales del presupuesto', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    $personalReadings = $w->car->mileageLogs()->count();

    $data = $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk()->json('data');

    expect($data['status'])->toBe('converted')
        ->and($data['closed_at'])->not->toBeNull()
        ->and($data['quotes'][0]['status'])->toBe('accepted')
        ->and($data['quotes'][0]['answered_at'])->not->toBeNull()
        ->and($data['work_order'])->toMatchArray(['number' => 'OT-'.now()->year.'-0001', 'status' => 'received', 'completed_at' => null, 'delivered_at' => null]);

    $order = WorkOrder::with('items')->findOrFail($data['work_order']['id']);
    $customer = Customer::query()->where('workspace_id', $w->wws->id)->sole();
    $vehicle = Vehicle::query()->where('workspace_id', $w->wws->id)->sole();

    expect($customer->only(['name', 'email', 'phone', 'tax_id', 'notes']))->toBe([
        'name' => 'Lucía Cliente', 'email' => $w->client->email, 'phone' => '600 000 000', 'tax_id' => null, 'notes' => null,
    ]);
    expect($vehicle->only(['make', 'model', 'year', 'color_hex', 'plate', 'customer_id', 'source_vehicle_id', 'nickname', 'vin']))->toBe([
        'make' => 'Seat', 'model' => 'Ibiza', 'year' => 2019, 'color_hex' => '#C0392B', 'plate' => '1234ABC',
        'customer_id' => $customer->id, 'source_vehicle_id' => $w->car->id, 'nickname' => null, 'vin' => null,
    ]);
    expect($order->only(['workspace_id', 'vehicle_id', 'customer_id', 'title', 'complaint', 'diagnosis', 'mileage_in']))->toBe([
        'workspace_id' => $w->wws->id, 'vehicle_id' => $vehicle->id, 'customer_id' => $customer->id, 'title' => 'Ruido al frenar',
        'complaint' => 'Chirrían los frenos delanteros al frenar suave.', 'diagnosis' => null, 'mileage_in' => 84500,
    ])->and($order->priority->value)->toBe('normal')
        ->and([$order->subtotal, $order->tax_rate, $order->tax_amount, $order->total])->toBe(['120.00', '21.00', '25.20', '145.20'])
        ->and($order->items->map->only(['kind', 'name', 'part_number', 'quantity', 'unit_price', 'total'])->map(fn ($i) => [...$i, 'kind' => $i['kind']->value])->all())->toBe([
            ['kind' => 'part', 'name' => 'Pastillas delanteras', 'part_number' => 'PF-1', 'quantity' => '1.00', 'unit_price' => '80.00', 'total' => '80.00'],
            ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.00', 'unit_price' => '40.00', 'total' => '40.00'],
        ]);

    // La lectura de km es del vehículo del taller (source = work_order); el garaje del particular no cambia.
    $reading = MileageLog::query()->where('vehicle_id', $vehicle->id)->sole();
    expect($reading->source)->toBe(MileageSource::WorkOrder)
        ->and($reading->source_id)->toBe($order->id)
        ->and($reading->mileage)->toBe(84500)
        ->and($vehicle->fresh()->current_mileage)->toBe(84500)
        ->and($w->car->mileageLogs()->count())->toBe($personalReadings);

    // Columnas internas guardadas y nunca en el JSON.
    $stored = RepairRequest::find($id);
    expect($stored->customer_id)->toBe($customer->id)->and($stored->work_order_id)->toBe($order->id)
        ->and($data)->not->toHaveKey('customer_id')->and($data)->not->toHaveKey('work_order_id');

    // Actividad: sin el nombre del particular en el taller.
    $workshopActivity = Activity::query()->where('workspace_id', $w->wws->id)->whereNull('user_id')->orderBy('id')->get(['action', 'summary', 'vehicle_id']);
    expect($workshopActivity->map->only(['action', 'summary'])->all())->toBe([
        ['action' => 'customer.created', 'summary' => 'Se dio de alta al cliente Lucía Cliente desde una solicitud'],
        ['action' => 'work_order.created', 'summary' => "Se abrió {$order->number} desde una solicitud"],
        ['action' => 'repair_quote.accepted', 'summary' => 'El cliente aceptó el presupuesto v1 de Seat Ibiza (1234ABC)'],
    ])->and($workshopActivity[1]->vehicle_id)->toBe($vehicle->id);
    expect(Activity::query()->where('workspace_id', $w->pws->id)->where('action', 'repair_quote.accepted')->sole()->summary)
        ->toBe('Aceptaste el presupuesto de Taller Destino para Seat Ibiza');

    // El particular ve la orden solo dentro de su solicitud.
    $this->getJson("/api/v1/work-orders/{$order->id}")->assertNotFound();
    $this->getJson("/api/v1/vehicles/{$vehicle->id}")->assertNotFound();
    $this->getJson("/api/v1/customers/{$customer->id}")->assertNotFound();

    // Y el taller la encuentra por la solicitud de la que viene.
    loginAs($w->mechanic);
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/repair-requests?work_order_id={$order->id}")->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
    $this->getJson("/api/v1/work-orders/{$order->id}")->assertOk()->assertJsonPath('data.customer.name', 'Lucía Cliente');
});

it('una segunda solicitud del mismo usuario reutiliza el cliente y el vehículo del taller', function () {
    $w = e16World();
    [$first, $v1] = quotedRequest($w);
    $this->postJson(rq($first, '/quote/accept'), ['quote_id' => $v1])->assertOk();
    [$second, $v1b] = quotedRequest($w, ['title' => 'Cambio de aceite', 'mileage' => 90000]);

    $order = $this->postJson(rq($second, '/quote/accept'), ['quote_id' => $v1b])->assertOk()->json('data.work_order');

    expect(Customer::query()->where('workspace_id', $w->wws->id)->count())->toBe(1)
        ->and(Vehicle::query()->where('workspace_id', $w->wws->id)->count())->toBe(1)
        ->and($order['number'])->toBe('OT-'.now()->year.'-0002')
        ->and(WorkOrder::find($order['id'])->customer_id)->toBe(RepairRequest::find($first)->customer_id)
        ->and(Vehicle::query()->where('workspace_id', $w->wws->id)->sole()->current_mileage)->toBe(90000)
        ->and(Activity::query()->where('workspace_id', $w->wws->id)->where('action', 'customer.created')->count())->toBe(1);
});

it('nunca enlaza por email con un cliente dado de alta a mano; por matrícula reutiliza el vehículo sin cambiarle el cliente', function () {
    $w = e16World();
    loginAs($w->owner);
    $manual = app(CustomerService::class)->create($w->wws, ['name' => 'Lucía (alta manual)', 'email' => $w->client->email]);
    $samePlate = makeVehicle($w->wws, ['plate' => '1234ABC', 'customer_id' => $manual->id, 'make' => 'Seat', 'model' => 'Ibiza']);
    [$id, $quoteId] = quotedRequest($w);

    $order = $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk()->json('data.work_order');

    $created = Customer::query()->where('workspace_id', $w->wws->id)->whereKeyNot($manual->id)->sole();
    expect($created->name)->toBe('Lucía Cliente')
        ->and(WorkOrder::find($order['id'])->customer_id)->toBe($created->id)
        ->and(WorkOrder::find($order['id'])->vehicle_id)->toBe($samePlate->id)
        ->and($samePlate->fresh()->customer_id)->toBe($manual->id)          // no se le cambia el cliente
        ->and($samePlate->fresh()->source_vehicle_id)->toBe($w->car->id)   // pero queda enlazado
        ->and(Vehicle::query()->where('workspace_id', $w->wws->id)->count())->toBe(1);
});

it('si el cliente de la solicitud anterior está anonimizado, crea uno nuevo', function () {
    $w = e16World();
    [$first, $v1] = quotedRequest($w);
    $order = $this->postJson(rq($first, '/quote/accept'), ['quote_id' => $v1])->assertOk()->json('data.work_order');
    loginAs($w->owner);
    $this->postJson("/api/v1/work-orders/{$order['id']}/status", ['status' => 'delivered'])->assertOk();
    $this->postJson('/api/v1/customers/'.RepairRequest::find($first)->customer_id.'/anonymize')->assertOk();
    [$second, $v1b] = quotedRequest($w);

    $this->postJson(rq($second, '/quote/accept'), ['quote_id' => $v1b])->assertOk();

    expect(Customer::query()->where('workspace_id', $w->wws->id)->count())->toBe(2)
        ->and(RepairRequest::find($second)->customer_id)->not->toBe(RepairRequest::find($first)->customer_id);
    // La frase con el nombre se reescribió al anonimizar (§3.10.1).
    expect(Activity::query()->where('workspace_id', $w->wws->id)->where('action', 'customer.created')->orderBy('id')->pluck('summary')->all())
        ->toBe(['Se dio de alta a un cliente (anonimizado)', 'Se dio de alta al cliente Lucía Cliente desde una solicitud']);
});

it('una solicitud convertida no se cancela (409 con el número de la orden)', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    $number = $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk()->json('data.work_order.number');

    $this->postJson(rq($id, '/cancel'))->assertConflict()
        ->assertExactJson(['message' => "Esta solicitud ya es la orden {$number}. Para cancelarla, llama al taller."]);
    $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertConflict()
        ->assertExactJson(['message' => 'Esta solicitud ya está cerrada.']);
    expect(WorkOrder::count())->toBe(1);
});

it('si el taller borra la orden, work_order pasa a null y la solicitud sigue convertida', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    $order = $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk()->json('data.work_order');
    loginAs($w->owner);

    $this->deleteJson("/api/v1/work-orders/{$order['id']}")->assertNoContent();

    loginAs($w->client);
    $this->getJson(rq($id))->assertOk()
        ->assertJsonPath('data.status', 'converted')
        ->assertJsonPath('data.work_order', null);
});

it('el particular sigue el estado de la orden desde su solicitud', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    $order = $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk()->json('data.work_order');
    loginAs($w->mechanic);
    $this->postJson("/api/v1/work-orders/{$order['id']}/status", ['status' => 'ready'])->assertOk();

    loginAs($w->client);
    $data = $this->getJson(rq($id))->assertOk()->json('data.work_order');
    expect($data['status'])->toBe('ready')->and($data['completed_at'])->not->toBeNull();
});

it('si falla la conversión no queda nada a medias (una sola transacción)', function () {
    $w = e16World();
    [$id, $quoteId] = quotedRequest($w);
    // Fuerza un fallo dentro de la conversión: un número de orden ya ocupado rompe la clave única.
    $existing = makeVehicle($w->wws, ['plate' => '0000AAA']);
    $blocker = app(\App\Services\WorkOrderService::class)->create($w->wws, ['vehicle_id' => $existing->id, 'title' => 'Bloqueo']);
    \Illuminate\Support\Facades\DB::table('work_orders')->where('id', $blocker->id)->update(['sequence' => 0]);
    $customers = Customer::count();
    $vehicles = Vehicle::count();

    $this->withoutExceptionHandling();
    expect(fn () => $this->postJson(rq($id, '/quote/accept'), ['quote_id' => $quoteId]))->toThrow(\Illuminate\Database\QueryException::class);

    expect(RepairRequest::find($id)->status->value)->toBe('quoted')
        ->and(RepairQuote::find($quoteId)->status->value)->toBe('sent')
        ->and(Customer::count())->toBe($customers)
        ->and(Vehicle::count())->toBe($vehicles)
        ->and(WorkOrder::count())->toBe(1);
});
