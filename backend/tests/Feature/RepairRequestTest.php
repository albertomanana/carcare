<?php

use App\Models\Activity;
use App\Models\MileageLog;
use App\Models\RepairRequest;
use App\Services\MaintenanceService;
use App\Services\VehicleService;
use Illuminate\Support\Facades\DB;

/*
 * E16 · Solicitudes de reparación (contrato §3.13.1, §3.13.3, §3.13.4 y §3.13.7, ADR‑0007).
 * Crear (copia fija, 422, 429 y 409), listados de las dos partes, transiciones del particular y del taller
 * con su 409, la matriz 404/403 entre las partes, el mecánico, y el historial compartido.
 * El presupuesto y la conversión están en RepairQuoteTest.
 */

function rr(int $id, string $suffix = ''): string
{
    return "/api/v1/repair-requests/{$id}{$suffix}";
}

// ───────────────────────── Crear ─────────────────────────

it('crea la solicitud con la copia fija del coche, sin lectura de km y con actividad sin nombre', function () {
    $w = e16World();
    $readings = MileageLog::count();
    loginAs($w->client);

    $response = $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, ['share_history' => true]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.perspective', 'requester')
        ->assertJsonPath('data.vehicle_id', $w->car->id)
        ->assertJsonPath('data.vehicle', [
            'make' => 'Seat', 'model' => 'Ibiza', 'year' => 2019, 'fuel_type' => 'gasoline', 'body_type' => 'hatchback',
            'color_hex' => '#C0392B', 'plate' => '1234ABC', 'display_name' => 'Seat Ibiza',
        ])
        ->assertJsonPath('data.workshop', ['id' => $w->wws->id, 'name' => 'Taller Destino', 'city' => 'Lleida', 'phone' => '973 000 000'])
        ->assertJsonPath('data.requester', ['name' => 'Lucía Cliente', 'email' => $w->client->email])
        ->assertJsonPath('data.mileage', 84500)
        ->assertJsonPath('data.share_history', true)
        ->assertJsonPath('data.history_available', true)
        ->assertJsonPath('data.quotes', [])
        ->assertJsonPath('data.work_order', null);

    expect(MileageLog::count())->toBe($readings) // los km declarados no crean una lectura
        ->and($w->car->fresh()->current_mileage)->toBe(84200);

    // Editar el coche después no cambia la copia fija.
    $this->patchJson("/api/v1/vehicles/{$w->car->id}", ['model' => 'León', 'color_hex' => '#000000'])->assertOk();
    $this->getJson(rr($response->json('data.id')))->assertOk()
        ->assertJsonPath('data.vehicle.model', 'Ibiza')
        ->assertJsonPath('data.vehicle.color_hex', '#C0392B');

    $activity = Activity::query()->where('action', 'repair_request.created')->sole();
    expect($activity->summary)->toBe('Enviaste una solicitud a Taller Destino para Seat Ibiza')
        ->and($activity->workspace_id)->toBe($w->pws->id)
        ->and($activity->vehicle_id)->toBe($w->car->id);
});

it('share_history es false por defecto y el teléfono vacío se guarda como null', function () {
    $w = e16World();
    $input = requestInput($w, ['contact_phone' => '  ']);
    unset($input['share_history']);
    loginAs($w->client);

    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", $input)->assertCreated()
        ->assertJsonPath('data.share_history', false)
        ->assertJsonPath('data.history_available', false)
        ->assertJsonPath('data.contact_phone', null);
});

