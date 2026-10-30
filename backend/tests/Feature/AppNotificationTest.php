<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Services\VehicleService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/*
 * E16 · Notificaciones en la app (contrato §3.13.8, ADR‑0007 opción 4C): tabla `notifications` estándar
 * de Laravel. Destinatarios: de lo que hace el taller, el particular; de lo que hace el particular, el owner
 * y los managers del taller en ese momento. Nunca quien hace la acción, nunca el mecánico, y las frases sin
 * el nombre, el email ni el teléfono del particular.
 */

function rn(int $id, string $suffix = ''): string
{
    return "/api/v1/repair-requests/{$id}{$suffix}";
}

/** @return list<array{kind: string, summary: string, workspace_id: int, repair_request_id: int|null}> */
function notificationsOf(User $user): array
{
    return $user->notifications()->reorder()->orderBy('created_at')->orderBy('id')->get()
        ->map(fn ($n) => $n->data)->values()->all();
}

/** Ninguna frase lleva el nombre, el email ni el teléfono del particular. */
function expectNoPersonalData(object $w): void
{
    $summaries = DB::table('notifications')->pluck('data')->implode("\n");
    expect($summaries)->not->toContain('Lucía')
        ->and($summaries)->not->toContain($w->client->email)
        ->and($summaries)->not->toContain('600 000 000');
}

it('una solicitud nueva avisa al owner y a los managers del taller, no al mecánico ni a quien la envía', function () {
    $w = e16World();
    $id = sendRequest($w);

    $expected = [['kind' => 'repair_request.received', 'summary' => 'Nueva solicitud para Seat Ibiza (1234ABC): «Ruido al frenar»',
        'workspace_id' => $w->wws->id, 'repair_request_id' => $id]];
    expect(notificationsOf($w->owner))->toBe($expected)
        ->and(notificationsOf($w->manager))->toBe($expected)
        ->and(notificationsOf($w->mechanic))->toBe([])
        ->and(notificationsOf($w->client))->toBe([])
        ->and(notificationsOf($w->intruder))->toBe([]);
    expectNoPersonalData($w);
});

it('las respuestas del taller avisan solo al particular, desde su espacio personal', function () {
    $w = e16World();
    $a = sendRequest($w);
    $b = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws, ['make' => 'Kia', 'model' => 'Sportage', 'plate' => null])->id, 'mileage' => 0]);
    $c = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws, ['plate' => '5555EEE'])->id, 'mileage' => 0]);
    DB::table('notifications')->delete();
    loginAs($w->manager);

    $this->postJson(rn($a, '/accept'))->assertOk();
    $this->postJson(rn($a, '/quotes'), quoteInput())->assertCreated();
    $this->postJson(rn($b, '/accept'), ['quote' => quoteInput()])->assertOk();
    $this->postJson(rn($c, '/reject'), ['reason' => 'Agenda completa'])->assertOk();

    $client = fn (int $id, string $kind, string $summary) => ['kind' => $kind, 'summary' => $summary, 'workspace_id' => $w->pws->id, 'repair_request_id' => $id];
    expect(notificationsOf($w->client))->toBe([
        $client($a, 'repair_request.accepted', 'Taller Destino aceptó tu solicitud para Seat Ibiza. El presupuesto llegará después'),
        $client($a, 'repair_quote.sent', 'Taller Destino te envió un presupuesto para Seat Ibiza'),
        $client($b, 'repair_quote.sent', 'Taller Destino aceptó tu solicitud y te envió un presupuesto para Kia Sportage'),
        $client($c, 'repair_request.rejected', 'Taller Destino rechazó tu solicitud para Seat Ibiza'),
    ]);
    foreach (['owner', 'manager', 'mechanic'] as $who) {
        expect(notificationsOf($w->{$who}))->toBe([]);
    }
});

