<?php

use App\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;

/*
 * Tarea 29 (E11‑6), contrato §3.10.1 y ADR‑0005: derechos RGPD del cliente del taller.
 *  - Exportar (acceso y portabilidad): POST, `CustomerExport`, `Cache-Control: no-store`, deja rastro.
 *  - Anonimizar (supresión): irreversible; borra los datos personales y conserva el historial técnico.
 *  - Anonimizar y eliminar quitan el nombre de la actividad. Solo owner y manager.
 */

const OLD_NAME = 'Jacinto Ficticio Pruebas';

/**
 * Taller de Olga con un cliente "real" (todos sus datos), dos vehículos suyos (uno archivado),
 * una orden entregada (con su intervención), otra cancelada y, aparte, el cliente de otra persona.
 */
function privacyWorld(): object
{
    $owner = makeUser('Olga Dueña', 'Taller Olga');
    $wws = workshopOf($owner);
    $manager = addMember($wws, makeUser('Gema Gerente'), WorkspaceRole::Manager);
    $mechanic = addMember($wws, makeUser('Mario Mecánico'), WorkspaceRole::Mechanic);
    loginAs($owner);
    $t = test();

    $customer = $t->postJson("/api/v1/workspaces/{$wws->id}/customers", [
        'name' => OLD_NAME, 'email' => 'jacinto@ejemplo.test', 'phone' => '600 111 222',
        'tax_id' => '00000000T', 'notes' => 'Prefiere que le llamen por la tarde',
    ])->assertCreated()->json('data.id');
    $vehicle = $t->postJson("/api/v1/workspaces/{$wws->id}/vehicles", [
        'make' => 'Renault', 'model' => 'Clio', 'plate' => '3333 CCC', 'customer_id' => $customer, 'current_mileage' => 80000,
    ])->assertCreated()->json('data.id');
    $archived = $t->postJson("/api/v1/workspaces/{$wws->id}/vehicles", [
        'make' => 'Citroën', 'model' => 'Berlingo', 'plate' => '4444 DDD', 'customer_id' => $customer,
    ])->assertCreated()->json('data.id');
    $t->postJson("/api/v1/vehicles/{$archived}/archive")->assertOk();

    $delivered = $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", [
        'vehicle_id' => $vehicle, 'title' => 'Cambio de aceite', 'mileage_in' => 80100,
        'items' => [['kind' => 'labor', 'name' => 'Mano de obra', 'quantity' => '1', 'unit_price' => '40.00']],
    ])->assertCreated()->json('data.id');
    $t->postJson("/api/v1/work-orders/{$delivered}/status", ['status' => 'delivered'])->assertOk();
    $cancelled = $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", ['vehicle_id' => $vehicle, 'title' => 'Presupuesto'])
        ->assertCreated()->json('data.id');
    $t->postJson("/api/v1/work-orders/{$cancelled}/status", ['status' => 'cancelled'])->assertOk();

    $otherCustomer = $t->postJson("/api/v1/workspaces/{$wws->id}/customers", ['name' => 'Otra Clienta Ficticia', 'phone' => '600 999 888'])
        ->assertCreated()->json('data.id');
    $otherVehicle = $t->postJson("/api/v1/workspaces/{$wws->id}/vehicles", ['make' => 'Kia', 'model' => 'Ceed', 'customer_id' => $otherCustomer])
        ->assertCreated()->json('data.id');
    $t->postJson("/api/v1/workspaces/{$wws->id}/work-orders", ['vehicle_id' => $otherVehicle, 'title' => 'Ruido'])->assertCreated();

    return (object) compact('owner', 'manager', 'mechanic', 'wws', 'customer', 'vehicle', 'archived', 'delivered', 'cancelled', 'otherCustomer', 'otherVehicle');
}

/** Filas del historial técnico ligado al cliente, para comprobar que anonimizar no las toca. */
function technicalHistory(): array
{
    return collect(['vehicles', 'mileage_logs', 'maintenance_records', 'maintenance_items', 'work_orders', 'work_order_items', 'documents'])
        ->mapWithKeys(fn (string $table) => [$table => DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all()])
        ->all();
}

