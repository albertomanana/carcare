<?php

use App\Models\WorkOrder;

it('crea un taller desde Ajustes y el creador es owner', function () {
    $user = makeUser();
    loginAs($user);

    $this->postJson('/api/v1/workspaces', ['name' => 'Mi Taller Nuevo'])
        ->assertCreated()
        ->assertJsonPath('data.type', 'workshop')
        ->assertJsonPath('data.role', 'owner')
        ->assertJsonPath('data.members_count', 1)
        ->assertJsonPath('data.settings', ['bays_count' => 4, 'currency' => 'EUR', 'tax_rate' => '21.00']);

    $this->getJson('/api/v1/workspaces')->assertJsonCount(2, 'data')->assertJsonPath('data.0.type', 'personal');
});

it('edita los ajustes del taller y valida rangos', function () {
    $w = world();
    loginAs($w->owner);

    $this->patchJson(api('/workspaces/{wws}', $w), ['name' => 'Taller Renombrado', 'settings' => ['bays_count' => 6, 'tax_rate' => '10.5']])
        ->assertOk()
        ->assertJsonPath('data.name', 'Taller Renombrado')
        ->assertJsonPath('data.settings.bays_count', 6)
        ->assertJsonPath('data.settings.tax_rate', '10.50');

    $this->patchJson(api('/workspaces/{wws}', $w), ['settings' => ['bays_count' => 13, 'tax_rate' => 120]])
        ->assertUnprocessable()
        ->assertJsonPath('errors', fn ($e) => isset($e['settings.bays_count'], $e['settings.tax_rate']));
});

it('no deja quitar elevadores ocupados', function () {
    $w = world();
    loginAs($w->owner);
    $w->order->update(['bay' => 4]);

    $this->patchJson(api('/workspaces/{wws}', $w), ['settings' => ['bays_count' => 2]])
        ->assertStatus(409)
        ->assertJsonPath('message', "El elevador 4 está ocupado por {$w->order->number}: libéralo antes de reducir los elevadores.");
});

it('añade miembros ya registrados y cambia roles', function () {
    $w = world();
    $nuevo = makeUser('Nuevo Mecánico');
    loginAs($w->owner);

    $this->postJson(api('/workspaces/{wws}/members', $w), ['email' => strtoupper($nuevo->email), 'role' => 'mechanic'])
        ->assertCreated()
        ->assertJsonPath('data.user.id', $nuevo->id)
        ->assertJsonPath('data.role', 'mechanic');

    $this->postJson(api('/workspaces/{wws}/members', $w), ['email' => 'nadie@prueba.test', 'role' => 'mechanic'])
        ->assertUnprocessable()->assertJsonPath('errors.email.0', 'No existe ninguna cuenta con ese email.');
    $this->postJson(api('/workspaces/{wws}/members', $w), ['email' => $nuevo->email, 'role' => 'owner'])
        ->assertUnprocessable()->assertJsonValidationErrors('role');

    $this->getJson(api('/workspaces/{wws}/members', $w))->assertOk()->assertJsonCount(4, 'data')
        ->assertJsonStructure(['data' => [['user' => ['id', 'name', 'email'], 'role', 'joined_at']]]);

    $this->patchJson("/api/v1/workspaces/{$w->wws->id}/members/{$nuevo->id}", ['role' => 'manager'])->assertOk()->assertJsonPath('data.role', 'manager');
    $this->assertDatabaseHas('activities', ['action' => 'member.role_changed', 'entity_id' => $nuevo->id]);
});

it('protege al último propietario y los espacios personales', function () {
    $w = world();
    loginAs($w->owner);

    $this->patchJson(api('/workspaces/{wws}/members/{owner}', $w), ['role' => 'manager'])
        ->assertStatus(409)->assertJsonPath('message', 'No se puede cambiar el rol del último propietario del espacio.');
    $this->deleteJson(api('/workspaces/{wws}/members/{owner}', $w))
        ->assertStatus(409)->assertJsonPath('message', 'No se puede quitar al último propietario del espacio.');
    $this->postJson(api('/workspaces/{pws}/members', $w), ['email' => $w->mechanic->email, 'role' => 'mechanic'])
        ->assertStatus(409);
});

it('al quitar a un miembro sus órdenes quedan sin asignar', function () {
    $w = world();
    $w->order->update(['assigned_to' => $w->mechanic->id]);
    loginAs($w->owner);

    $this->deleteJson(api('/workspaces/{wws}/members/{mechanic}', $w))->assertNoContent();
    expect(WorkOrder::find($w->order->id)->assigned_to)->toBeNull();
    $this->getJson(api('/workspaces/{wws}/members/', $w))->assertJsonCount(2, 'data');
});

it('lista la actividad paginada y filtrable por vehículo', function () {
    $w = world();
    loginAs($w->owner);

    $this->getJson(api('/workspaces/{pws}/activity', $w))
        ->assertOk()
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('data.0.vehicle_id', $w->vehicle->id);

    $this->getJson(api('/workspaces/{wws}/activity', $w).'?vehicle_id='.$w->wvehicle->id)
        ->assertOk()
        ->assertJsonPath('data.0.action', fn ($a) => in_array($a, ['expense.created', 'work_order.created'], true));
});

