<?php

use App\Services\SummaryService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;

/*
 * Cifras con datos conocidos (contrato §4). Nada se inventa: si falta un dato, available = false y el motivo.
 */

beforeEach(function () {
    $this->user = makeUser('Ana Cifras');
    loginAs($this->user);
    $this->ws = $this->user->personalWorkspace();
    $this->vehicle = makeVehicle($this->ws);
    $this->v = "/api/v1/vehicles/{$this->vehicle->id}";
});

/** Repostajes lleno-a-lleno: 1.000 km, 60 l entre llenos ⇒ 6,00 l/100 km; gasto total 200 € ⇒ 0,20 €/km. */
function knownFuelData(string $v): void
{
    test()->postJson("{$v}/mileage", ['recorded_at' => day(-90), 'mileage' => 10000])->assertCreated();
    $fuel = fn (int $daysAgo, int $km, string $liters, string $amount, bool $full) => test()->postJson("{$v}/expenses", [
        'category' => 'fuel', 'amount' => $amount, 'expense_date' => day(-$daysAgo), 'mileage' => $km,
        'fuel_quantity' => $liters, 'full_tank' => $full,
    ])->assertCreated();

    $fuel(90, 10000, '40.00', '60.00', true);
    $fuel(70, 10500, '30.00', '45.00', true);
    $fuel(60, 10700, '10.00', '15.00', false); // parcial: se suma al siguiente lleno
    $fuel(50, 11000, '20.00', '30.00', true);
    test()->postJson("{$v}/expenses", ['category' => 'parking', 'amount' => '50.00', 'expense_date' => day(-55)])->assertCreated();
}

it('calcula coste por km y consumo lleno-a-lleno con datos conocidos', function () {
    knownFuelData($this->v);

    $this->getJson("{$this->v}/summary?from=".day(-100).'&to='.day())
        ->assertOk()
        ->assertJsonPath('data.period', ['from' => day(-100), 'to' => day()])
        ->assertJsonPath('data.totals.period', '200.00')
        ->assertJsonPath('data.totals.previous_period', null)
        ->assertJsonPath('data.totals.change_pct', null)
        ->assertJsonPath('data.cost_per_km', ['available' => true, 'reason' => null, 'value' => '0.20', 'km' => 1000])
        ->assertJsonPath('data.consumption', ['available' => true, 'reason' => null, 'value' => '6.00', 'unit' => 'l/100km', 'fills' => 3])
        ->assertJsonPath('data.by_category.0', ['category' => 'fuel', 'total' => '150.00', 'count' => 4])
        ->assertJsonPath('data.by_category.1', ['category' => 'parking', 'total' => '50.00', 'count' => 1])
        ->assertJsonCount(12, 'data.by_month')
        ->assertJsonPath('data.by_month.11.month', today()->format('Y-m'))
        ->assertJsonPath('data.mileage.current', 11000);
});

it('compara con el periodo anterior de la misma duración', function () {
    $this->postJson("{$this->v}/expenses", ['category' => 'tolls', 'amount' => '100.00', 'expense_date' => day(-15)]);
    $this->postJson("{$this->v}/expenses", ['category' => 'tolls', 'amount' => '150.00', 'expense_date' => day(-5)]);

    $this->getJson("{$this->v}/summary?from=".day(-9).'&to='.day())
        ->assertJsonPath('data.totals.period', '150.00')
        ->assertJsonPath('data.totals.previous_period', '100.00')
        ->assertJsonPath('data.totals.change_pct', 50);
});

it('explica qué falta cuando no hay datos suficientes', function () {
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-3), 'mileage' => 5000]);

    $this->getJson("{$this->v}/summary")
        ->assertOk()
        ->assertJsonPath('data.cost_per_km', ['available' => false, 'reason' => SummaryService::COST_PER_KM_REASON, 'value' => null, 'km' => null])
        ->assertJsonPath('data.consumption.available', false)
        ->assertJsonPath('data.consumption.reason', SummaryService::CONSUMPTION_REASON)
        ->assertJsonPath('data.consumption.fills', 0)
        ->assertJsonPath('data.mileage.avg_daily_km', null)
        ->assertJsonPath('data.period.from', today()->startOfYear()->toDateString());
});

