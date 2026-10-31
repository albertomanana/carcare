<?php

use App\Enums\WorkspaceRole;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\Contract;

/*
 * Forma JSON de cada respuesta frente a frontend/src/api/types.ts, campo a campo:
 * mismas claves (ni una más ni una menos) y mismos tipos (dinero como string con 2 decimales,
 * fechas 'YYYY-MM-DD', instantes ISO 8601, enums con los literales del contrato).
 * Las especificaciones están en tests/Support/Contract.php y se cruzan con types.ts.
 */

function typesTs(): ?string
{
    $path = base_path('../frontend/src/api/types.ts');

    return is_file($path) ? file_get_contents($path) : null;
}

/** Claves de primer nivel de `export interface {name} { … }` en types.ts. */
function tsInterfaceKeys(string $ts, string $name): array
{
    if (! preg_match('/^export interface '.$name.'(?:<[^>]*>)? \{\n(.*?)\n\}/ms', $ts, $m)) {
        return [];
    }
    preg_match_all('/^  (\w+)\??:/m', $m[1], $keys);

    return $keys[1];
}

/** Literales de `export type {name} = 'a' | 'b' …` en types.ts. */
function tsUnion(string $ts, string $name): array
{
    // Cada literal puede llevar un comentario de línea detrás (con comillas dentro, que no cuentan).
    if (! preg_match('/^export type '.$name.' =((?:\s*\|?\s*\'[^\']+\'(?:[ \t]*\/\/[^\n]*)?)+)/m', $ts, $m)) {
        return [];
    }
    preg_match_all("/'([^']+)'/", preg_replace('~//[^\n]*~', '', $m[1]), $values);

    return $values[1];
}

/** Comprueba la forma de `data` (o de todo el cuerpo si $root es null, p. ej. en listados paginados). */
function expectShape(TestResponse $response, array $spec, ?string $root = 'data'): TestResponse
{
    Contract::assert($root === null ? $response->json() : $response->json($root), $spec, $root ?? 'body');

    return $response;
}

function contractPdf(): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'carcare');
    file_put_contents($path, "%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");

    return new UploadedFile($path, 'factura.pdf', null, null, true);
}

/**
 * Mundo con todos los recursos y con los campos opcionales rellenos (para comprobar sus tipos):
 * Olga tiene un garaje personal con historial completo y un taller con un mecánico, un cliente y
 * órdenes en elevador, para hoy, con retraso y entregada.
 */