it('registra en la actividad todas las acciones del contrato §3.12, sin datos sensibles', function () {
    \Illuminate\Support\Facades\Storage::fake('local');
    $owner = makeUser('Olga Actividad', 'Taller Actividad');
    $ws = $owner->personalWorkspace();
    $wws = workshopOf($owner);
    $nuevo = makeUser('Nuria Nueva');
    loginAs($owner);

    $v = '/api/v1/vehicles/'.$this->postJson("/api/v1/workspaces/{$ws->id}/vehicles", ['make' => 'Seat', 'model' => 'Ibiza'])->json('data.id');
    $this->patchJson($v, ['nickname' => 'Rojo'])->assertOk();
    $this->postJson("{$v}/mileage", ['recorded_at' => day(-1), 'mileage' => 1000])->assertCreated();
    $record = $this->postJson("{$v}/maintenance", ['type' => 'repair', 'zone' => 'engine', 'title' => 'Bujías', 'service_date' => day()])->json('data.id');
    $this->patchJson("/api/v1/maintenance/{$record}", ['title' => 'Bujías y cables'])->assertOk();
    $this->postJson("/api/v1/maintenance/{$record}/archive")->assertOk();
    $expense = $this->postJson("{$v}/expenses", ['category' => 'parking', 'amount' => '2.00', 'expense_date' => day()])->json('data.id');
    $this->patchJson("/api/v1/expenses/{$expense}", ['amount' => '2.50'])->assertOk();
    $this->deleteJson("/api/v1/expenses/{$expense}")->assertNoContent();
    $a = $this->postJson("{$v}/reminders", ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(10)])->json('data.id');
    $b = $this->postJson("{$v}/reminders", ['title' => 'Seguro', 'kind' => 'insurance', 'due_date' => day(10)])->json('data.id');
    $this->postJson("/api/v1/reminders/{$a}/complete", ['completed_at' => day()])->assertOk();
    $this->postJson("/api/v1/reminders/{$b}/dismiss")->assertOk();
    $document = makeDocument(\App\Models\Vehicle::findOrFail(basename($v)));
    $this->deleteJson("/api/v1/documents/{$document->id}")->assertNoContent();
    $pdf = tempnam(sys_get_temp_dir(), 'carcare');
    file_put_contents($pdf, "%PDF-1.4\n%prueba\n");
    $this->post("{$v}/documents", ['file' => new \Illuminate\Http\UploadedFile($pdf, 'f.pdf', null, null, true), 'title' => 'Factura', 'document_type' => 'invoice'], ['Accept' => 'application/json'])->assertCreated();
    $this->postJson("{$v}/archive")->assertOk();
    $this->postJson("{$v}/restore")->assertOk();
    $this->postJson("{$v}/archive")->assertOk();
    $this->deleteJson($v)->assertNoContent();

    $customer = $this->postJson("/api/v1/workspaces/{$wws->id}/customers", ['name' => 'Cliente Act', 'email' => 'cliente@ejemplo.test', 'phone' => '600 000 099'])->json('data.id');
    $wv = makeVehicle($wws, ['customer_id' => $customer]);
    $order = $this->postJson("/api/v1/workspaces/{$wws->id}/work-orders", ['vehicle_id' => $wv->id, 'title' => 'Revisión'])->json('data.id');
    $this->patchJson("/api/v1/work-orders/{$order}", ['diagnosis' => 'Todo bien'])->assertOk();
    $this->postJson("/api/v1/work-orders/{$order}/status", ['status' => 'ready'])->assertOk();
    $this->postJson("/api/v1/workspaces/{$wws->id}/members", ['email' => $nuevo->email, 'role' => 'mechanic'])->assertCreated();
    $this->patchJson("/api/v1/workspaces/{$wws->id}/members/{$nuevo->id}", ['role' => 'manager'])->assertOk();
    $this->deleteJson("/api/v1/workspaces/{$wws->id}/members/{$nuevo->id}")->assertNoContent();

    $actions = \App\Models\Activity::pluck('action')->unique()->sort()->values()->all();
    expect($actions)->toContain(
        'vehicle.created', 'vehicle.updated', 'vehicle.archived', 'vehicle.restored', 'vehicle.deleted',
        'mileage.recorded', 'maintenance.created', 'maintenance.updated', 'maintenance.archived',
        'expense.created', 'expense.updated', 'expense.deleted', 'reminder.created', 'reminder.completed', 'reminder.dismissed',
        'document.uploaded', 'document.deleted', 'customer.created',
        'work_order.created', 'work_order.updated', 'work_order.status_changed',
        'member.added', 'member.removed', 'member.role_changed',
    );

    // Ni emails, ni teléfonos, ni contraseñas en el resumen o en los metadatos.
    foreach (\App\Models\Activity::all() as $activity) {
        $text = $activity->summary.' '.json_encode($activity->metadata);
        expect($text)->not->toContain('@')->not->toContain('600 000')->not->toContain('password');
        expect(array_keys($activity->metadata ?? []))->not->toContain('email', 'phone', 'password', 'tax_id');
    }
});