it('calcula “desde el último” cambio de aceite con días y km', function () {
    $this->postJson("{$this->v}/maintenance", ['type' => 'maintenance', 'zone' => 'engine', 'service_kind' => 'oil', 'title' => 'Aceite', 'service_date' => day(-40), 'mileage' => 20000]);
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(), 'mileage' => 21500]);

    $since = collect($this->getJson("{$this->v}/summary")->json('data.since_last'))->keyBy('kind');
    expect($since['oil'])->days->toBe(40)->km->toBe(1500)->label->toBe('Cambio de aceite')
        ->and($since['itv']['record'])->toBeNull()
        ->and($since['itv']['days'])->toBeNull();
});

it('el diario agrupa por día con km recorridos y gasto', function () {
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-2), 'mileage' => 1000]);
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-1), 'mileage' => 1080, 'note' => 'Al trabajo']);
    $this->postJson("{$this->v}/expenses", ['category' => 'parking', 'amount' => '20.00', 'expense_date' => day(-1)]);
    $this->postJson("{$this->v}/maintenance", ['type' => 'repair', 'zone' => 'body', 'title' => 'Retrovisor', 'service_date' => day(-1), 'total_cost' => '100.00']);

    $days = $this->getJson("{$this->v}/journal")->assertOk()->json('data');

    expect($days)->toHaveCount(2)
        ->and($days[0])->date->toBe(day(-1))->km_driven->toBe(80)->spent->toBe('120.00')
        ->and(array_column($days[0]['entries'], 'type'))->toBe(['record', 'expense', 'mileage'])
        ->and($days[0]['entries'][2]['title'])->toBe('Al trabajo')
        ->and($days[1])->date->toBe(day(-2))->km_driven->toBeNull()->spent->toBe('0.00');
});

it('devuelve las 10 zonas en orden con su base (recordatorios, historial o nada)', function () {
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(), 'mileage' => 30000]);
    $this->postJson("{$this->v}/reminders", ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 29000]);
    $this->postJson("{$this->v}/maintenance", ['type' => 'maintenance', 'zone' => 'brakes', 'title' => 'Pastillas', 'service_date' => day(-10)]);

    $zones = $this->getJson("{$this->v}/zones")->assertOk()->assertJsonCount(10, 'data')->json('data');

    expect(array_column($zones, 'zone'))->toBe(['engine', 'transmission', 'brakes', 'tyres', 'suspension', 'electrical', 'body', 'interior', 'exhaust', 'general'])
        ->and(array_column($zones, 'label'))->toBe(['Motor', 'Transmisión', 'Frenos', 'Neumáticos', 'Suspensión y dirección', 'Eléctrico y batería', 'Carrocería', 'Interior y climatización', 'Escape', 'General'])
        ->and($zones[0])->state->toBe('overdue')->basis->toBe('reminders')
        ->and($zones[0]['next_reminder']['title'])->toBe('Aceite')
        ->and($zones[2])->state->toBe('unknown')->basis->toBe('records')->records_count->toBe(1)
        ->and($zones[2]['last_record']['title'])->toBe('Pastillas')
        ->and($zones[1])->state->toBe('unknown')->basis->toBe('none')->last_record->toBeNull();
});