// ───────────────────────── Exportar ─────────────────────────

it('exporta el cliente con todos sus vehículos (archivados incluidos) y todas sus órdenes, sin caché', function () {
    $w = privacyWorld();

    $response = $this->postJson("/api/v1/customers/{$w->customer}/export")->assertOk();

    expect($response->headers->get('Cache-Control'))->toContain('no-store')
        ->and($response->json('data.workspace'))->toBe(['id' => $w->wws->id, 'name' => 'Taller Olga'])
        ->and($response->json('data.customer'))->toMatchArray([
            'id' => $w->customer, 'name' => OLD_NAME, 'email' => 'jacinto@ejemplo.test', 'phone' => '600 111 222',
            'tax_id' => '00000000T', 'notes' => 'Prefiere que le llamen por la tarde', 'anonymized_at' => null,
        ])
        ->and(collect($response->json('data.vehicles'))->pluck('id')->sort()->values()->all())->toBe([$w->vehicle, $w->archived])
        ->and(collect($response->json('data.vehicles'))->firstWhere('id', $w->archived)['archived_at'])->not->toBeNull()
        ->and(collect($response->json('data.work_orders'))->pluck('status')->all())->toEqualCanonicalizing(['delivered', 'cancelled'])
        ->and(collect($response->json('data.work_orders'))->firstWhere('id', $w->delivered)['items'])->toHaveCount(1);

    // De la más reciente a la más antigua por fecha de entrada.
    $received = collect($response->json('data.work_orders'))->pluck('received_at')->all();
    expect($received)->toBe(collect($received)->sortDesc()->values()->all());
});

it('la exportación no incluye datos de otros clientes', function () {
    $w = privacyWorld();

    $json = $this->postJson("/api/v1/customers/{$w->customer}/export")->assertOk()->getContent();

    expect($json)->not->toContain('Otra Clienta Ficticia')->not->toContain('600 999 888')->not->toContain('Ceed');
});

it('exportar deja rastro en la actividad sin el nombre del cliente; el gerente también puede', function () {
    $w = privacyWorld();

    $this->postJson("/api/v1/customers/{$w->customer}/export")->assertOk();
    loginAs($w->manager);
    $this->postJson("/api/v1/customers/{$w->customer}/export")->assertOk();

    $exported = Activity::query()->where('action', 'customer.exported')->orderBy('id')->get();
    expect($exported)->toHaveCount(2)
        ->and($exported->pluck('summary')->all())->toBe(['Olga Dueña exportó los datos de un cliente', 'Gema Gerente exportó los datos de un cliente'])
        ->and($exported->pluck('entity_type')->unique()->all())->toBe(['customer'])
        ->and($exported->pluck('entity_id')->unique()->all())->toBe([$w->customer])
        ->and($exported->pluck('metadata')->filter()->all())->toBe([]);
});

// ───────────────────────── Anonimizar ─────────────────────────

