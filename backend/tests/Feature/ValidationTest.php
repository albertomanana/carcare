<?php

/*
 * 422 representativos en todos los recursos: forma { message, errors: { campo: [mensajes] } }
 * y mensajes en español (nunca claves sin traducir ni textos en inglés).
 */

dataset('cuerpos inválidos', [
    // Cuenta y espacios
    'perfil' => ['PATCH', '/me', ['email' => 'no-es-un-email'], ['email']],
    'contraseña' => ['PUT', '/me/password', ['current_password' => 'mala', 'password' => 'corta', 'password_confirmation' => 'otra'], ['current_password', 'password']],
    'borrar cuenta' => ['DELETE', '/me', ['password' => 'mala'], ['password']],
    'crear taller' => ['POST', '/workspaces', [], ['name']],
    'ajustes del taller' => ['PATCH', '/workspaces/{wws}', ['settings' => ['bays_count' => 0, 'tax_rate' => -1]], ['settings.bays_count', 'settings.tax_rate']],
    'añadir miembro' => ['POST', '/workspaces/{wws}/members', ['email' => 'x', 'role' => 'jefe'], ['email', 'role']],
    'cambiar rol' => ['PATCH', '/workspaces/{wws}/members/{mechanic}', ['role' => 'jefe'], ['role']],
    // Vehículos y kilometraje
    'crear vehículo' => ['POST', '/workspaces/{pws}/vehicles', ['model' => '', 'fuel_type' => 'vapor'], ['make', 'model', 'fuel_type']],
    'editar vehículo' => ['PATCH', '/vehicles/{vehicle}', ['year' => 3000, 'vin' => 'IOQ12345678901234'], ['year', 'vin']],
    'registrar km' => ['POST', '/vehicles/{vehicle}/mileage', ['recorded_at' => '23/10/2026', 'mileage' => 1.5], ['recorded_at', 'mileage']],
    // Intervenciones y gastos
    'crear intervención' => ['POST', '/vehicles/{vehicle}/maintenance', [], ['type', 'zone', 'title', 'service_date']],
    'editar intervención' => ['PATCH', '/maintenance/{record}', ['type' => 'magia', 'parts_cost' => '1000000.00'], ['type', 'parts_cost']],
    'crear gasto' => ['POST', '/vehicles/{vehicle}/expenses', [], ['category', 'amount', 'expense_date']],
    'editar gasto' => ['PATCH', '/expenses/{expense}', ['amount' => '-1'], ['amount']],
    // Recordatorios y documentos
    'crear recordatorio' => ['POST', '/vehicles/{vehicle}/reminders', ['kind' => 'cometa'], ['title', 'kind', 'due_date']],
    'editar recordatorio' => ['PATCH', '/reminders/{reminder}', ['recurrence_months' => 0], ['recurrence_months']],
    'completar recordatorio' => ['POST', '/reminders/{reminder}/complete', [], ['completed_at']],
    'subir documento' => ['POST', '/vehicles/{vehicle}/documents', [], ['file', 'title', 'document_type']],
    // Taller
    'crear cliente' => ['POST', '/workspaces/{wws}/customers', ['email' => 'mal'], ['name', 'email']],
    'editar cliente' => ['PATCH', '/customers/{customer}', ['phone' => 'llámame'], ['phone']],
    'crear orden' => ['POST', '/workspaces/{wws}/work-orders', ['tax_rate' => 150], ['vehicle_id', 'title', 'tax_rate']],
    'editar orden' => ['PATCH', '/work-orders/{order}', ['priority' => 'ya', 'items' => [['kind' => 'x']]], ['priority', 'items.0.kind', 'items.0.name', 'items.0.quantity']],
    'cambiar estado' => ['POST', '/work-orders/{order}/status', ['bay' => 9], ['status', 'bay']],
]);

it('responde 422 en español con los campos inválidos', function (string $method, string $uri, array $body, array $fields) {
    $w = world();
    loginAs($w->owner);

    $response = $this->json($method, api($uri, $w), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($fields);

    expect(array_keys($response->json()))->toBe(['message', 'errors']);
    foreach ($response->json('errors') as $field => $messages) {
        foreach ($messages as $message) {
            expect($message)->not->toMatch('/^The |validation\.|field|must be/i', "Mensaje sin traducir en {$field}: {$message}");
        }
    }
})->with('cuerpos inválidos');

it('valida los filtros de los listados', function (string $uri, string $field) {
    $w = world();
    loginAs($w->owner);

    $this->getJson(api($uri, $w))->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    'orden de vehículos' => ['/workspaces/{pws}/vehicles?sort=precio', 'sort'],
    'estado de la agenda' => ['/workspaces/{pws}/reminders?state=rojo', 'state'],
    'estado de recordatorios' => ['/vehicles/{vehicle}/reminders?status=olvidado', 'status'],
    'fecha del resumen' => ['/vehicles/{vehicle}/summary?from=ayer', 'from'],
    'fecha del diario' => ['/vehicles/{vehicle}/journal?to=2026-13-01', 'to'],
    'periodo de la analítica' => ['/workspaces/{pws}/analytics?from=2026-05-01&to=2026-04-01', 'to'],
    'tipo de intervención' => ['/vehicles/{vehicle}/maintenance?type=magia', 'type'],
    'categoría de gasto' => ['/vehicles/{vehicle}/expenses?category=cohetes', 'category'],
    'tipo de documento' => ['/vehicles/{vehicle}/documents?document_type=selfie', 'document_type'],
    'estado de órdenes' => ['/workspaces/{wws}/work-orders?status=perdida', 'status'],
    'página' => ['/workspaces/{pws}/activity?page=0', 'page'],
]);

it('la validación nunca filtra trazas ni SQL', function () {
    $w = world();
    loginAs($w->owner);

    $body = $this->postJson(api('/vehicles/{vehicle}/mileage', $w), ['recorded_at' => day(), 'mileage' => 'DROP TABLE vehicles'])
        ->assertUnprocessable()
        ->getContent();

    expect($body)->not->toContain('SQLSTATE')->not->toContain('Stack trace')->not->toContain('vendor/');
});