function contractWorld(): object
{
    Storage::fake('local');
    $t = test();

    $owner = makeUser('Olga Contrato', 'Taller Contrato');
    $pws = $owner->personalWorkspace();
    $wws = workshopOf($owner);
    $mechanic = addMember($wws, makeUser('Mario Contrato'), WorkspaceRole::Mechanic);
    loginAs($owner);

    // ── Garaje personal ──
    $vehicle = $t->postJson("/api/v1/workspaces/{$pws->id}/vehicles", [
        'make' => 'Seat', 'model' => 'Ibiza', 'nickname' => 'El rojo', 'version' => '1.0 TSI FR', 'year' => 2019,
        'fuel_type' => 'gasoline', 'transmission' => 'manual', 'engine' => '1.0 TSI 110 CV', 'body_type' => 'hatchback',
        'color_hex' => '#C0392B', 'plate' => '1234 BCD', 'vin' => 'VSSZZZKJZKR000001', 'purchase_date' => '2019-05-10',
        'purchase_mileage' => 12,
    ])->assertCreated()->json('data');
    $v = "/api/v1/vehicles/{$vehicle['id']}";

    $t->postJson("{$v}/mileage", ['recorded_at' => day(-120), 'mileage' => 30000, 'note' => 'Lectura inicial'])->assertCreated();
    $fuel = fn (int $daysAgo, int $km, string $liters, string $amount) => $t->postJson("{$v}/expenses", [
        'category' => 'fuel', 'amount' => $amount, 'expense_date' => day(-$daysAgo), 'mileage' => $km,
        'fuel_quantity' => $liters, 'full_tank' => true, 'description' => 'Gasolinera de ejemplo',
    ])->assertCreated()->json('data');
    $fuel(100, 30500, '40.00', '62.00');
    $fuel(60, 31200, '35.00', '54.25');
    $record = $t->postJson("{$v}/maintenance", [
        'type' => 'maintenance', 'zone' => 'engine', 'service_kind' => 'oil', 'title' => 'Cambio de aceite y filtro',
        'description' => 'Aceite 5W30', 'service_date' => day(-50), 'mileage' => 31400, 'workshop_name' => 'Taller Ejemplo',
        'parts_cost' => '45.00', 'labor_cost' => '30.00', 'total_cost' => '75.00',
        'items' => [
            ['kind' => 'fluid', 'name' => 'Aceite 5W30', 'part_number' => 'AC-530', 'quantity' => '4.5', 'unit_price' => '10.00'],
            ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1', 'unit_price' => '30.00'],
        ],
    ])->assertCreated()->json('data');
    $fuel(20, 31900, '38.00', '58.90');
    $expense = $t->postJson("{$v}/expenses", ['category' => 'parking', 'amount' => '3.50', 'expense_date' => day(-1), 'description' => 'Parking centro'])
        ->assertCreated()->json('data');
    $t->postJson("{$v}/mileage", ['recorded_at' => day(-1), 'mileage' => 32500])->assertCreated();

    $document = $t->post("{$v}/documents", [
        'file' => contractPdf(), 'title' => 'Factura aceite', 'document_type' => 'invoice',
        'maintenance_record_id' => $record['id'], 'expires_at' => day(365),
    ], ['Accept' => 'application/json'])->assertCreated()->json('data');

    $t->postJson("{$v}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(-2), 'notes' => 'Pedir cita'])->assertCreated();
    $t->postJson("{$v}/reminders", ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 33000, 'recurrence_km' => 15000])->assertCreated();
    $t->postJson("{$v}/reminders", ['title' => 'Impuesto', 'kind' => 'tax', 'due_date' => day(200), 'recurrence_months' => 12])->assertCreated();
    $done = $t->postJson("{$v}/reminders", ['title' => 'Escobillas', 'kind' => 'custom', 'due_date' => day(5), 'recurrence_months' => 6])
        ->assertCreated()->json('data');
    $completed = $t->postJson("/api/v1/reminders/{$done['id']}/complete", ['completed_at' => day(), 'mileage' => 32500])
        ->assertOk();

    // ── Taller ──
    $customer = $t->postJson("/api/v1/workspaces/{$wws->id}/customers", [
        'name' => 'Transportes Ejemplo SL', 'email' => 'flota@ejemplo.test', 'phone' => '600 000 010',
        'tax_id' => 'B00000000', 'notes' => 'Cliente de flota (ficticio)',
    ])->assertCreated()->json('data');
    $wvehicle = $t->postJson("/api/v1/workspaces/{$wws->id}/vehicles", [
        'make' => 'Ford', 'model' => 'Transit', 'body_type' => 'van', 'plate' => '5678 FGH', 'customer_id' => $customer['id'],
        'current_mileage' => 150000,
    ])->assertCreated()->json('data');
    $items = [['kind' => 'part', 'name' => 'Pastillas', 'part_number' => 'PF-2', 'quantity' => '1', 'unit_price' => '60.00']];
    $inBay = $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", [
        'vehicle_id' => $wvehicle['id'], 'title' => 'Frenos delanteros', 'complaint' => 'Chirrían', 'diagnosis' => 'Pastillas al límite',
        'priority' => 'high', 'bay' => 1, 'assigned_to' => $mechanic->id, 'mileage_in' => 150200,
        'promised_at' => today()->setTime(23, 59)->toIso8601String(), 'items' => $items,
    ])->assertCreated()->json('data');
    $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", [
        'vehicle_id' => $wvehicle['id'], 'title' => 'Revisión con retraso', 'promised_at' => now()->subDay()->toIso8601String(),
    ])->assertCreated();
    $delivered = $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", [
        'vehicle_id' => $wvehicle['id'], 'title' => 'Cambio de aceite', 'items' => $items,
    ])->assertCreated()->json('data');
    $t->postJson("/api/v1/work-orders/{$delivered['id']}/status", ['status' => 'delivered'])->assertOk();
    $t->postJson("/api/v1/vehicles/{$wvehicle['id']}/reminders", ['title' => 'ITV furgoneta', 'kind' => 'itv', 'due_date' => day(10)])->assertCreated();

    return (object) compact(
        'owner', 'mechanic', 'pws', 'wws', 'vehicle', 'v', 'record', 'expense', 'document', 'completed',
        'customer', 'wvehicle', 'inBay', 'delivered',
    );
}

// ───────────────────────── El contrato y las especificaciones coinciden ─────────────────────────

it('las especificaciones tienen las mismas claves que las interfaces de types.ts', function (string $interface) {
    $ts = typesTs() ?? $this->markTestSkipped('No se encuentra frontend/src/api/types.ts');

    $tsKeys = tsInterfaceKeys($ts, $interface);
    expect($tsKeys)->not->toBeEmpty("La interfaz {$interface} no está en types.ts")
        ->and(array_keys(Contract::interfaces()[$interface]))->toEqualCanonicalizing($tsKeys);
})->with(array_keys(Contract::interfaces()));

it('los enums PHP tienen exactamente los literales de types.ts', function (string $type) {
    $ts = typesTs() ?? $this->markTestSkipped('No se encuentra frontend/src/api/types.ts');
    $enum = Contract::enums()[$type];

    expect(tsUnion($ts, $type))->not->toBeEmpty("El tipo {$type} no está en types.ts")
        ->and(array_column($enum::cases(), 'value'))->toBe(tsUnion($ts, $type));
})->with(array_keys(Contract::enums()));

// ───────────────────────── Respuestas reales ─────────────────────────

it('health devuelve { status: ok }', function () {
    $this->getJson('/api/v1/health')->assertOk()->assertExactJson(['status' => 'ok']);
});