it('las acciones del particular avisan al owner y a los managers con frases sin su nombre', function () {
    $w = e16World();
    $cancelled = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws, ['make' => 'Kia', 'model' => 'Sportage', 'plate' => null])->id, 'mileage' => 0]);
    $id = sendRequest($w);
    loginAs($w->owner);
    $v1 = $this->postJson(rn($id, '/accept'), ['quote' => quoteInput()])->json('data.quotes.0.id');
    $v2 = null;
    DB::table('notifications')->delete();
    loginAs($w->client);

    $this->postJson(rn($cancelled, '/cancel'))->assertOk();
    $this->postJson(rn($id, '/quote/reject'), ['quote_id' => $v1, 'reason' => 'Caro'])->assertOk();
    loginAs($w->owner);
    $v2 = $this->postJson(rn($id, '/quotes'), quoteInput())->json('data.quotes.0.id');
    loginAs($w->client);
    $number = $this->postJson(rn($id, '/quote/accept'), ['quote_id' => $v2])->assertOk()->json('data.work_order.number');

    $workshop = fn (int $rid, string $kind, string $summary) => ['kind' => $kind, 'summary' => $summary, 'workspace_id' => $w->wws->id, 'repair_request_id' => $rid];
    $expected = [
        $workshop($cancelled, 'repair_request.cancelled', 'El cliente canceló la solicitud de Kia Sportage'),
        $workshop($id, 'repair_quote.rejected', 'El cliente rechazó el presupuesto v1 de Seat Ibiza (1234ABC)'),
        $workshop($id, 'repair_quote.accepted', "El cliente aceptó el presupuesto de Seat Ibiza (1234ABC): se abrió {$number}"),
    ];
    expect(notificationsOf($w->owner))->toBe($expected)
        ->and(notificationsOf($w->manager))->toBe($expected)
        ->and(notificationsOf($w->mechanic))->toBe([])
        ->and(notificationsOf($w->client))->toHaveCount(1); // solo el presupuesto v2 que envió el taller
    expectNoPersonalData($w);
});

it('la orden lista avisa al particular; ningún otro cambio de estado de la orden avisa', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);
    $v1 = $this->postJson(rn($id, '/accept'), ['quote' => quoteInput()])->json('data.quotes.0.id');
    loginAs($w->client);
    $order = $this->postJson(rn($id, '/quote/accept'), ['quote_id' => $v1])->json('data.work_order');
    DB::table('notifications')->delete();
    loginAs($w->mechanic);

    foreach (['diagnosing', 'in_progress', 'ready', 'delivered'] as $status) {
        $this->postJson("/api/v1/work-orders/{$order['id']}/status", ['status' => $status])->assertOk();
    }

    expect(notificationsOf($w->client))->toBe([[
        'kind' => 'repair_request.order_ready', 'summary' => "Tu Seat Ibiza está listo en Taller Destino ({$order['number']})",
        'workspace_id' => $w->pws->id, 'repair_request_id' => $id,
    ]])->and(DB::table('notifications')->count())->toBe(1);
});

it('una orden que no viene de una solicitud no avisa a nadie al pasar a lista', function () {
    $w = e16World();
    $vehicle = makeVehicle($w->wws);
    $order = app(\App\Services\WorkOrderService::class)->create($w->wws, ['vehicle_id' => $vehicle->id, 'title' => 'Revisión']);
    loginAs($w->owner);

    $this->postJson("/api/v1/work-orders/{$order->id}/status", ['status' => 'ready'])->assertOk();

    expect(DB::table('notifications')->count())->toBe(0);
});

it('borrar el coche cancela la solicitud abierta y avisa al taller', function () {
    $w = e16World();
    $id = sendRequest($w);
    DB::table('notifications')->delete();
    $service = app(VehicleService::class);
    $service->archive($w->car);

    $this->deleteJson("/api/v1/vehicles/{$w->car->id}")->assertNoContent();

    expect(notificationsOf($w->owner))->toBe([[
        'kind' => 'repair_request.cancelled', 'summary' => 'El cliente canceló la solicitud de Seat Ibiza (1234ABC)',
        'workspace_id' => $w->wws->id, 'repair_request_id' => $id,
    ]])->and(notificationsOf($w->client))->toBe([]);
});

it('nunca avisa a quien hace la acción y usa los managers del taller en ese momento', function () {
    $w = e16World();
    $id = sendRequest($w);
    $late = addMember($w->wws, makeUser('Gerente Nuevo'), WorkspaceRole::Manager);
    $w->wws->members()->detach($w->manager->id);
    // Lucía pasa a ser también gerente del taller: aun así, no se avisa a sí misma.
    addMember($w->wws, $w->client, WorkspaceRole::Manager);
    DB::table('notifications')->delete();
    loginAs($w->client);

    $this->postJson(rn($id, '/cancel'))->assertOk();

    expect(notificationsOf($w->owner))->toHaveCount(1)
        ->and(notificationsOf($late))->toHaveCount(1)
        ->and(notificationsOf($w->manager))->toBe([])
        ->and(notificationsOf($w->client))->toBe([]);
});