it('valida la solicitud (422 con el campo)', function (Closure $override, string $field, ?string $message = null) {
    $w = e16World();
    loginAs($w->client);

    $response = $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, $override($w)))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
    if ($message !== null) {
        expect($response->json("errors.{$field}.0"))->toBe($message);
    }
})->with([
    'sin vehículo' => [fn () => ['vehicle_id' => null], 'vehicle_id'],
    'vehículo de otro garaje' => [fn ($w) => ['vehicle_id' => makeVehicle($w->intruder->personalWorkspace())->id], 'vehicle_id', 'Este vehículo no está en tu garaje.'],
    'vehículo archivado' => [fn ($w) => ['vehicle_id' => makeVehicle($w->pws, ['archived_at' => now()])->id], 'vehicle_id', 'Este vehículo está archivado.'],
    'taller fuera del directorio' => [fn ($w) => ['workshop_id' => workshopOf($w->intruder)->id], 'workshop_id', 'Este taller no está en el directorio.'],
    'un espacio personal como taller' => [fn ($w) => ['workshop_id' => $w->intruder->personalWorkspace()->id], 'workshop_id', 'Este taller no está en el directorio.'],
    'taller inexistente' => [fn () => ['workshop_id' => 999999], 'workshop_id', 'Este taller no está en el directorio.'],
    'asunto corto' => [fn () => ['title' => 'ab'], 'title'],
    'asunto largo' => [fn () => ['title' => str_repeat('a', 121)], 'title'],
    'descripción corta' => [fn () => ['description' => 'Corta'], 'description'],
    'descripción larga' => [fn () => ['description' => str_repeat('a', 2001)], 'description'],
    'zona inventada' => [fn () => ['zone' => 'techo'], 'zone'],
    'fecha pasada' => [fn () => ['preferred_date' => day(-1)], 'preferred_date', 'La fecha preferida no puede ser anterior a hoy.'],
    'fecha a más de 180 días' => [fn () => ['preferred_date' => day(181)], 'preferred_date'],
    'fecha sin formato' => [fn () => ['preferred_date' => '01/12/2026'], 'preferred_date'],
    'km negativos' => [fn () => ['mileage' => -1], 'mileage'],
    'km por encima del máximo' => [fn () => ['mileage' => 2000001], 'mileage'],
    'km menores que el último anotado' => [fn () => ['mileage' => 84199], 'mileage', 'No puede ser menor que el último kilometraje anotado (84.200 km).'],
    'teléfono con letras' => [fn () => ['contact_phone' => '600 ABC'], 'contact_phone'],
    'share_history no booleano' => [fn () => ['share_history' => 'quizá'], 'share_history'],
]);

it('no se puede enviar una solicitud a un taller del que eres miembro (422)', function () {
    $w = e16World();
    $sameUser = $w->manager; // la gerente tiene su garaje y es miembro del taller
    $car = makeVehicle($sameUser->personalWorkspace());
    loginAs($sameUser);

    $this->postJson("/api/v1/workspaces/{$sameUser->personalWorkspace()->id}/repair-requests", requestInput($w, ['vehicle_id' => $car->id, 'mileage' => 0]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.workshop_id.0', 'No puedes enviar una solicitud a un taller del que formas parte.');
});

it('los km iguales al último anotado se aceptan', function () {
    $w = e16World();
    sendRequest($w, ['mileage' => 84200]);

    expect(RepairRequest::sole()->mileage)->toBe(84200);
});

it('409 si ya hay una solicitud abierta para la misma pareja vehículo‑taller; a otro taller sí se puede', function () {
    $w = e16World();
    $first = sendRequest($w);

    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w))
        ->assertConflict()
        ->assertExactJson(['message' => 'Ya tienes una solicitud abierta para este vehículo en este taller.']);

    $other = makeUser('Otra Dueña', 'Neumáticos Prueba');
    listWorkshop(workshopOf($other));
    loginAs($w->client);
    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, ['workshop_id' => workshopOf($other)->id]))
        ->assertCreated();

    // Cerrada la primera, la pareja vuelve a estar libre.
    $this->postJson(rr($first, '/cancel'))->assertOk();
    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w))->assertCreated();
});

it('429 a partir de la 6.ª solicitud en 24 horas (contadas en la base de datos)', function () {
    $w = e16World();
    loginAs($w->client);

    foreach (range(1, 5) as $i) {
        $id = $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w))->assertCreated()->json('data.id');
        $this->postJson(rr($id, '/cancel'))->assertOk(); // canceladas también cuentan
    }

    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w))
        ->assertStatus(429)
        ->assertExactJson(['message' => 'Has enviado 5 solicitudes en las últimas 24 horas. Vuelve a intentarlo mañana.']);
    expect(RepairRequest::count())->toBe(5);

    // Pasadas 24 horas desde la más antigua, vuelve a poder.
    RepairRequest::query()->update(['created_at' => now()->subHours(25)]);
    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w))->assertCreated();
});