it('el dashboard personal resume vehículos, gasto, recordatorios y actividad', function () {
    $this->postJson("{$this->v}/expenses", ['category' => 'cleaning', 'amount' => '12.50', 'expense_date' => day()]);
    $this->postJson("{$this->v}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(-1)]);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('data.type', 'personal')
        ->assertJsonCount(1, 'data.vehicles')
        ->assertJsonPath('data.vehicles.0.stats.overdue_reminders', 1)
        ->assertJsonPath('data.spend.month', '12.50')
        ->assertJsonCount(12, 'data.spend.by_month')
        ->assertJsonPath('data.reminders.overdue', 1)
        ->assertJsonPath('data.reminders.upcoming.0.vehicle.id', $this->vehicle->id)
        ->assertJsonPath('data.recent_activity.0.user.name', 'Ana Cifras')
        ->assertJsonStructure(['data' => ['recent_activity' => [['id', 'action', 'entity_type', 'entity_id', 'summary', 'user', 'vehicle_id', 'created_at']]]]);
});

it('la analítica personal sale solo de los gastos', function () {
    knownFuelData($this->v);
    $this->postJson("{$this->v}/maintenance", ['type' => 'repair', 'zone' => 'engine', 'title' => 'Bujías', 'service_date' => day(-20), 'total_cost' => '80.00']);

    $this->getJson("/api/v1/workspaces/{$this->ws->id}/analytics?from=".day(-100).'&to='.day())
        ->assertOk()
        ->assertJsonPath('data.total', '280.00')
        ->assertJsonPath('data.by_vehicle.0.vehicle.id', $this->vehicle->id)
        ->assertJsonPath('data.by_vehicle.0.total', '280.00')
        ->assertJsonPath('data.workshop', null)
        ->assertJsonPath('data.by_category.0.category', 'fuel');
});

it('la analítica del taller usa la facturación de órdenes entregadas', function () {
    $owner = makeUser('Dueño', 'Taller Cifras');
    loginAs($owner);
    $ws = workshopOf($owner);
    $customer = $ws->customers()->create(['name' => 'Cliente Fiel']);
    $vehicle = makeVehicle($ws, ['customer_id' => $customer->id]);

    foreach (['100.00', '50.00'] as $price) {
        $id = $this->postJson("/api/v1/workspaces/{$ws->id}/work-orders", [
            'vehicle_id' => $vehicle->id, 'title' => 'Trabajo', 'tax_rate' => '0',
            'items' => [['kind' => 'labor', 'name' => 'Mano de obra', 'quantity' => '1', 'unit_price' => $price]],
        ])->json('data.id');
        $this->postJson("/api/v1/work-orders/{$id}/status", ['status' => 'delivered'])->assertOk();
    }

    $this->getJson("/api/v1/workspaces/{$ws->id}/analytics")
        ->assertOk()
        ->assertJsonPath('data.total', '150.00')
        ->assertJsonPath('data.by_category', [])
        ->assertJsonPath('data.workshop.orders_delivered', 2)
        ->assertJsonPath('data.workshop.avg_ticket', '75.00')
        ->assertJsonPath('data.workshop.by_customer.0', ['customer' => ['id' => $customer->id, 'name' => 'Cliente Fiel', 'phone' => null], 'total' => '150.00', 'orders' => 2])
        ->assertJsonCount(12, 'data.by_month');

    $this->getJson("/api/v1/workspaces/{$ws->id}/dashboard")
        ->assertJsonPath('data.revenue.month', '150.00')
        ->assertJsonPath('data.orders_by_status.delivered', 2)
        ->assertJsonPath('data.counts.open_orders', 0);
});

it('genera el informe completo del vehículo', function () {
    knownFuelData($this->v);

    $this->getJson("{$this->v}/report")
        ->assertOk()
        ->assertJsonPath('data.vehicle.id', $this->vehicle->id)
        ->assertJsonPath('data.expenses.total', '200.00')
        ->assertJsonPath('data.expenses.by_year.0.total', fn ($t) => is_string($t))
        ->assertJsonStructure(['data' => ['generated_at', 'vehicle', 'records', 'expenses' => ['total', 'by_category', 'by_year'], 'mileage_logs', 'pending_reminders', 'documents']]);
});

// ───────────────────────── Totales exactos con fecha fija ─────────────────────────

/**
 * Gastos conocidos con «hoy» = 15/03/2026. La intervención de 120,01 € genera su gasto vinculado.
 * Periodo por defecto: 01/01/2026–15/03/2026 (74 días) ⇒ anterior: 19/10/2025–31/12/2025.
 */
function knownExpenses(string $v): int
{
    test()->travelTo(CarbonImmutable::parse('2026-03-15 12:00'));
    foreach ([
        ['tolls', '30.00', '2025-12-20'],
        ['fuel', '50.00', '2026-01-10'],
        ['insurance', '300.00', '2026-02-05'],
        ['parking', '2.50', '2026-03-01'],
        ['fuel', '49.99', '2026-03-14'],
    ] as [$category, $amount, $date]) {
        test()->postJson("{$v}/expenses", ['category' => $category, 'amount' => $amount, 'expense_date' => $date])->assertCreated();
    }

    return test()->postJson("{$v}/maintenance", [
        'type' => 'repair', 'zone' => 'brakes', 'title' => 'Discos delanteros', 'service_date' => '2026-03-10', 'total_cost' => '120.01',
    ])->assertCreated()->json('data.id');
}

/** 12 meses que acaban en marzo de 2026 con los totales de knownExpenses(). */
function knownMonths(): array
{
    return array_merge(
        array_fill_keys(['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11'], '0.00'),
        ['2025-12' => '30.00', '2026-01' => '50.00', '2026-02' => '300.00', '2026-03' => '172.50'],
    );
}

it('los totales del resumen son exactos: periodo, mes, año, meses, categorías y variación', function () {
    knownExpenses($this->v);

    $summary = $this->getJson("{$this->v}/summary")->assertOk()
        ->assertJsonPath('data.period', ['from' => '2026-01-01', 'to' => '2026-03-15'])
        // 50 + 300 + 2,50 + 49,99 + 120,01 · marzo: 2,50 + 49,99 + 120,01 · (522,50 − 30) / 30 × 100 = 1641,67 %
        ->assertJsonPath('data.totals', ['period' => '522.50', 'month' => '172.50', 'year' => '522.50', 'previous_period' => '30.00', 'change_pct' => 1641.7])
        ->assertJsonPath('data.by_category', [
            ['category' => 'insurance', 'total' => '300.00', 'count' => 1],
            ['category' => 'repair', 'total' => '120.01', 'count' => 1],
            ['category' => 'fuel', 'total' => '99.99', 'count' => 2],
            ['category' => 'parking', 'total' => '2.50', 'count' => 1],
        ]);

    expect(collect($summary->json('data.by_month'))->pluck('total', 'month')->all())->toBe(knownMonths());

    // Febrero (28 días) se compara con 04/01–31/01, que incluye el repostaje de 50 €.
    $this->getJson("{$this->v}/summary?from=2026-02-01&to=2026-02-28")
        ->assertJsonPath('data.totals', ['period' => '300.00', 'month' => '300.00', 'year' => '522.50', 'previous_period' => '50.00', 'change_pct' => 500]);

    // Diciembre de 2025: el periodo anterior (31/10–30/11) no tiene gastos ⇒ sin comparación.
    $this->getJson("{$this->v}/summary?from=2025-12-01&to=2025-12-31")
        ->assertJsonPath('data.totals', ['period' => '30.00', 'month' => '30.00', 'year' => '30.00', 'previous_period' => null, 'change_pct' => null]);

    // Bajada: 20/02–15/03 (24 días, 172,50) frente a 27/01–19/02 (el seguro de 300,00) ⇒ −42,5 %.
    $this->getJson("{$this->v}/summary?from=2026-02-20&to=2026-03-15")
        ->assertJsonPath('data.totals.period', '172.50')
        ->assertJsonPath('data.totals.previous_period', '300.00')
        ->assertJsonPath('data.totals.change_pct', -42.5);
});

it('una intervención con coste cuenta una sola vez en resumen, dashboard, analítica, informe, gastos y diario', function () {
    $recordId = knownExpenses($this->v);
    $ws = "/api/v1/workspaces/{$this->ws->id}";

    $this->getJson("{$this->v}/expenses")->assertJsonPath('meta.total', 6)
        ->assertJsonPath('data', fn ($data) => collect($data)->where('is_linked', true)->count() === 1);
    $this->getJson("{$this->v}/summary")->assertJsonPath('data.totals.period', '522.50');

    $dashboard = $this->getJson("{$ws}/dashboard")->assertOk()
        ->assertJsonPath('data.spend.month', '172.50')
        ->assertJsonPath('data.spend.year', '522.50');
    expect(collect($dashboard->json('data.spend.by_month'))->pluck('total', 'month')->all())->toBe(knownMonths());

    // Analítica por defecto: últimos 12 meses (abril 2025 – hoy).
    $this->getJson("{$ws}/analytics")->assertOk()
        ->assertJsonPath('data.period', ['from' => '2025-04-01', 'to' => '2026-03-15'])
        ->assertJsonPath('data.total', '552.50')
        ->assertJsonPath('data.by_vehicle.0.total', '552.50')
        ->assertJsonPath('data.by_category.1', ['category' => 'repair', 'total' => '120.01', 'count' => 1]);

    $this->getJson("{$this->v}/report")
        ->assertJsonPath('data.expenses.total', '552.50')
        ->assertJsonPath('data.expenses.by_year', [['year' => 2025, 'total' => '30.00'], ['year' => 2026, 'total' => '522.50']]);

    // En el diario el gasto vinculado no aparece como entrada propia: solo la intervención.
    $day = collect($this->getJson("{$this->v}/journal")->json('data'))->firstWhere('date', '2026-03-10');
    expect($day['spent'])->toBe('120.01')
        ->and($day['entries'])->toHaveCount(1)
        ->and($day['entries'][0])->type->toBe('record')->amount->toBe('120.01');

    // Archivada deja de contar en todas partes; restaurada vuelve a contar una sola vez.
    $this->postJson("/api/v1/maintenance/{$recordId}/archive")->assertOk();
    $this->getJson("{$this->v}/summary")->assertJsonPath('data.totals.period', '402.49');
    $this->getJson("{$ws}/analytics")->assertJsonPath('data.total', '432.49');
    $this->getJson("{$ws}/dashboard")->assertJsonPath('data.spend.month', '52.49');

    $this->postJson("/api/v1/maintenance/{$recordId}/restore")->assertOk();
    $this->getJson("{$this->v}/summary")->assertJsonPath('data.totals.period', '522.50');
    $this->getJson("{$ws}/analytics")->assertJsonPath('data.total', '552.50');
});

it('calcula km del mes, del año, media diaria, serie y coste por km con lecturas conocidas', function () {
    $this->travelTo(CarbonImmutable::parse('2026-03-15 12:00'));
    foreach (['2025-12-31' => 10000, '2026-01-15' => 10600, '2026-02-28' => 11500, '2026-03-05' => 11800, '2026-03-15' => 12100] as $date => $km) {
        $this->postJson("{$this->v}/mileage", ['recorded_at' => $date, 'mileage' => $km])->assertCreated();
    }
    $this->postJson("{$this->v}/expenses", ['category' => 'insurance', 'amount' => '300.00', 'expense_date' => '2026-02-01'])->assertCreated();

    $this->getJson("{$this->v}/summary")->assertOk()
        ->assertJsonPath('data.mileage.current', 12100)
        ->assertJsonPath('data.mileage.updated_at', '2026-03-15')
        ->assertJsonPath('data.mileage.km_this_month', 600)    // 12.100 − 11.500 (última antes del 1 de marzo)
        ->assertJsonPath('data.mileage.km_this_year', 2100)    // 12.100 − 10.000 (última de 2025)
        ->assertJsonPath('data.mileage.avg_daily_km', 28.4)    // 2.100 km / 74 días (ventana de 90 días)
        ->assertJsonPath('data.mileage.series', [
            ['date' => '2025-12-31', 'mileage' => 10000], ['date' => '2026-01-15', 'mileage' => 10600],
            ['date' => '2026-02-28', 'mileage' => 11500], ['date' => '2026-03-05', 'mileage' => 11800],
            ['date' => '2026-03-15', 'mileage' => 12100],
        ])
        // Lecturas del periodo (15/01–15/03): 1.500 km en 59 días · 300 € / 1.500 km
        ->assertJsonPath('data.cost_per_km', ['available' => true, 'reason' => null, 'value' => '0.20', 'km' => 1500]);
});

it('el coste por km exige lecturas separadas al menos 500 km y 30 días', function (int $km, int $days, bool $available) {
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-$days), 'mileage' => 10000])->assertCreated();
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(), 'mileage' => 10000 + $km])->assertCreated();
    $this->postJson("{$this->v}/expenses", ['category' => 'tolls', 'amount' => '100.00', 'expense_date' => day()])->assertCreated();

    $this->getJson("{$this->v}/summary?from=".day(-60).'&to='.day())
        ->assertJsonPath('data.cost_per_km.available', $available)
        ->assertJsonPath('data.cost_per_km.value', $available ? '0.20' : null)
        ->assertJsonPath('data.cost_per_km.reason', $available ? null : SummaryService::COST_PER_KM_REASON);
})->with([
    'justo 500 km y 30 días' => [500, 30, true],
    '499 km' => [499, 30, false],
    '29 días' => [500, 29, false],
]);