it('Me, Workspace y Member', function () {
    $w = contractWorld();

    $me = expectShape($this->getJson('/api/v1/me')->assertOk(), Contract::me());
    expect($me->json('data.workspaces'))->toHaveCount(2);
    $this->getJson('/api/v1/me')->assertJsonStructure(['data' => ['user' => ['id', 'name', 'email', 'locale', 'created_at'], 'workspaces' => [['id', 'name', 'type', 'role', 'settings' => ['bays_count', 'currency', 'tax_rate'], 'vehicles_count', 'members_count', 'created_at']]]]);
    expectShape($this->patchJson('/api/v1/me', ['name' => 'Olga Renombrada'])->assertOk(), Contract::me());

    expectShape($this->getJson('/api/v1/workspaces')->assertOk(), Contract::listOf(Contract::workspace()));
    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}")->assertOk(), Contract::workspace());
    expectShape($this->patchJson("/api/v1/workspaces/{$w->wws->id}", ['settings' => ['tax_rate' => '10.5']])->assertOk(), Contract::workspace());
    expectShape($this->postJson('/api/v1/workspaces', ['name' => 'Segundo Taller'])->assertCreated(), Contract::workspace());

    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/members")->assertOk(), Contract::listOf(Contract::member()));
    $nuevo = makeUser('Nuevo Gerente');
    expectShape($this->postJson("/api/v1/workspaces/{$w->wws->id}/members", ['email' => $nuevo->email, 'role' => 'manager'])->assertCreated(), Contract::member());
    expectShape($this->patchJson("/api/v1/workspaces/{$w->wws->id}/members/{$nuevo->id}", ['role' => 'mechanic'])->assertOk(), Contract::member());
});

it('Vehicle (detalle, listado paginado, escritura y vehículos del cliente)', function () {
    $w = contractWorld();

    $list = expectShape($this->getJson("/api/v1/workspaces/{$w->pws->id}/vehicles")->assertOk(), Contract::paginated(Contract::vehicle()), null);
    expect($list->json('data.0.stats.pending_reminders'))->toBe(4); // 3 + el siguiente de la recurrencia
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/vehicles")->assertJsonStructure(['data' => [['id', 'stats' => ['open_work_order']]], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

    // En el taller, open_work_order y customer vienen rellenos.
    $workshopVehicle = expectShape($this->getJson("/api/v1/vehicles/{$w->wvehicle['id']}")->assertOk(), Contract::vehicle());
    expect($workshopVehicle->json('data.stats.open_work_order'))->not->toBeNull()
        ->and($workshopVehicle->json('data.customer'))->not->toBeNull();

    expectShape($this->getJson($w->v)->assertOk(), Contract::vehicle());
    expectShape($this->patchJson($w->v, ['nickname' => 'Rojito'])->assertOk(), Contract::vehicle());
    expectShape($this->postJson("/api/v1/workspaces/{$w->pws->id}/vehicles", ['make' => 'Kia', 'model' => 'Sportage'])->assertCreated(), Contract::vehicle());
    expectShape($this->postJson("{$w->v}/archive")->assertOk(), Contract::vehicle());
    expectShape($this->postJson("{$w->v}/restore")->assertOk(), Contract::vehicle());
    expectShape($this->getJson("/api/v1/customers/{$w->customer['id']}/vehicles")->assertOk(), Contract::listOf(Contract::vehicle()));
});

it('MileageLog', function () {
    $w = contractWorld();

    $list = expectShape($this->getJson("{$w->v}/mileage")->assertOk(), Contract::paginated(Contract::mileageLog()), null);
    expect($list->json('data'))->not->toBeEmpty();
    expectShape($this->postJson("{$w->v}/mileage", ['recorded_at' => day(), 'mileage' => 32600, 'note' => 'Hoy'])->assertCreated(), Contract::mileageLog());
});

it('MaintenanceRecord con líneas', function () {
    $w = contractWorld();
    $r = "/api/v1/maintenance/{$w->record['id']}";

    $show = expectShape($this->getJson($r)->assertOk(), Contract::maintenanceRecord());
    expect($show->json('data.items'))->toHaveCount(2)
        ->and($show->json('data.expense_id'))->toBeInt()
        ->and($show->json('data.documents_count'))->toBe(1);

    expectShape($this->getJson("{$w->v}/maintenance")->assertOk(), Contract::paginated(Contract::maintenanceRecord()), null);
    expectShape($this->patchJson($r, ['title' => 'Aceite y filtros'])->assertOk(), Contract::maintenanceRecord());
    expectShape($this->postJson("{$r}/archive")->assertOk(), Contract::maintenanceRecord());
    expectShape($this->postJson("{$r}/restore")->assertOk(), Contract::maintenanceRecord());
    expectShape($this->postJson("{$w->v}/maintenance", ['type' => 'repair', 'zone' => 'body', 'title' => 'Retrovisor', 'service_date' => day()])->assertCreated(), Contract::maintenanceRecord());

    // La intervención creada al entregar una orden enlaza la orden.
    $fromOrder = $this->getJson("/api/v1/vehicles/{$w->wvehicle['id']}/maintenance")->assertOk();
    expectShape($fromOrder, Contract::paginated(Contract::maintenanceRecord()), null);
    expect($fromOrder->json('data.0.work_order_id'))->toBe($w->delivered['id']);
});