it('solo se crean desde un espacio personal: en un taller la ruta da 404', function () {
    $w = e16World();
    loginAs($w->owner);

    $this->postJson("/api/v1/workspaces/{$w->wws->id}/repair-requests", requestInput($w))->assertNotFound();
    expect(RepairRequest::count())->toBe(0);
});

it('un taller que sale del directorio no recibe solicitudes nuevas, pero las abiertas siguen', function () {
    $w = e16World();
    $id = sendRequest($w);
    $w->wws->workshopProfile()->update(['listed' => false]);

    $this->postJson("/api/v1/workspaces/{$w->pws->id}/repair-requests", requestInput($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 10]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.workshop_id.0', 'Este taller no está en el directorio.');

    loginAs($w->owner);
    $this->postJson(rr($id, '/accept'))->assertOk()->assertJsonPath('data.status', 'accepted');
});

// ───────────────────────── Listados ─────────────────────────

it('el particular lista las enviadas y el taller las recibidas, más recientes primero y con filtros', function () {
    $w = e16World();
    $first = sendRequest($w);
    $second = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws, ['plate' => '9999ZZZ'])->id, 'mileage' => 0]);
    RepairRequest::query()->whereKey($first)->update(['created_at' => now()->subHour()]);
    $this->postJson(rr($second, '/cancel'))->assertOk();

    $sent = $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests")->assertOk();
    expect(array_column($sent->json('data'), 'id'))->toBe([$second, $first])
        ->and($sent->json('meta.total'))->toBe(2)
        ->and(array_unique(array_column($sent->json('data'), 'perspective')))->toBe(['requester']);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests?status=open")->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests?status=cancelled,rejected")->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests?status=borrador")->assertUnprocessable();

    foreach (['owner', 'manager', 'mechanic'] as $who) {
        loginAs($w->{$who});
        $received = $this->getJson("/api/v1/workspaces/{$w->wws->id}/repair-requests")->assertOk();
        expect(array_column($received->json('data'), 'id'))->toBe([$second, $first])
            ->and($received->json('data.0.perspective'))->toBe('workshop')
            ->and($received->json('data.0.vehicle_id'))->toBeNull();
    }

    // Un tercero no ve nada: ni las de Lucía ni las del taller.
    loginAs($w->intruder);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests")->assertNotFound();
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/repair-requests")->assertNotFound();
    $this->getJson('/api/v1/workspaces/'.workshopOf($w->intruder)->id.'/repair-requests')->assertOk()->assertJsonCount(0, 'data');
});

// ───────────────────────── Qué ve cada parte ─────────────────────────

it('el taller ve la copia fija, el contacto y los km, pero nunca el coche vivo (vehicle_id null)', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->mechanic);

    $data = $this->getJson(rr($id))->assertOk()->json('data');

    expect($data['perspective'])->toBe('workshop')
        ->and($data['vehicle_id'])->toBeNull()
        ->and($data['requester'])->toBe(['name' => 'Lucía Cliente', 'email' => $w->client->email])
        ->and($data['contact_phone'])->toBe('600 000 000')
        ->and($data['mileage'])->toBe(84500)
        ->and(json_encode($data))->not->toContain('El rojo')       // el apodo
        ->and(json_encode($data))->not->toContain('VSSZZZKJZKR000001'); // el VIN
});

it('la otra parte del taller tampoco ve el vehículo, los clientes ni las órdenes del particular (404) y viceversa', function () {
    $w = e16World();
    sendRequest($w);
    $wvehicle = makeVehicle($w->wws, ['plate' => '7777WWW']);
    loginAs($w->owner);
    $this->getJson("/api/v1/vehicles/{$w->car->id}")->assertNotFound();
    $this->getJson("/api/v1/vehicles/{$w->car->id}/maintenance")->assertNotFound();
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/vehicles")->assertNotFound();

    loginAs($w->client);
    $this->getJson("/api/v1/vehicles/{$wvehicle->id}")->assertNotFound();
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/customers")->assertNotFound();
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/work-orders")->assertNotFound();
});

// ───────────────────────── Matriz 404 / 403 ─────────────────────────