// ───────────────────────── Endpoints ─────────────────────────

it('lista las notificaciones propias, las más recientes primero, con ?unread=1 y per_page 20 (máx. 50)', function () {
    $w = e16World();
    $first = sendRequest($w);
    $second = sendRequest($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 0]);
    DB::table('notifications')->where('data', 'like', '%"repair_request_id":'.$first.'%')->update(['created_at' => now()->subHour()]);
    loginAs($w->owner);

    $list = $this->getJson('/api/v1/notifications')->assertOk();
    expect(array_column($list->json('data'), 'repair_request_id'))->toBe([$second, $first])
        ->and($list->json('meta'))->toBe(['current_page' => 1, 'last_page' => 1, 'per_page' => 20, 'total' => 2])
        ->and($list->json('data.0'))->toMatchArray([
            'kind' => 'repair_request.received', 'workspace_id' => $w->wws->id, 'read_at' => null,
        ])
        ->and(Str::isUuid($list->json('data.0.id')))->toBeTrue();

    $this->getJson('/api/v1/notifications?per_page=500')->assertOk()->assertJsonPath('meta.per_page', 50);

    $this->postJson('/api/v1/notifications/read', ['ids' => [$list->json('data.1.id')]])->assertNoContent();
    $this->getJson('/api/v1/notifications?unread=1')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.repair_request_id', $second);
    expect($this->getJson('/api/v1/notifications')->json('data.1.read_at'))->not->toBeNull();

    // El particular no ve las del taller.
    loginAs($w->client);
    $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(0, 'data');
});

it('el contador cuenta las no leídas y marcar sin ids las marca todas', function () {
    $w = e16World();
    sendRequest($w);
    sendRequest($w, ['vehicle_id' => makeVehicle($w->pws)->id, 'mileage' => 0]);
    loginAs($w->manager);

    $this->getJson('/api/v1/notifications/count')->assertOk()->assertExactJson(['data' => ['unread' => 2]]);
    $this->postJson('/api/v1/notifications/read')->assertNoContent();
    $this->getJson('/api/v1/notifications/count')->assertOk()->assertExactJson(['data' => ['unread' => 0]]);

    // Las del owner siguen sin leer: cada uno marca las suyas.
    loginAs($w->owner);
    $this->getJson('/api/v1/notifications/count')->assertOk()->assertExactJson(['data' => ['unread' => 2]]);
});

it('los ids de notificaciones ajenas se ignoran al marcar como leídas', function () {
    $w = e16World();
    sendRequest($w);
    $ownerNotification = $w->owner->notifications()->sole();
    loginAs($w->intruder);

    $this->postJson('/api/v1/notifications/read', ['ids' => [$ownerNotification->id, 'no-existe']])->assertNoContent();

    expect($ownerNotification->fresh()->read_at)->toBeNull();
    $this->postJson('/api/v1/notifications/read', ['ids' => 'todas'])->assertUnprocessable()->assertJsonValidationErrors('ids');
});

it('borrar la cuenta borra sus notificaciones (la tabla polimórfica no tiene clave foránea)', function () {
    $w = e16World();
    sendRequest($w);
    $other = $w->manager->notifications()->count();
    loginAs($w->owner);

    $this->deleteJson('/api/v1/me', ['password' => 'password'])->assertNoContent();

    expect(DB::table('notifications')->where('notifiable_type', User::class)->where('notifiable_id', $w->owner->id)->count())->toBe(0)
        ->and(User::find($w->owner->id))->toBeNull()
        ->and($w->manager->notifications()->count())->toBe($other); // la gerente conserva las suyas (su taller se borró con el owner)
});

it('si la solicitud de una notificación ya no existe, abrirla da 404', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->client);
    $this->deleteJson('/api/v1/me', ['password' => 'password'])->assertNoContent();
    loginAs($w->owner);

    $this->getJson('/api/v1/notifications')->assertOk()->assertJsonPath('data.0.repair_request_id', $id);
    $this->getJson(rn($id))->assertNotFound();
});
