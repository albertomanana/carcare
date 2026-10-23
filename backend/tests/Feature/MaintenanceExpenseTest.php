<?php

use App\Models\Expense;

/*
 * D3-A (ADR-0003): en espacios personales una intervención con coste mantiene UN gasto vinculado;
 * todos los totales salen solo de `expenses`, así que nunca se cuenta dos veces.
 */

beforeEach(function () {
    $this->user = makeUser();
    loginAs($this->user);
    $this->vehicle = makeVehicle($this->user->personalWorkspace());
    $this->base = "/api/v1/vehicles/{$this->vehicle->id}";
});

function record(array $overrides = []): array
{
    return array_merge([
        'type' => 'repair', 'zone' => 'brakes', 'service_kind' => 'brakes', 'title' => 'Pastillas delanteras',
        'service_date' => day(-2), 'mileage' => 30000, 'workshop_name' => 'Taller Ejemplo',
        'items' => [
            ['kind' => 'part', 'name' => 'Pastillas', 'part_number' => 'PF-1', 'quantity' => '1', 'unit_price' => '42.60'],
            ['kind' => 'labor', 'name' => 'Mano de obra', 'part_number' => null, 'quantity' => '1.5', 'unit_price' => '45.00'],
        ],
    ], $overrides);
}

it('crea una intervención con líneas y un gasto vinculado con el total', function () {
    $response = $this->postJson("{$this->base}/maintenance", record())->assertCreated();

    $response->assertJsonPath('data.total_cost', '110.10')
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.items.0.total', '42.60')
        ->assertJsonPath('data.items.1.quantity', '1.50')
        ->assertJsonPath('data.items.1.total', '67.50')
        ->assertJsonPath('data.work_order_id', null)
        ->assertJsonPath('data.documents_count', 0);

    $expense = Expense::findOrFail($response->json('data.expense_id'));
    expect($expense)
        ->category->value->toBe('repair')
        ->amount->toBe('110.10')
        ->description->toBe('Pastillas delanteras')
        ->mileage->toBe(30000)
        ->and($expense->expense_date->toDateString())->toBe(day(-2));

    // Sin doble conteo: el resumen suma 110,10 una sola vez.
    $this->getJson("{$this->base}/summary?from=".day(-30).'&to='.day())
        ->assertOk()
        ->assertJsonPath('data.totals.period', '110.10')
        ->assertJsonPath('data.by_category.0.category', 'repair')
        ->assertJsonPath('data.by_category.0.count', 1);
});

it('elige la categoría del gasto según el tipo de intervención', function (string $type, string $category) {
    $this->postJson("{$this->base}/maintenance", record(['type' => $type, 'total_cost' => '10.00', 'items' => []]))->assertCreated();

    expect(Expense::first()->category->value)->toBe($category);
})->with([
    ['repair', 'repair'], ['breakdown', 'repair'], ['bodywork', 'repair'],
    ['inspection', 'inspection'], ['maintenance', 'maintenance'], ['tyres', 'maintenance'], ['other', 'maintenance'],
]);

it('actualiza, elimina y recrea el gasto vinculado al editar, archivar y restaurar', function () {
    $id = $this->postJson("{$this->base}/maintenance", record())->json('data.id');

    $this->patchJson("/api/v1/maintenance/{$id}", ['total_cost' => '200.00'])->assertOk()->assertJsonPath('data.total_cost', '200.00');
    expect(Expense::sole()->amount)->toBe('200.00');

    $this->postJson("/api/v1/maintenance/{$id}/archive")->assertOk()->assertJsonPath('data.expense_id', null);
    expect(Expense::count())->toBe(0);
    $this->getJson("{$this->base}/maintenance")->assertJsonCount(0, 'data');
    $this->getJson("{$this->base}/maintenance?archived=1")->assertJsonCount(1, 'data');

    $this->postJson("/api/v1/maintenance/{$id}/restore")->assertOk();
    expect(Expense::sole()->amount)->toBe('200.00');

    $this->patchJson("/api/v1/maintenance/{$id}", ['total_cost' => null])->assertOk()->assertJsonPath('data.expense_id', null);
    expect(Expense::count())->toBe(0);
});

it('reemplaza todas las líneas si llegan items en el PATCH', function () {
    $id = $this->postJson("{$this->base}/maintenance", record())->json('data.id');

    $this->patchJson("/api/v1/maintenance/{$id}", ['items' => [['kind' => 'fluid', 'name' => 'Líquido', 'quantity' => '0.5', 'unit_price' => '14.00']]])
        ->assertOk()
        ->assertJsonCount(1, 'data.items')
        ->assertJsonPath('data.items.0.total', '7.00');

    // items: null equivale a no enviarlas.
    $this->patchJson("/api/v1/maintenance/{$id}", ['title' => 'Otro título', 'items' => null])->assertOk()->assertJsonCount(1, 'data.items');
});