dataset('rutas de una solicitud', [
    'ver' => ['GET', '', []],
    'compartir historial' => ['PATCH', '', ['share_history' => true]],
    'cancelar' => ['POST', '/cancel', []],
    'aceptar' => ['POST', '/accept', []],
    'rechazar' => ['POST', '/reject', ['reason' => 'No hacemos chapa']],
    'enviar presupuesto' => ['POST', '/quotes', []],
    'aceptar presupuesto' => ['POST', '/quote/accept', ['quote_id' => 1]],
    'rechazar presupuesto' => ['POST', '/quote/reject', ['quote_id' => 1]],
    'historial' => ['GET', '/history', []],
]);

it('un tercero recibe 404 en todas las rutas de una solicitud y no cambia nada', function (string $method, string $suffix, array $body) {
    $w = e16World();
    $id = sendRequest($w, ['share_history' => true]);
    loginAs($w->intruder);

    $this->json($method, rr($id, $suffix), $suffix === '/quotes' ? quoteInput() : $body)
        ->assertNotFound()
        ->assertExactJson(['message' => 'Recurso no encontrado.']);
    expect(RepairRequest::find($id)->status->value)->toBe('pending');
})->with('rutas de una solicitud');

it('el taller recibe 403 en las acciones del particular', function (string $who, string $method, string $suffix, array $body) {
    $w = e16World();
    $id = sendRequest($w, ['share_history' => true]);
    loginAs($w->{$who});

    $this->json($method, rr($id, $suffix), $body)
        ->assertForbidden()
        ->assertExactJson(['message' => 'No tienes permiso para esta acción.']);
    expect(RepairRequest::find($id)->status->value)->toBe('pending');
})->with(['owner', 'manager', 'mechanic'])->with([
    'compartir historial' => ['PATCH', '', ['share_history' => false]],
    'cancelar' => ['POST', '/cancel', []],
    'aceptar presupuesto' => ['POST', '/quote/accept', ['quote_id' => 1]],
    'rechazar presupuesto' => ['POST', '/quote/reject', ['quote_id' => 1]],
]);

it('el particular y el mecánico reciben 403 en las decisiones del taller', function (string $who, string $method, string $suffix, array $body) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($who === 'client' ? $w->client : $w->{$who});

    $this->json($method, rr($id, $suffix), $suffix === '/quotes' ? quoteInput() : $body)
        ->assertForbidden()
        ->assertExactJson(['message' => 'No tienes permiso para esta acción.']);
    expect(RepairRequest::find($id)->status->value)->toBe('pending');
})->with(['client', 'mechanic'])->with([
    'aceptar' => ['POST', '/accept', []],
    'aceptar con presupuesto' => ['POST', '/accept', ['quote' => quoteInput()]],
    'rechazar' => ['POST', '/reject', ['reason' => 'No hacemos chapa']],
    'enviar presupuesto' => ['POST', '/quotes', []],
]);

// ───────────────────────── Transiciones del taller (§3.13.4) ─────────────────────────

it('aceptar sin presupuesto: pending → accepted con responded_at; aceptar dos veces da 409', function (string $who) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->{$who});

    $this->postJson(rr($id, '/accept'), ['quote' => null])->assertOk()
        ->assertJsonPath('data.status', 'accepted')
        ->assertJsonPath('data.closed_at', null)
        ->assertJsonPath('data.quotes', []);
    expect(RepairRequest::find($id)->responded_at)->not->toBeNull();

    $this->postJson(rr($id, '/accept'))->assertConflict()->assertExactJson(['message' => 'Esta solicitud ya tiene respuesta.']);

    $activity = Activity::query()->where('action', 'repair_request.accepted')->sole();
    expect($activity->workspace_id)->toBe($w->wws->id)
        ->and($activity->user_id)->toBe($w->{$who}->id)
        ->and($activity->summary)->toBe($w->{$who}->name.' aceptó la solicitud de Seat Ibiza (1234ABC)')
        ->and($activity->vehicle_id)->toBeNull();
})->with(['owner', 'manager']);