it('Expense', function () {
    $w = contractWorld();

    $list = expectShape($this->getJson("{$w->v}/expenses")->assertOk(), Contract::paginated(Contract::expense()), null);
    expect(collect($list->json('data'))->pluck('is_linked')->unique()->sort()->values()->all())->toBe([false, true]);
    expectShape($this->patchJson("/api/v1/expenses/{$w->expense['id']}", ['amount' => '4.00'])->assertOk(), Contract::expense());
    expectShape($this->postJson("{$w->v}/expenses", ['category' => 'tolls', 'amount' => '7.10', 'expense_date' => day()])->assertCreated(), Contract::expense());
});

it('Reminder, CompleteReminderResult y la agenda del espacio', function () {
    $w = contractWorld();

    expectShape($w->completed, Contract::completeReminderResult());
    expect($w->completed->json('data.next'))->not->toBeNull();

    $list = expectShape($this->getJson("{$w->v}/reminders?status=all")->assertOk(), Contract::listOf(Contract::reminder()));
    expect(collect($list->json('data'))->pluck('state')->filter()->unique()->sort()->values()->all())->toBe(['ok', 'overdue', 'soon']);

    $agenda = expectShape($this->getJson("/api/v1/workspaces/{$w->pws->id}/reminders")->assertOk(), Contract::paginated(Contract::reminder(true)), null);
    expect($agenda->json('meta.total'))->toBe(4);

    $id = $this->postJson("{$w->v}/reminders", ['title' => 'Neumáticos', 'kind' => 'tyres', 'due_mileage' => 60000])->assertCreated();
    expectShape($id, Contract::reminder());
    expectShape($this->patchJson("/api/v1/reminders/{$id->json('data.id')}", ['notes' => 'Delanteros'])->assertOk(), Contract::reminder());
    expectShape($this->postJson("/api/v1/reminders/{$id->json('data.id')}/dismiss")->assertOk(), Contract::reminder());
});

it('ZoneStatus', function () {
    $w = contractWorld();

    $zones = expectShape($this->getJson("{$w->v}/zones")->assertOk(), Contract::listOf(Contract::zoneStatus()));
    $engine = collect($zones->json('data'))->firstWhere('zone', 'engine');
    expect($zones->json('data'))->toHaveCount(10)
        ->and($engine['last_record'])->not->toBeNull()
        ->and($engine['next_reminder'])->not->toBeNull();
});

it('VehicleDocument', function () {
    $w = contractWorld();

    expectShape(TestResponse::fromBaseResponse(response()->json(['data' => $w->document])), Contract::vehicleDocument());
    $list = expectShape($this->getJson("{$w->v}/documents")->assertOk(), Contract::listOf(Contract::vehicleDocument()));
    expect($list->json('data.0.maintenance_record_id'))->toBe($w->record['id']);
});

it('JournalDay con los cinco tipos de entrada', function () {
    $w = contractWorld();

    $journal = expectShape($this->getJson("{$w->v}/journal?from=".day(-150).'&to='.day())->assertOk(), Contract::listOf(Contract::journalDay()));
    $types = collect($journal->json('data'))->flatMap(fn ($d) => array_column($d['entries'], 'type'))->unique()->sort()->values()->all();
    expect($types)->toBe(['document', 'expense', 'mileage', 'record', 'reminder_done']);
});

it('VehicleSummary con todas las cifras disponibles', function () {
    $w = contractWorld();

    $summary = expectShape($this->getJson("{$w->v}/summary?from=".day(-150).'&to='.day())->assertOk(), Contract::vehicleSummary());
    expect($summary->json('data.cost_per_km.available'))->toBeTrue()
        ->and($summary->json('data.consumption.available'))->toBeTrue()
        ->and($summary->json('data.records.last'))->not->toBeNull()
        ->and($summary->json('data.reminders.upcoming'))->not->toBeEmpty()
        ->and($summary->json('data.mileage.series'))->not->toBeEmpty()
        ->and(collect($summary->json('data.since_last'))->firstWhere('kind', 'oil')['record'])->not->toBeNull();
});

it('VehicleReport', function () {
    $w = contractWorld();

    $report = expectShape($this->getJson("{$w->v}/report")->assertOk(), Contract::vehicleReport());
    foreach (['records', 'mileage_logs', 'pending_reminders', 'documents', 'expenses.by_category', 'expenses.by_year'] as $list) {
        expect($report->json("data.{$list}"))->not->toBeEmpty();
    }
});

it('Customer', function () {
    $w = contractWorld();

    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/customers")->assertOk(), Contract::paginated(Contract::customer()), null);
    $show = expectShape($this->getJson("/api/v1/customers/{$w->customer['id']}")->assertOk(), Contract::customer());
    expect($show->json('data'))->vehicles_count->toBe(1)->open_orders_count->toBe(2);
    expectShape($this->patchJson("/api/v1/customers/{$w->customer['id']}", ['notes' => 'Paga a 30 días'])->assertOk(), Contract::customer());
});