it('anonimiza: sobrescribe los datos personales y conserva el id, los vínculos y el historial técnico', function () {
    $w = privacyWorld();
    $before = technicalHistory();

    $response = $this->postJson("/api/v1/customers/{$w->customer}/anonymize")->assertOk();

    expect($response->json('data'))->toMatchArray([
        'id' => $w->customer, 'name' => 'Cliente anonimizado', 'email' => null, 'phone' => null, 'tax_id' => null, 'notes' => null,
        'vehicles_count' => 1, 'open_orders_count' => 0,
    ])->and($response->json('data.anonymized_at'))->not->toBeNull();

    // En la base de datos no queda ningún dato personal antiguo.
    $row = (array) DB::table('customers')->where('id', $w->customer)->first();
    expect(json_encode($row, JSON_UNESCAPED_UNICODE))->not->toContain('Jacinto')->not->toContain('jacinto@')
        ->not->toContain('600 111 222')->not->toContain('00000000T')->not->toContain('por la tarde');

    // Vehículos, lecturas, intervenciones, órdenes, líneas y documentos no cambian.
    expect(technicalHistory())->toBe($before);

    // Sus órdenes y vehículos siguen enlazados, ahora con el nombre nuevo.
    $this->getJson("/api/v1/work-orders/{$w->delivered}")->assertOk()
        ->assertJsonPath('data.customer', ['id' => $w->customer, 'name' => 'Cliente anonimizado', 'phone' => null]);
    $this->getJson("/api/v1/vehicles/{$w->vehicle}")->assertOk()->assertJsonPath('data.customer.name', 'Cliente anonimizado');

    // Sigue en el listado y en las búsquedas con su nombre nuevo; el antiguo ya no encuentra nada.
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/customers?search=Jacinto")->assertOk()->assertJsonPath('meta.total', 0);
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/customers?search=anonimizado")->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $w->customer);

    // La analítica sigue sumando sus órdenes entregadas.
    $byCustomer = collect($this->getJson("/api/v1/workspaces/{$w->wws->id}/analytics")->assertOk()->json('data.workshop.by_customer'));
    expect($byCustomer->firstWhere('customer.id', $w->customer))->toMatchArray(['total' => '48.40', 'orders' => 1])
        ->and($byCustomer->firstWhere('customer.id', $w->customer)['customer']['name'])->toBe('Cliente anonimizado');
});

it('al anonimizar, el nombre antiguo desaparece de toda la actividad y se registra customer.anonymized', function () {
    $w = privacyWorld();
    expect(Activity::query()->where('summary', 'like', '%'.OLD_NAME.'%')->count())->toBe(1); // customer.created

    $this->postJson("/api/v1/customers/{$w->customer}/anonymize")->assertOk();

    expect(Activity::query()->where('summary', 'like', '%Jacinto%')->exists())->toBeFalse()
        ->and(Activity::query()->where('action', 'customer.created')->where('entity_id', $w->customer)->value('summary'))
        ->toBe('Olga Dueña dio de alta a un cliente (anonimizado)')
        ->and(Activity::query()->where('action', 'customer.anonymized')->sole()->only(['summary', 'entity_type', 'entity_id', 'metadata']))
        ->toBe(['summary' => 'Olga Dueña anonimizó los datos de un cliente', 'entity_type' => 'customer', 'entity_id' => $w->customer, 'metadata' => null])
        // La frase de la otra clienta no se toca.
        ->and(Activity::query()->where('action', 'customer.created')->where('entity_id', $w->otherCustomer)->value('summary'))
        ->toBe('Olga Dueña dio de alta al cliente Otra Clienta Ficticia');
});

it('responde 409 si ya está anonimizado o si tiene órdenes abiertas, y no cambia nada', function () {
    $w = privacyWorld();

    $this->postJson("/api/v1/customers/{$w->otherCustomer}/anonymize")
        ->assertStatus(409)
        ->assertExactJson(['message' => 'No se puede anonimizar un cliente con órdenes de trabajo abiertas. Entrégalas o cancélalas antes.']);
    expect(Customer::find($w->otherCustomer)->only(['name', 'phone', 'anonymized_at']))
        ->toBe(['name' => 'Otra Clienta Ficticia', 'phone' => '600 999 888', 'anonymized_at' => null]);

    $this->postJson("/api/v1/customers/{$w->customer}/anonymize")->assertOk();
    $anonymizedAt = Customer::find($w->customer)->anonymized_at;
    $this->travel(1)->minutes();
    $this->postJson("/api/v1/customers/{$w->customer}/anonymize")
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Este cliente ya está anonimizado.']);
    expect(Customer::find($w->customer)->anonymized_at->equalTo($anonymizedAt))->toBeTrue()
        ->and(Activity::query()->where('action', 'customer.anonymized')->count())->toBe(1);
});