it('rechazar con motivo desde pending, accepted o quoted: rejected con closed_at; la versión vigente pasa a superseded', function (string $from) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->manager);
    if ($from === 'accepted') {
        $this->postJson(rr($id, '/accept'))->assertOk();
    } elseif ($from === 'quoted') {
        $this->postJson(rr($id, '/accept'), ['quote' => quoteInput()])->assertOk();
    }

    $data = $this->postJson(rr($id, '/reject'), ['reason' => '  No trabajamos esa marca.  '])->assertOk()->json('data');

    expect($data['status'])->toBe('rejected')
        ->and($data['reject_reason'])->toBe('No trabajamos esa marca.')
        ->and($data['closed_at'])->not->toBeNull()
        ->and($data['responded_at'])->not->toBeNull()
        ->and(array_column($data['quotes'], 'status'))->toBe($from === 'quoted' ? ['superseded'] : []);
    expect(Activity::query()->where('action', 'repair_request.rejected')->sole()->summary)
        ->toBe('Elena Gerente rechazó la solicitud de Seat Ibiza (1234ABC)');
})->with(['pending', 'accepted', 'quoted']);

it('rechazar exige un motivo de 5 a 500 caracteres (422)', function (array $body) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);

    $this->postJson(rr($id, '/reject'), $body)->assertUnprocessable()->assertJsonValidationErrors('reason');
    expect(RepairRequest::find($id)->status->value)->toBe('pending');
})->with([[[]], [['reason' => '   ']], [['reason' => 'Nop']], [['reason' => str_repeat('a', 501)]]]);

it('no se puede aceptar ni rechazar una solicitud cerrada (409)', function (string $closedBy) {
    $w = e16World();
    $id = sendRequest($w);
    if ($closedBy === 'cancel') {
        $this->postJson(rr($id, '/cancel'))->assertOk();
    } else {
        loginAs($w->owner);
        $this->postJson(rr($id, '/reject'), ['reason' => 'Agenda completa'])->assertOk();
    }
    loginAs($w->owner);

    foreach ([['/accept', []], ['/reject', ['reason' => 'Otra vez no']], ['/quotes', quoteInput()]] as [$suffix, $body]) {
        $this->postJson(rr($id, $suffix), $body)->assertConflict()->assertExactJson(['message' => 'Esta solicitud ya está cerrada.']);
    }
})->with(['cancel', 'reject']);

// ───────────────────────── Transiciones del particular (§3.13.4) ─────────────────────────

it('cancelar desde pending, accepted o quoted: cancelled con closed_at y la versión vigente superseded', function (string $from) {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);
    if ($from === 'accepted') {
        $this->postJson(rr($id, '/accept'))->assertOk();
    } elseif ($from === 'quoted') {
        $this->postJson(rr($id, '/accept'), ['quote' => quoteInput()])->assertOk();
    }
    loginAs($w->client);

    $data = $this->postJson(rr($id, '/cancel'))->assertOk()->json('data');

    expect($data['status'])->toBe('cancelled')
        ->and($data['closed_at'])->not->toBeNull()
        ->and(array_column($data['quotes'], 'status'))->toBe($from === 'quoted' ? ['superseded'] : []);
    $this->postJson(rr($id, '/cancel'))->assertConflict()->assertExactJson(['message' => 'Esta solicitud ya está cerrada.']);

    $activity = Activity::query()->where('action', 'repair_request.cancelled')->sole();
    expect($activity->workspace_id)->toBe($w->pws->id)
        ->and($activity->summary)->toBe('Cancelaste la solicitud a Taller Destino para Seat Ibiza');
})->with(['pending', 'accepted', 'quoted']);

it('compartir o retirar el historial mientras está abierta; cerrada da 409', function () {
    $w = e16World();
    $id = sendRequest($w);

    $this->patchJson(rr($id), ['share_history' => true])->assertOk()
        ->assertJsonPath('data.share_history', true)
        ->assertJsonPath('data.history_available', true);
    $this->patchJson(rr($id), ['share_history' => false])->assertOk()
        ->assertJsonPath('data.history_available', false);
    $this->patchJson(rr($id), [])->assertUnprocessable()->assertJsonValidationErrors('share_history');

    $this->postJson(rr($id, '/cancel'))->assertOk();
    $this->patchJson(rr($id), ['share_history' => true])->assertConflict()->assertExactJson(['message' => 'Esta solicitud ya está cerrada.']);
});