it('CustomerExport y Customer anonimizado', function () {
    $w = contractWorld();

    $export = expectShape($this->postJson("/api/v1/customers/{$w->customer['id']}/export")->assertOk(), Contract::customerExport());
    expect($export->json('data.vehicles'))->toHaveCount(1)
        ->and($export->json('data.work_orders'))->toHaveCount(3)
        ->and($export->json('data.work_orders.0.items'))->not->toBeEmpty()
        ->and($export->json('data.customer.anonymized_at'))->toBeNull()
        ->and($export->headers->get('Cache-Control'))->toContain('no-store');

    $sinOrdenes = $this->postJson("/api/v1/workspaces/{$w->wws->id}/customers", ['name' => 'Cliente sin órdenes'])->json('data.id');
    $anonimizado = expectShape($this->postJson("/api/v1/customers/{$sinOrdenes}/anonymize")->assertOk(), Contract::customer());
    expect($anonimizado->json('data.anonymized_at'))->not->toBeNull();
    expectShape($this->postJson("/api/v1/customers/{$sinOrdenes}/export")->assertOk(), Contract::customerExport());
});

it('WorkOrder y Bay', function () {
    $w = contractWorld();
    $o = "/api/v1/work-orders/{$w->inBay['id']}";

    $list = expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/work-orders")->assertOk(), Contract::paginated(Contract::workOrder()), null);
    expect($list->json('meta.total'))->toBe(3);
    $show = expectShape($this->getJson($o)->assertOk(), Contract::workOrder());
    expect($show->json('data.assigned_to'))->toBe(['id' => $w->mechanic->id, 'name' => 'Mario Contrato'])
        ->and($show->json('data.number'))->toMatch('/^OT-\d{4}-\d{4}$/');
    expectShape($this->getJson("/api/v1/work-orders/{$w->delivered['id']}")->assertOk(), Contract::workOrder());
    expectShape($this->patchJson($o, ['diagnosis' => 'Discos también'])->assertOk(), Contract::workOrder());
    expectShape($this->postJson("{$o}/status", ['status' => 'in_progress'])->assertOk(), Contract::workOrder());

    $bays = expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/bays")->assertOk(), Contract::listOf(Contract::bay()));
    expect($bays->json('data.0.work_order.id'))->toBe($w->inBay['id']);
});

it('Activity paginada', function () {
    $w = contractWorld();

    $activity = expectShape($this->getJson("/api/v1/workspaces/{$w->pws->id}/activity")->assertOk(), Contract::paginated(Contract::activity()), null);
    expect($activity->json('data'))->not->toBeEmpty();
    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/activity")->assertOk(), Contract::paginated(Contract::activity()), null);
});

it('PersonalDashboard', function () {
    $w = contractWorld();

    $dashboard = expectShape($this->getJson("/api/v1/workspaces/{$w->pws->id}/dashboard")->assertOk(), Contract::personalDashboard());
    expect($dashboard->json('data.reminders.upcoming'))->not->toBeEmpty()
        ->and($dashboard->json('data.recent_activity'))->not->toBeEmpty();
});

it('WorkshopDashboard para el propietario y para el mecánico', function () {
    $w = contractWorld();

    $dashboard = expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/dashboard")->assertOk(), Contract::workshopDashboard());
    expect($dashboard->json('data.revenue'))->not->toBeNull()
        ->and($dashboard->json('data.due_today'))->not->toBeEmpty()
        ->and($dashboard->json('data.late'))->not->toBeEmpty()
        ->and($dashboard->json('data.fleet_alerts'))->not->toBeEmpty()
        ->and($dashboard->json('data.bays.0.work_order'))->not->toBeNull();

    loginAs($w->mechanic);
    $mechanic = expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/dashboard")->assertOk(), Contract::workshopDashboard());
    expect($mechanic->json('data.revenue'))->toBeNull();
});

it('WorkspaceAnalytics personal y de taller', function () {
    $w = contractWorld();

    $personal = expectShape($this->getJson("/api/v1/workspaces/{$w->pws->id}/analytics")->assertOk(), Contract::workspaceAnalytics());
    expect($personal->json('data.workshop'))->toBeNull()
        ->and($personal->json('data.by_category'))->not->toBeEmpty();

    $workshop = expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/analytics")->assertOk(), Contract::workspaceAnalytics());
    expect($workshop->json('data.workshop.by_customer'))->not->toBeEmpty()
        ->and($workshop->json('data.by_vehicle'))->not->toBeEmpty();
});

// ───────────────────────── E16: directorio, solicitudes y notificaciones (§3.13) ─────────────────────────

