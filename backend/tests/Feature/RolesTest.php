<?php

/*
 * Contrato §2: el mecánico ve y opera, pero no gestiona (403). El gerente gestiona, pero no es dueño.
 */

dataset('acciones de gestión', [
    'editar ajustes del taller' => ['PATCH', '/workspaces/{wws}', ['name' => 'Nuevo nombre']],
    'borrar el taller' => ['DELETE', '/workspaces/{wws}', []],
    'añadir miembro' => ['POST', '/workspaces/{wws}/members', ['email' => 'x@prueba.test', 'role' => 'mechanic']],
    'cambiar rol' => ['PATCH', '/workspaces/{wws}/members/{manager}', ['role' => 'mechanic']],
    'quitar a otro miembro' => ['DELETE', '/workspaces/{wws}/members/{manager}', []],
    'analítica' => ['GET', '/workspaces/{wws}/analytics', []],
    'archivar vehículo' => ['POST', '/vehicles/{wvehicle}/archive', []],
    'restaurar vehículo' => ['POST', '/vehicles/{wvehicle}/restore', []],
    'borrar vehículo' => ['DELETE', '/vehicles/{wvehicle}', []],
    'listar gastos' => ['GET', '/vehicles/{wvehicle}/expenses', []],
    'crear gasto' => ['POST', '/vehicles/{wvehicle}/expenses', ['category' => 'other', 'amount' => '5.00', 'expense_date' => '2026-01-01']],
    'editar gasto' => ['PATCH', '/expenses/{wexpense}', ['amount' => '6.00']],
    'borrar gasto' => ['DELETE', '/expenses/{wexpense}', []],
    'borrar cliente' => ['DELETE', '/customers/{customer}', []],
    'exportar cliente' => ['POST', '/customers/{customer}/export', []],
    'anonimizar cliente' => ['POST', '/customers/{customer}/anonymize', []],
    'borrar orden' => ['DELETE', '/work-orders/{order}', []],
]);

it('el mecánico recibe 403 en lo que no puede hacer', function (string $method, string $uri, array $body) {
    $w = world();
    loginAs($w->mechanic);

    $this->json($method, api($uri, $w), $body)
        ->assertForbidden()
        ->assertExactJson(['message' => 'No tienes permiso para esta acción.']);
})->with('acciones de gestión');

it('el mecánico puede ver y operar en el taller', function () {
    $w = world();
    loginAs($w->mechanic);

    $this->getJson(api('/workspaces/{wws}/work-orders', $w))->assertOk();
    $this->getJson(api('/workspaces/{wws}/customers', $w))->assertOk();
    $this->getJson(api('/workspaces/{wws}/bays', $w))->assertOk()->assertJsonCount(4, 'data');
    $this->postJson(api('/workspaces/{wws}/customers', $w), ['name' => 'Cliente del mecánico'])->assertCreated();
    $this->postJson(api('/workspaces/{wws}/vehicles', $w), ['make' => 'Ford', 'model' => 'Focus'])->assertCreated();
    $this->postJson(api('/work-orders/{order}/status', $w), ['status' => 'diagnosing'])->assertOk()->assertJsonPath('data.status', 'diagnosing');
    $this->postJson(api('/vehicles/{wvehicle}/reminders', $w), ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(30)])->assertCreated();
});

it('el mecánico ve el dashboard del taller sin facturación', function () {
    $w = world();

    loginAs($w->mechanic);
    $this->getJson(api('/workspaces/{wws}/dashboard', $w))
        ->assertOk()
        ->assertJsonPath('data.type', 'workshop')
        ->assertJsonPath('data.revenue', null);

    loginAs($w->manager);
    $this->getJson(api('/workspaces/{wws}/dashboard', $w))
        ->assertOk()
        ->assertJsonPath('data.revenue.month', '0.00');
});

it('el mecánico puede salir del taller por sí mismo', function () {
    $w = world();
    loginAs($w->mechanic);

    $this->deleteJson(api('/workspaces/{wws}/members/{mechanic}', $w))->assertNoContent();
    expect($w->mechanic->roleIn($w->wws))->toBeNull();
});

it('el gerente gestiona pero no puede borrar el taller ni tocar al propietario', function () {
    $w = world();
    loginAs($w->manager);

    $this->getJson(api('/workspaces/{wws}/analytics', $w))->assertOk();
    $this->postJson(api('/vehicles/{wvehicle}/expenses', $w), ['category' => 'other', 'amount' => '5.00', 'expense_date' => day()])->assertCreated();
    $this->patchJson(api('/workspaces/{wws}/members/{mechanic}', $w), ['role' => 'manager'])->assertOk()->assertJsonPath('data.role', 'manager');

    $this->deleteJson(api('/workspaces/{wws}', $w))->assertForbidden();
    $this->patchJson(api('/workspaces/{wws}/members/{owner}', $w), ['role' => 'mechanic'])->assertForbidden();
    $this->deleteJson(api('/workspaces/{wws}/members/{owner}', $w))->assertForbidden();
});

it('el propietario puede borrar su taller pero no su espacio personal', function () {
    $w = world();
    loginAs($w->owner);

    $this->deleteJson(api('/workspaces/{pws}', $w))->assertStatus(409)->assertJsonPath('message', 'No se puede eliminar tu espacio personal.');
    $this->deleteJson(api('/workspaces/{wws}', $w))->assertNoContent();
    expect(\App\Models\Workspace::find($w->wws->id))->toBeNull()
        ->and(\App\Models\WorkOrder::count())->toBe(0);
});

it('solo un propietario puede nombrar o retirar propietarios', function () {
    $w = world();

    loginAs($w->manager);
    $this->patchJson(api('/workspaces/{wws}/members/{mechanic}', $w), ['role' => 'owner'])
        ->assertForbidden()->assertExactJson(['message' => 'No tienes permiso para esta acción.']);

    loginAs($w->owner);
    $this->patchJson(api('/workspaces/{wws}/members/{manager}', $w), ['role' => 'owner'])->assertOk()->assertJsonPath('data.role', 'owner');
    // Con dos propietarios, la primera ya puede dejar de serlo.
    $this->patchJson(api('/workspaces/{wws}/members/{owner}', $w), ['role' => 'manager'])->assertOk()->assertJsonPath('data.role', 'manager');
    expect($w->owner->roleIn($w->wws)?->value)->toBe('manager');
});

it('el mecánico opera en el historial: archiva intervenciones, borra lecturas manuales, recordatorios y documentos', function () {
    $w = world();
    $wlog = $w->wvehicle->mileageLogs()->create(['recorded_at' => day(-1), 'mileage' => 900, 'source' => 'manual']);
    $record = app(\App\Services\MaintenanceService::class)->create($w->wvehicle, ['type' => 'repair', 'zone' => 'engine', 'title' => 'Bujías', 'service_date' => day(-1)]);
    $reminder = app(\App\Services\ReminderService::class)->create($w->wvehicle, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(30)]);
    $document = makeDocument($w->wvehicle);
    loginAs($w->mechanic);

    $this->postJson("/api/v1/maintenance/{$record->id}/archive")->assertOk();
    $this->deleteJson("/api/v1/mileage/{$wlog->id}")->assertNoContent();
    $this->deleteJson("/api/v1/reminders/{$reminder->id}")->assertNoContent();
    $this->deleteJson("/api/v1/documents/{$document->id}")->assertNoContent();
});