it('las transiciones bloquean la fila: una segunda transición sobre el estado ya cambiado da 409', function () {
    $w = e16World();
    $id = sendRequest($w);
    $stale = RepairRequest::find($id); // instancia leída antes del primer clic
    loginAs($w->owner);

    $this->postJson(rr($id, '/accept'))->assertOk();
    // El servicio relee la fila con lockForUpdate: no se fía del estado de la instancia que recibe.
    expect(fn () => app(\App\Services\RepairRequestService::class)->accept($stale, null))
        ->toThrow(\App\Exceptions\ConflictException::class, 'Esta solicitud ya tiene respuesta.');
    expect(RepairRequest::find($id)->status->value)->toBe('accepted');
});

// ───────────────────────── Historial compartido (§3.13.7) ─────────────────────────

it('el historial compartido: no archivadas, desc, sin importes ni descripciones, para las dos partes', function () {
    $w = e16World();
    $maintenance = app(MaintenanceService::class);
    $maintenance->create($w->car, ['type' => 'maintenance', 'zone' => 'engine', 'service_kind' => 'oil', 'title' => 'Cambio de aceite',
        'description' => 'Nota privada', 'service_date' => day(-60), 'mileage' => 80000, 'workshop_name' => 'Taller Ejemplo', 'total_cost' => '75.00']);
    $maintenance->create($w->car, ['type' => 'repair', 'zone' => 'brakes', 'title' => 'Pastillas', 'service_date' => day(-10), 'total_cost' => '120.00']);
    $archived = $maintenance->create($w->car, ['type' => 'repair', 'zone' => 'body', 'title' => 'Archivada', 'service_date' => day(-5)]);
    $maintenance->archive($archived);
    $id = sendRequest($w, ['share_history' => true]);

    foreach ([$w->client, $w->mechanic] as $user) {
        loginAs($user);
        $history = $this->getJson(rr($id, '/history'))->assertOk()->json('data');
        expect($history)->toBe([
            ['service_date' => day(-10), 'type' => 'repair', 'zone' => 'brakes', 'service_kind' => null, 'title' => 'Pastillas', 'mileage' => null, 'workshop_name' => null],
            ['service_date' => day(-60), 'type' => 'maintenance', 'zone' => 'engine', 'service_kind' => 'oil', 'title' => 'Cambio de aceite', 'mileage' => 80000, 'workshop_name' => 'Taller Ejemplo'],
        ]);
    }
});

it('el historial da 403 si no se comparte, si la solicitud se cerró o si el coche ya no existe', function (string $case) {
    $w = e16World();
    $id = sendRequest($w, ['share_history' => $case !== 'sin consentimiento']);
    if ($case === 'cerrada') {
        $this->postJson(rr($id, '/cancel'))->assertOk();
    } elseif ($case === 'coche borrado') {
        DB::table('repair_requests')->where('id', $id)->update(['vehicle_id' => null]);
    }
    loginAs($w->owner);

    $this->getJson(rr($id, '/history'))->assertForbidden()
        ->assertExactJson(['message' => 'El cliente no comparte su historial con el taller.']);
})->with(['sin consentimiento', 'cerrada', 'coche borrado']);

it('borrar el coche cancela sus solicitudes abiertas y conserva la copia fija de las cerradas', function () {
    $w = e16World();
    $open = sendRequest($w, ['share_history' => true]);
    $other = makeUser('Otra Dueña', 'Neumáticos Prueba');
    listWorkshop(workshopOf($other));
    $closed = sendRequest($w, ['workshop_id' => workshopOf($other)->id]);
    $this->postJson(rr($closed, '/cancel'))->assertOk();

    $service = app(VehicleService::class);
    $service->archive($w->car);
    $service->delete($w->car->fresh());

    $openRequest = RepairRequest::find($open);
    expect($openRequest->status->value)->toBe('cancelled')
        ->and($openRequest->closed_at)->not->toBeNull()
        ->and($openRequest->vehicle_id)->toBeNull()
        ->and($openRequest->historyAvailable())->toBeFalse()
        ->and(RepairRequest::find($closed)->vehicle_make)->toBe('Seat');

    $this->getJson(rr($open))->assertOk()->assertJsonPath('data.vehicle.display_name', 'Seat Ibiza')->assertJsonPath('data.vehicle_id', null);
});