it('las entradas de E16 validan exactamente los campos de types.ts', function (string $interface, string $request) {
    $ts = typesTs() ?? $this->markTestSkipped('No se encuentra frontend/src/api/types.ts');

    $fields = array_values(array_filter(array_keys((new $request)->rules()), fn (string $key) => ! str_contains($key, '.')));

    expect(tsInterfaceKeys($ts, $interface))->not->toBeEmpty("La interfaz {$interface} no está en types.ts")
        ->and($fields)->toEqualCanonicalizing(tsInterfaceKeys($ts, $interface));
})->with([
    ['DirectoryProfileInput', \App\Http\Requests\Directory\DirectoryProfileRequest::class],
    ['RepairRequestInput', \App\Http\Requests\RepairRequest\StoreRepairRequestRequest::class],
    ['RepairRequestUpdateInput', \App\Http\Requests\RepairRequest\UpdateRepairRequestRequest::class],
    ['RepairQuoteInput', \App\Http\Requests\RepairRequest\RepairQuoteRequest::class],
    ['AcceptRepairRequestInput', \App\Http\Requests\RepairRequest\AcceptRepairRequestRequest::class],
    ['RejectRepairRequestInput', \App\Http\Requests\RepairRequest\RejectRepairRequestRequest::class],
    ['QuoteDecisionInput', \App\Http\Requests\RepairRequest\QuoteDecisionRequest::class],
    ['MarkNotificationsReadInput', \App\Http\Requests\Notification\MarkNotificationsReadRequest::class],
]);

it('DirectoryProfile: sin guardar (todo null), guardado y visto por los otros roles', function () {
    $w = e16World();
    $owner = makeUser('Dueña Nueva', 'Taller Sin Perfil');
    $ws = workshopOf($owner);
    $profile = "/api/v1/workspaces/{$ws->id}/directory-profile";
    loginAs($owner);

    $empty = expectShape($this->getJson($profile)->assertOk(), Contract::directoryProfile());
    expect($empty->json('data'))->toBe([
        'workspace_id' => $ws->id, 'listed' => false, 'city' => null, 'address' => null, 'phone' => null,
        'services' => [], 'opening_hours' => null, 'updated_at' => null,
    ]);

    $saved = expectShape($this->putJson($profile, [
        'listed' => true, 'city' => 'Lleida', 'address' => 'C/ Inventada, 3', 'phone' => '973 000 001',
        'services' => ['tyres', 'pre_itv'], 'opening_hours' => 'L-V 8:00-14:00',
    ])->assertOk(), Contract::directoryProfile());
    expect($saved->json('data.updated_at'))->not->toBeNull()
        ->and($saved->json('data.services'))->toBe(['tyres', 'pre_itv']);
    expectShape($this->getJson($profile)->assertOk(), Contract::directoryProfile());
    expectShape($this->putJson($profile, ['listed' => false])->assertOk(), Contract::directoryProfile());

    loginAs($w->mechanic);
    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/directory-profile")->assertOk(), Contract::directoryProfile());
});

it('DirectoryWorkshop: listado paginado, ficha, filtros e is_member', function () {
    $w = e16World();
    $sparse = makeUser('Dueña Mínima', 'Taller Mínimo');
    listWorkshop(workshopOf($sparse), ['address' => null, 'phone' => null, 'services' => [], 'opening_hours' => null]);
    $spec = Contract::paginated(Contract::directoryWorkshop());
    loginAs($w->client);

    $list = expectShape($this->getJson('/api/v1/workshops')->assertOk(), $spec, null);
    expect(array_column($list->json('data'), 'name'))->toBe(['Taller Destino', 'Taller Mínimo'])
        ->and(array_unique(array_column($list->json('data'), 'is_member')))->toBe([false]);
    expectShape($this->getJson('/api/v1/workshops?search=destino&service=brakes')->assertOk(), $spec, null);
    expectShape($this->getJson('/api/v1/workshops/'.workshopOf($sparse)->id)->assertOk(), Contract::directoryWorkshop());

    loginAs($w->owner);
    $mine = expectShape($this->getJson("/api/v1/workshops/{$w->wws->id}")->assertOk(), Contract::directoryWorkshop());
    expect($mine->json('data.is_member'))->toBeTrue();
});