it('calcula el consumo de un eléctrico en kWh/100 km', function () {
    $ev = makeVehicle($this->ws, ['make' => 'Renault', 'model' => 'Zoe', 'fuel_type' => 'electric']);
    foreach ([[40, 20000, '30.00'], [20, 20400, '60.00'], [10, 20600, '30.00']] as [$daysAgo, $km, $kwh]) {
        $this->postJson("/api/v1/vehicles/{$ev->id}/expenses", [
            'category' => 'fuel', 'amount' => '9.00', 'expense_date' => day(-$daysAgo), 'mileage' => $km, 'fuel_quantity' => $kwh, 'full_tank' => true,
        ])->assertCreated()->assertJsonPath('data.fuel_unit', 'kwh');
    }

    // (60 + 30) kWh / 600 km × 100
    $this->getJson("/api/v1/vehicles/{$ev->id}/summary?from=".day(-60).'&to='.day())
        ->assertJsonPath('data.consumption', ['available' => true, 'reason' => null, 'value' => '15.00', 'unit' => 'kwh/100km', 'fills' => 3]);
});

it('el diario omite días sin eventos, respeta los últimos 30 días e incluye recordatorios y documentos', function () {
    Storage::fake('local');
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-40), 'mileage' => 5000])->assertCreated();
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(-10), 'mileage' => 5100])->assertCreated();
    $this->postJson("{$this->v}/maintenance", ['type' => 'maintenance', 'zone' => 'general', 'title' => 'Revisión', 'service_date' => day(-10), 'total_cost' => '80.00'])->assertCreated();
    $reminder = $this->postJson("{$this->v}/reminders", ['title' => 'Escobillas', 'kind' => 'custom', 'due_date' => day(5)])->json('data.id');
    $this->postJson("/api/v1/reminders/{$reminder}/complete", ['completed_at' => day(-3), 'mileage' => 5300])->assertOk();
    makeDocument($this->vehicle, 'Factura revisión');

    $days = $this->getJson("{$this->v}/journal")->assertOk()->json('data');

    expect(array_column($days, 'date'))->toBe([day(), day(-3), day(-10)])
        ->and($days[0])->km_driven->toBeNull()->spent->toBe('0.00')
        ->and(array_column($days[0]['entries'], 'type'))->toBe(['document'])
        ->and($days[1])->km_driven->toBe(200)->spent->toBe('0.00')
        ->and($days[1]['entries'][0])->type->toBe('reminder_done')->mileage->toBe(5300)
        ->and($days[2])->km_driven->toBe(100)->spent->toBe('80.00')
        ->and(array_column($days[2]['entries'], 'type'))->toBe(['record', 'mileage']);

    $this->getJson("{$this->v}/journal?from=".day(-45).'&to='.day(-35))->assertJsonCount(1, 'data')->assertJsonPath('data.0.date', day(-40));
    $this->getJson("{$this->v}/journal?from=".day().'&to='.day(-5))
        ->assertUnprocessable()
        ->assertJsonPath('errors.to.0', 'La fecha de fin no puede ser anterior a la de inicio.');
});