it('un cliente anonimizado no se edita (409) ni se asigna a otro vehículo (422), pero se exporta, se borra y sus coches siguen entrando al taller', function () {
    $w = privacyWorld();
    $this->postJson("/api/v1/customers/{$w->customer}/anonymize")->assertOk();
    $anonymized = ['customer_id' => ['Este cliente está anonimizado: crea uno nuevo.']];

    $this->patchJson("/api/v1/customers/{$w->customer}", ['name' => 'Jacinto Otra Vez'])
        ->assertStatus(409)
        ->assertExactJson(['message' => 'Este cliente está anonimizado: sus datos ya no se pueden editar.']);

    $this->postJson("/api/v1/workspaces/{$w->wws->id}/vehicles", ['make' => 'Seat', 'model' => 'León', 'customer_id' => $w->customer])
        ->assertUnprocessable()->assertJsonPath('errors', $anonymized);
    $this->patchJson("/api/v1/vehicles/{$w->otherVehicle}", ['customer_id' => $w->customer])
        ->assertUnprocessable()->assertJsonPath('errors', $anonymized);
    // Reenviar el cliente que el vehículo ya tenía no es asignarlo de nuevo.
    $this->patchJson("/api/v1/vehicles/{$w->vehicle}", ['nickname' => 'El blanco', 'customer_id' => $w->customer])
        ->assertOk()->assertJsonPath('data.customer.id', $w->customer);
    // Quitarle el cliente al vehículo sí se puede.
    $this->patchJson("/api/v1/vehicles/{$w->archived}", ['customer_id' => null])->assertOk();

    // Su coche vuelve al taller: la orden nueva lleva al cliente anonimizado.
    $order = $this->postJson("/api/v1/workspaces/{$w->wws->id}/work-orders", ['vehicle_id' => $w->vehicle, 'title' => 'Revisión'])
        ->assertCreated()->assertJsonPath('data.customer.name', 'Cliente anonimizado')->json('data.id');

    $this->postJson("/api/v1/customers/{$w->customer}/export")->assertOk()
        ->assertJsonPath('data.customer.name', 'Cliente anonimizado')
        ->assertJsonPath('data.customer.email', null);

    $this->postJson("/api/v1/work-orders/{$order}/status", ['status' => 'cancelled'])->assertOk();
    $this->deleteJson("/api/v1/customers/{$w->customer}")->assertNoContent();
    expect(Customer::find($w->customer))->toBeNull();
});

it('al eliminar un cliente, su nombre desaparece de la actividad', function () {
    $w = privacyWorld();

    $this->deleteJson("/api/v1/customers/{$w->customer}")->assertNoContent();

    expect(Activity::query()->where('summary', 'like', '%Jacinto%')->exists())->toBeFalse()
        ->and(Activity::query()->where('action', 'customer.created')->where('entity_id', $w->customer)->value('summary'))
        ->toBe('Olga Dueña dio de alta a un cliente (eliminado)')
        ->and(DB::table('vehicles')->where('id', $w->vehicle)->value('customer_id'))->toBeNull()
        ->and(DB::table('work_orders')->where('id', $w->delivered)->exists())->toBeTrue();
});

it('si no se puede eliminar (órdenes abiertas), la actividad conserva la frase', function () {
    $w = privacyWorld();

    $this->deleteJson("/api/v1/customers/{$w->otherCustomer}")->assertStatus(409);

    expect(Activity::query()->where('action', 'customer.created')->where('entity_id', $w->otherCustomer)->value('summary'))
        ->toBe('Olga Dueña dio de alta al cliente Otra Clienta Ficticia');
});

it('el mecánico no puede exportar ni anonimizar (403) y no queda rastro', function () {
    $w = privacyWorld();
    loginAs($w->mechanic);
    $activities = Activity::count();

    $this->postJson("/api/v1/customers/{$w->customer}/export")->assertForbidden();
    $this->postJson("/api/v1/customers/{$w->customer}/anonymize")->assertForbidden();

    expect(Customer::find($w->customer)->name)->toBe(OLD_NAME)
        ->and(Activity::count())->toBe($activities);
    // Sigue viendo al cliente, como antes.
    $this->getJson("/api/v1/customers/{$w->customer}")->assertOk();
});