it('RepairRequest y RepairQuote en todas las rutas, desde las dos partes y con los campos opcionales rellenos', function () {
    $w = e16World();
    $spec = Contract::repairRequest();
    $sent = "/api/v1/workspaces/{$w->pws->id}/repair-requests";
    $received = "/api/v1/workspaces/{$w->wws->id}/repair-requests";
    loginAs($w->client);

    // Crear (201) y leer como solicitante.
    $created = expectShape($this->postJson($sent, requestInput($w, ['share_history' => true]))->assertCreated(), $spec);
    $r = '/api/v1/repair-requests/'.$created->json('data.id');
    expect($created->json('data'))->toMatchArray(['perspective' => 'requester', 'status' => 'pending', 'vehicle_id' => $w->car->id, 'zone' => 'brakes', 'contact_phone' => '600 000 000']);
    expectShape($this->getJson($r)->assertOk(), $spec);
    expectShape($this->getJson($sent)->assertOk(), Contract::paginated($spec), null);
    expectShape($this->patchJson($r, ['share_history' => true])->assertOk(), $spec);

    // Leer y decidir como taller: el mecánico también lee, y nunca le llega el coche vivo.
    foreach (['mechanic', 'owner'] as $who) {
        loginAs($w->{$who});
        $inbox = expectShape($this->getJson($received)->assertOk(), Contract::paginated($spec), null);
        expect($inbox->json('data.0'))->toMatchArray(['perspective' => 'workshop', 'vehicle_id' => null]);
        expectShape($this->getJson($r)->assertOk(), $spec);
    }
    expectShape($this->postJson("{$r}/accept")->assertOk(), $spec);
    $v1 = expectShape($this->postJson("{$r}/quotes", quoteInput())->assertCreated(), $spec);
    expect($v1->json('data.quotes.0.note'))->toBe('Incluye revisión de discos.')
        ->and($v1->json('data.quotes.0.items.0.part_number'))->toBe('PF-1')
        ->and($v1->json('data.responded_at'))->not->toBeNull();

    // El cliente rechaza con motivo; el taller envía otra versión, sin nota.
    loginAs($w->client);
    $rejected = expectShape($this->postJson("{$r}/quote/reject", ['quote_id' => $v1->json('data.quotes.0.id'), 'reason' => 'Es caro'])->assertOk(), $spec);
    expect($rejected->json('data.quotes.0'))->toMatchArray(['status' => 'rejected', 'client_reason' => 'Es caro'])
        ->and($rejected->json('data.quotes.0.answered_at'))->not->toBeNull();
    loginAs($w->manager);
    $v2 = expectShape($this->postJson("{$r}/quotes", quoteInput(['note' => null, 'tax_rate' => '10']))->assertCreated(), $spec);
    expect($v2->json('data.quotes.0'))->toMatchArray(['version' => 2, 'note' => null, 'client_reason' => null, 'answered_at' => null, 'tax_rate' => '10.00']);

    // Conversión: la orden se ve dentro de la solicitud, con sus fechas según avanza.
    loginAs($w->client);
    $converted = expectShape($this->postJson("{$r}/quote/accept", ['quote_id' => $v2->json('data.quotes.0.id')])->assertOk(), $spec);
    expect($converted->json('data.work_order'))->toMatchArray(['status' => 'received', 'completed_at' => null, 'delivered_at' => null])
        ->and($converted->json('data.closed_at'))->not->toBeNull();
    loginAs($w->owner);
    $this->postJson('/api/v1/work-orders/'.$converted->json('data.work_order.id').'/status', ['status' => 'delivered'])->assertOk();
    loginAs($w->client);
    $delivered = expectShape($this->getJson($r)->assertOk(), $spec);
    expect($delivered->json('data.work_order.delivered_at'))->not->toBeNull()
        ->and($delivered->json('data.work_order.completed_at'))->not->toBeNull();

    // Lo que nace de la conversión es del taller y cumple su propio contrato (sin source_vehicle_id).
    loginAs($w->owner);
    expectShape($this->getJson('/api/v1/work-orders/'.$converted->json('data.work_order.id'))->assertOk(), Contract::workOrder());
    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/customers")->assertOk(), Contract::paginated(Contract::customer()), null);
    expectShape($this->getJson("/api/v1/workspaces/{$w->wws->id}/vehicles")->assertOk(), Contract::paginated(Contract::vehicle()), null);
    expectShape($this->getJson("{$received}?work_order_id=".$converted->json('data.work_order.id'))->assertOk(), Contract::paginated($spec), null);
});

it('RepairRequest aceptada con presupuesto, rechazada y cancelada', function () {
    $w = e16World();
    $spec = Contract::repairRequest();
    $second = makeVehicle($w->pws, ['plate' => '2222BBB']);
    $third = makeVehicle($w->pws, ['plate' => '3333CCC']);
    $quoted = sendRequest($w);
    $rejected = sendRequest($w, ['vehicle_id' => $second->id, 'mileage' => 0]);
    $cancelled = sendRequest($w, ['vehicle_id' => $third->id, 'mileage' => 0]);
    expectShape($this->postJson("/api/v1/repair-requests/{$cancelled}/cancel")->assertOk(), $spec);
    loginAs($w->owner);

    $withQuote = expectShape($this->postJson("/api/v1/repair-requests/{$quoted}/accept", ['quote' => quoteInput()])->assertOk(), $spec);
    expect($withQuote->json('data.status'))->toBe('quoted')->and($withQuote->json('data.quotes'))->toHaveCount(1);

    $no = expectShape($this->postJson("/api/v1/repair-requests/{$rejected}/reject", ['reason' => 'Agenda completa'])->assertOk(), $spec);
    expect($no->json('data.reject_reason'))->toBe('Agenda completa');
});