it('cada zona toma el peor estado de sus recordatorios pendientes e ignora archivados, hechos y descartados', function () {
    $this->postJson("{$this->v}/mileage", ['recorded_at' => day(), 'mileage' => 40000])->assertCreated();
    $this->postJson("{$this->v}/reminders", ['title' => 'Aceite', 'kind' => 'oil', 'due_mileage' => 45000])->assertCreated();                 // ok
    $this->postJson("{$this->v}/reminders", ['title' => 'Correa', 'kind' => 'timing_belt', 'due_mileage' => 40500])->assertCreated();         // soon
    $this->postJson("{$this->v}/reminders", ['title' => 'Fuga', 'kind' => 'custom', 'zone' => 'engine', 'due_date' => day(-1)])->assertCreated(); // overdue
    $this->postJson("{$this->v}/reminders", ['title' => 'Batería', 'kind' => 'battery', 'due_date' => day(200)])->assertCreated();            // ok
    $brakes = $this->postJson("{$this->v}/reminders", ['title' => 'Pastillas', 'kind' => 'brakes', 'due_date' => day(5)])->json('data.id');
    $this->postJson("/api/v1/reminders/{$brakes}/dismiss")->assertOk();
    $tyres = $this->postJson("{$this->v}/reminders", ['title' => 'Neumáticos', 'kind' => 'tyres', 'due_date' => day(5)])->json('data.id');
    $this->postJson("/api/v1/reminders/{$tyres}/complete", ['completed_at' => day()])->assertOk();
    $archived = $this->postJson("{$this->v}/maintenance", ['type' => 'bodywork', 'zone' => 'body', 'title' => 'Golpe', 'service_date' => day(-5)])->json('data.id');
    $this->postJson("/api/v1/maintenance/{$archived}/archive")->assertOk();
    $this->postJson("{$this->v}/maintenance", ['type' => 'repair', 'zone' => 'exhaust', 'title' => 'Silencioso', 'service_date' => day(-20)])->assertCreated();

    $zones = collect($this->getJson("{$this->v}/zones")->assertOk()->json('data'))->keyBy('zone');

    expect($zones['engine'])->state->toBe('overdue')->basis->toBe('reminders')
        ->and($zones['engine']['next_reminder']['title'])->toBe('Fuga')
        ->and($zones['electrical'])->state->toBe('ok')->basis->toBe('reminders')
        ->and($zones['brakes'])->state->toBe('unknown')->basis->toBe('none')->next_reminder->toBeNull()
        ->and($zones['tyres'])->state->toBe('unknown')->basis->toBe('none')
        ->and($zones['body'])->state->toBe('unknown')->basis->toBe('none')->records_count->toBe(0)->last_record->toBeNull()
        ->and($zones['exhaust'])->state->toBe('unknown')->basis->toBe('records')->records_count->toBe(1)
        ->and($zones['exhaust']['last_record']['title'])->toBe('Silencioso');
});