it('no deja editar ni borrar un gasto vinculado desde Gastos (409)', function () {
    $expenseId = $this->postJson("{$this->base}/maintenance", record())->json('data.expense_id');

    $this->getJson("{$this->base}/expenses")->assertJsonPath('data.0.is_linked', true);
    $this->patchJson("/api/v1/expenses/{$expenseId}", ['amount' => '1.00'])
        ->assertStatus(409)->assertExactJson(['message' => 'Este gasto se gestiona desde su intervención.']);
    $this->deleteJson("/api/v1/expenses/{$expenseId}")->assertStatus(409);
});

it('en un taller no genera gastos vinculados', function () {
    $owner = makeUser('Dueño', 'Taller Prueba');
    loginAs($owner);
    $vehicle = makeVehicle(workshopOf($owner));

    $this->postJson("/api/v1/vehicles/{$vehicle->id}/maintenance", record())->assertCreated()->assertJsonPath('data.expense_id', null);
    expect(Expense::count())->toBe(0);
});

it('filtra el historial por tipo, zona, año y texto', function () {
    $this->postJson("{$this->base}/maintenance", record())->assertCreated();
    $this->postJson("{$this->base}/maintenance", record(['type' => 'maintenance', 'zone' => 'engine', 'title' => 'Cambio de aceite', 'service_kind' => 'oil', 'mileage' => 31000, 'service_date' => day(-1)]))->assertCreated();

    $this->getJson("{$this->base}/maintenance")->assertJsonPath('data.0.title', 'Cambio de aceite');
    $this->getJson("{$this->base}/maintenance?zone=brakes")->assertJsonCount(1, 'data')->assertJsonPath('data.0.zone', 'brakes');
    $this->getJson("{$this->base}/maintenance?type=maintenance")->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}/maintenance?search=aceite")->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}/maintenance?year=".today()->year)->assertJsonCount(2, 'data');
    $this->getJson("{$this->base}/maintenance?zone=volante")->assertUnprocessable();
});

it('valida las intervenciones', function () {
    $items = array_fill(0, 51, ['kind' => 'part', 'name' => 'X', 'quantity' => '1']);

    $this->postJson("{$this->base}/maintenance", record(['title' => 'X', 'service_date' => day(1), 'total_cost' => '12.345', 'items' => $items]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'service_date', 'total_cost', 'items'])
        ->assertJsonPath('errors.service_date.0', 'La fecha de la intervención no puede ser futura.');

    $this->postJson("{$this->base}/maintenance", record(['items' => [['kind' => 'part', 'name' => 'X', 'quantity' => '0']]]))
        ->assertUnprocessable()
        ->assertJsonPath('errors', fn ($errors) => isset($errors['items.0.quantity']));
});

it('gestiona gastos: crear, filtrar, editar y borrar', function () {
    $fuel = $this->postJson("{$this->base}/expenses", [
        'category' => 'fuel', 'amount' => '61.20', 'expense_date' => day(-3), 'fuel_quantity' => '40', 'full_tank' => true, 'description' => 'Gasolinera',
    ])->assertCreated()
        ->assertJsonPath('data.fuel_unit', 'l')
        ->assertJsonPath('data.fuel_quantity', '40.00')
        ->assertJsonPath('data.is_linked', false)
        ->json('data.id');

    // Los datos de repostaje solo se guardan en combustible.
    $this->postJson("{$this->base}/expenses", [
        'category' => 'parking', 'amount' => '3.50', 'expense_date' => day(-1), 'fuel_quantity' => '10', 'full_tank' => true,
    ])->assertCreated()->assertJsonPath('data.fuel_quantity', null)->assertJsonPath('data.full_tank', null);

    $this->getJson("{$this->base}/expenses?category=fuel,tolls")->assertJsonCount(1, 'data');
    $this->getJson("{$this->base}/expenses?from=".day(-2))->assertJsonCount(1, 'data')->assertJsonPath('data.0.category', 'parking');
    $this->getJson("{$this->base}/expenses?category=fuel,cohetes")->assertUnprocessable()->assertJsonValidationErrors('category');

    $this->patchJson("/api/v1/expenses/{$fuel}", ['amount' => '62.00'])->assertOk()->assertJsonPath('data.amount', '62.00');
    $this->deleteJson("/api/v1/expenses/{$fuel}")->assertNoContent();
    $this->assertDatabaseHas('activities', ['action' => 'expense.deleted', 'entity_id' => $fuel]);
});

it('usa kWh por defecto en vehículos eléctricos', function () {
    $ev = makeVehicle($this->user->personalWorkspace(), ['fuel_type' => 'electric']);

    $this->postJson("/api/v1/vehicles/{$ev->id}/expenses", ['category' => 'fuel', 'amount' => '12.00', 'expense_date' => day(), 'fuel_quantity' => '38.5'])
        ->assertCreated()->assertJsonPath('data.fuel_unit', 'kwh');
});

it('valida importes y fechas de gasto', function () {
    $this->postJson("{$this->base}/expenses", ['category' => 'fuel', 'amount' => '0', 'expense_date' => day(1)])
        ->assertUnprocessable()
        ->assertJsonPath('errors.amount.0', 'El importe debe ser mayor que 0.')
        ->assertJsonPath('errors.expense_date.0', 'La fecha del gasto no puede ser futura.');
});