it('RepairRequest con todos los campos opcionales a null: sin matrícula, color, año, zona ni teléfono', function () {
    $w = e16World();
    $bare = makeVehicle($w->pws, ['plate' => null, 'fuel_type' => null, 'body_type' => null]);
    $w->wws->workshopProfile()->update(['phone' => null]);
    loginAs($w->client);

    $data = expectShape($this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, [
        'vehicle_id' => $bare->id, 'mileage' => 0, 'zone' => null, 'contact_phone' => null,
    ]))->assertCreated(), Contract::repairRequest());

    expect($data->json('data.vehicle'))->toBe([
        'make' => 'Seat', 'model' => 'Ibiza', 'year' => null, 'fuel_type' => null, 'body_type' => null,
        'color_hex' => null, 'plate' => null, 'display_name' => 'Seat Ibiza',
    ])->and($data->json('data.workshop.phone'))->toBeNull()
        ->and($data->json('data.zone'))->toBeNull()
        ->and($data->json('data.contact_phone'))->toBeNull();

    // Si el particular borra el coche, la solicitud sigue siendo legible con vehicle_id null.
    $this->postJson("/api/v1/vehicles/{$bare->id}/archive")->assertOk();
    $this->deleteJson("/api/v1/vehicles/{$bare->id}")->assertNoContent();
    $gone = expectShape($this->getJson('/api/v1/repair-requests/'.$data->json('data.id'))->assertOk(), Contract::repairRequest());
    expect($gone->json('data'))->toMatchArray(['vehicle_id' => null, 'status' => 'cancelled', 'history_available' => false]);
});

it('SharedHistoryEntry: solo sus 7 campos, para las dos partes y sin importes', function () {
    $w = e16World();
    $maintenance = app(\App\Services\MaintenanceService::class);
    $maintenance->create($w->car, [
        'type' => 'maintenance', 'zone' => 'engine', 'service_kind' => 'oil', 'title' => 'Aceite', 'description' => 'Privado',
        'service_date' => day(-60), 'mileage' => 80000, 'workshop_name' => 'Taller Ejemplo', 'total_cost' => '75.00',
    ]);
    $maintenance->create($w->car, ['type' => 'repair', 'zone' => 'body', 'title' => 'Retrovisor', 'service_date' => day(-5)]);
    $id = sendRequest($w, ['share_history' => true]);

    foreach ([$w->client, $w->mechanic] as $user) {
        loginAs($user);
        $history = expectShape($this->getJson("/api/v1/repair-requests/{$id}/history")->assertOk(), Contract::listOf(Contract::sharedHistoryEntry()));
        expect($history->json('data'))->toHaveCount(2);
    }
});

it('AppNotification, NotificationCount y marcar como leídas (204 sin cuerpo)', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);

    $list = expectShape($this->getJson('/api/v1/notifications')->assertOk(), Contract::paginated(Contract::appNotification()), null);
    expect($list->json('data.0'))->toMatchArray(['kind' => 'repair_request.received', 'workspace_id' => $w->wws->id, 'repair_request_id' => $id, 'read_at' => null])
        ->and(\Illuminate\Support\Str::isUuid($list->json('data.0.id')))->toBeTrue();
    $count = expectShape($this->getJson('/api/v1/notifications/count')->assertOk(), Contract::notificationCount());
    expect($count->json('data.unread'))->toBe(1);

    $read = $this->postJson('/api/v1/notifications/read', ['ids' => [$list->json('data.0.id')]])->assertNoContent();
    expect($read->getContent())->toBe('');

    $after = expectShape($this->getJson('/api/v1/notifications')->assertOk(), Contract::paginated(Contract::appNotification()), null);
    expect($after->json('data.0.read_at'))->not->toBeNull();
    expectShape($this->getJson('/api/v1/notifications?unread=1')->assertOk(), Contract::paginated(Contract::appNotification()), null);
});

it('los errores de E16 tienen la forma { message, errors? }', function () {
    $w = e16World();
    $id = sendRequest($w);
    $r = "/api/v1/repair-requests/{$id}";

    $this->postJson("{$r}/quote/accept", [])->assertUnprocessable()->assertJsonStructure(['message', 'errors' => ['quote_id']]);
    $responses = [
        $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w)), // 409 pareja abierta
        $this->postJson("{$r}/accept"),                                                        // 403 de la otra parte
        $this->getJson("{$r}/history"),                                                        // 403 sin historial
        $this->postJson("{$r}/quote/accept", ['quote_id' => 999999]),                          // 409 sin presupuesto
        $this->getJson('/api/v1/repair-requests/999999'),                                      // 404
        $this->getJson('/api/v1/workshops/999999'),                                            // 404
    ];
    foreach ($responses as $response) {
        expect(array_keys($response->json()))->toBe(['message']);
    }

    foreach (range(1, 4) as $i) {
        $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 0]))->assertCreated();
    }
    $tooMany = $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 0]))->assertStatus(429);
    expect(array_keys($tooMany->json()))->toBe(['message']);
});

it('los errores tienen la forma { message, errors? }', function () {
    $w = contractWorld();

    $this->postJson("{$w->v}/mileage", [])->assertUnprocessable()
        ->assertJsonStructure(['message', 'errors' => ['recorded_at', 'mileage']]);
    foreach ([
        $this->getJson('/api/v1/vehicles/999999'),
        $this->deleteJson($w->v),
        $this->postJson("/api/v1/work-orders/{$w->delivered['id']}/status", ['status' => 'ready']),
    ] as $response) {
        expect(array_keys($response->json()))->toBe(['message']);
    }
});
