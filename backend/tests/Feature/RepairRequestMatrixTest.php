<?php

use App\Models\RepairQuote;
use App\Models\RepairRequest;
use App\Models\WorkOrder;
use App\Services\VehicleService;
use Illuminate\Support\Facades\DB;

/*
 * E16 · Contrato §3.13.4, fila a fila: cada acción de la tabla se prueba desde los 6 estados de partida.
 * Desde los estados que la tabla permite, la transición con todo lo que dice su columna "Además" (fechas,
 * versión del presupuesto, a quién avisa). Desde los demás, 409 con el mensaje del contrato y nada cambia.
 * Los detalles de cada regla (frases, conversión, totales) están en RepairRequestTest y RepairQuoteTest.
 */

const MATRIX_CLOSED = 'Esta solicitud ya está cerrada.';
const MATRIX_ANSWERED = 'Esta solicitud ya tiene respuesta.';
const MATRIX_NOT_ACCEPTED = 'Acepta la solicitud antes de enviar un presupuesto (o acéptala directamente con presupuesto).';
const MATRIX_NO_QUOTE = 'Esta solicitud no tiene ningún presupuesto pendiente de respuesta.';
const MATRIX_STATES = ['pending', 'accepted', 'quoted', 'rejected', 'cancelled', 'converted'];

function rm(int $id, string $suffix = ''): string
{
    return "/api/v1/repair-requests/{$id}{$suffix}";
}

/**
 * Lleva por la API una solicitud de Lucía hasta $state, con los pasos reales.
 *
 * @return array{0: int, 1: int|null} Id de la solicitud y de su última versión de presupuesto (si tiene).
 */
function requestInState(object $w, string $state, array $overrides = []): array
{
    $id = sendRequest($w, $overrides);

    if ($state === 'cancelled') {
        test()->postJson(rm($id, '/cancel'))->assertOk();
    } elseif ($state !== 'pending') {
        loginAs($w->owner);
        match ($state) {
            'accepted' => test()->postJson(rm($id, '/accept'))->assertOk(),
            'rejected' => test()->postJson(rm($id, '/reject'), ['reason' => 'Agenda completa'])->assertOk(),
            default => test()->postJson(rm($id, '/accept'), ['quote' => quoteInput()])->assertOk(),
        };
    }

    $quoteId = RepairQuote::query()->where('repair_request_id', $id)->max('id');

    if ($state === 'converted') {
        loginAs($w->client);
        test()->postJson(rm($id, '/quote/accept'), ['quote_id' => $quoteId])->assertOk();
    }

    expect(RepairRequest::find($id)->status->value)->toBe($state);

    return [$id, $quoteId === null ? null : (int) $quoteId];
}

/**
 * Las filas de §3.13.4 (salvo "Borrar el vehículo", que no es una ruta de la solicitud).
 *  - from: estado de partida permitido ⇒ estado de llegada.
 *  - conflicts: mensaje del 409 desde otros estados abiertos (los cerrados dan siempre MATRIX_CLOSED).
 *  - notifies: [kind, destinatarios]; null si la fila no avisa.
 *  - then: comprobaciones de la columna "Además", con los datos de la respuesta y si había versión vigente.
 */
function matrixActions(): array
{
    return [
        'aceptar sin presupuesto' => [
            'actor' => 'owner', 'method' => 'POST', 'suffix' => '/accept', 'status' => 200,
            'body' => fn () => [],
            'from' => ['pending' => 'accepted'],
            'conflicts' => ['accepted' => MATRIX_ANSWERED, 'quoted' => MATRIX_ANSWERED],
            'notifies' => ['repair_request.accepted', ['client']],
            'then' => function (array $data) {
                expect($data['responded_at'])->not->toBeNull()
                    ->and($data['closed_at'])->toBeNull()
                    ->and($data['quotes'])->toBe([]);
            },
        ],
        'aceptar con presupuesto' => [
            'actor' => 'manager', 'method' => 'POST', 'suffix' => '/accept', 'status' => 200,
            'body' => fn () => ['quote' => quoteInput()],
            'from' => ['pending' => 'quoted'],
            'conflicts' => ['accepted' => MATRIX_ANSWERED, 'quoted' => MATRIX_ANSWERED],
            'notifies' => ['repair_quote.sent', ['client']],
            'then' => function (array $data) {
                expect($data['responded_at'])->not->toBeNull()
                    ->and(array_column($data['quotes'], 'version'))->toBe([1])
                    ->and($data['quotes'][0]['status'])->toBe('sent');
            },
        ],
        'enviar presupuesto' => [
            'actor' => 'manager', 'method' => 'POST', 'suffix' => '/quotes', 'status' => 201,
            'body' => fn () => quoteInput(),
            'from' => ['accepted' => 'quoted', 'quoted' => 'quoted'],
            'conflicts' => ['pending' => MATRIX_NOT_ACCEPTED],
            'notifies' => ['repair_quote.sent', ['client']],
            'then' => function (array $data, bool $hadQuote) {
                expect(array_column($data['quotes'], 'status'))->toBe($hadQuote ? ['sent', 'superseded'] : ['sent'])
                    ->and(array_column($data['quotes'], 'version'))->toBe($hadQuote ? [2, 1] : [1]);
            },
        ],
        'rechazar' => [
            'actor' => 'owner', 'method' => 'POST', 'suffix' => '/reject', 'status' => 200,
            'body' => fn () => ['reason' => 'No trabajamos esa marca.'],
            'from' => ['pending' => 'rejected', 'accepted' => 'rejected', 'quoted' => 'rejected'],
            'conflicts' => [],
            'notifies' => ['repair_request.rejected', ['client']],
            'then' => function (array $data, bool $hadQuote) {
                expect($data['reject_reason'])->toBe('No trabajamos esa marca.')
                    ->and($data['closed_at'])->not->toBeNull()
                    ->and($data['responded_at'])->not->toBeNull()
                    ->and(array_column($data['quotes'], 'status'))->toBe($hadQuote ? ['superseded'] : []);
            },
        ],
        'aceptar el presupuesto' => [
            'actor' => 'client', 'method' => 'POST', 'suffix' => '/quote/accept', 'status' => 200,
            'body' => fn (?int $quoteId) => ['quote_id' => $quoteId ?? 999999],
            'from' => ['quoted' => 'converted'],
            'conflicts' => ['pending' => MATRIX_NO_QUOTE, 'accepted' => MATRIX_NO_QUOTE],
            'notifies' => ['repair_quote.accepted', ['owner', 'manager']],
            'then' => function (array $data) {
                expect($data['closed_at'])->not->toBeNull()
                    ->and($data['quotes'][0]['status'])->toBe('accepted')
                    ->and($data['quotes'][0]['answered_at'])->not->toBeNull()
                    ->and($data['work_order']['status'])->toBe('received');
            },
        ],
        'rechazar el presupuesto' => [
            'actor' => 'client', 'method' => 'POST', 'suffix' => '/quote/reject', 'status' => 200,
            'body' => fn (?int $quoteId) => ['quote_id' => $quoteId ?? 999999, 'reason' => 'Es caro'],
            'from' => ['quoted' => 'accepted'],
            'conflicts' => ['pending' => MATRIX_NO_QUOTE, 'accepted' => MATRIX_NO_QUOTE],
            'notifies' => ['repair_quote.rejected', ['owner', 'manager']],
            'then' => function (array $data) {
                expect($data['closed_at'])->toBeNull()
                    ->and($data['work_order'])->toBeNull()
                    ->and($data['quotes'][0]['status'])->toBe('rejected')
                    ->and($data['quotes'][0]['client_reason'])->toBe('Es caro');
            },
        ],
        'cancelar' => [
            'actor' => 'client', 'method' => 'POST', 'suffix' => '/cancel', 'status' => 200,
            'body' => fn () => [],
            'from' => ['pending' => 'cancelled', 'accepted' => 'cancelled', 'quoted' => 'cancelled'],
            'conflicts' => [],
            'notifies' => ['repair_request.cancelled', ['owner', 'manager']],
            'then' => function (array $data, bool $hadQuote) {
                expect($data['closed_at'])->not->toBeNull()
                    ->and(array_column($data['quotes'], 'status'))->toBe($hadQuote ? ['superseded'] : []);
            },
        ],
        'compartir el historial' => [
            'actor' => 'client', 'method' => 'PATCH', 'suffix' => '', 'status' => 200,
            'body' => fn () => ['share_history' => true],
            'from' => ['pending' => 'pending', 'accepted' => 'accepted', 'quoted' => 'quoted'],
            'conflicts' => [],
            'notifies' => null,
            'then' => function (array $data) {
                expect($data['share_history'])->toBeTrue()
                    ->and($data['history_available'])->toBeTrue()
                    ->and($data['closed_at'])->toBeNull();
            },
        ],
    ];
}

dataset('acción y estado de partida', function () {
    foreach (array_keys(matrixActions()) as $action) {
        foreach (MATRIX_STATES as $state) {
            yield "{$action} desde {$state}" => [$action, $state];
        }
    }
});

it('§3.13.4: transición válida o 409, sin efectos secundarios si no procede', function (string $action, string $state) {
    $w = e16World();
    $row = matrixActions()[$action];
    [$id, $quoteId] = requestInState($w, $state);
    $hadSentQuote = $state === 'quoted';
    DB::table('notifications')->delete();
    $orders = WorkOrder::count();
    loginAs($w->{$row['actor']});

    $response = $this->json($row['method'], rm($id, $row['suffix']), ($row['body'])($quoteId));

    if (array_key_exists($state, $row['from'])) {
        $response->assertStatus($row['status'])->assertJsonPath('data.status', $row['from'][$state]);
        ($row['then'])($response->json('data'), $hadSentQuote);

        $recipients = DB::table('notifications')->orderBy('notifiable_id')->get(['notifiable_id', 'data']);
        if ($row['notifies'] === null) {
            expect($recipients)->toHaveCount(0);
        } else {
            [$kind, $who] = $row['notifies'];
            expect($recipients->pluck('notifiable_id')->sort()->values()->all())
                ->toBe(collect($who)->map(fn (string $name) => $w->{$name}->id)->sort()->values()->all());
            foreach ($recipients as $notification) {
                expect(json_decode($notification->data, true)['kind'])->toBe($kind);
            }
        }

        return;
    }

    $message = $row['conflicts'][$state] ?? MATRIX_CLOSED;
    if ($action === 'cancelar' && $state === 'converted') {
        $message = 'Esta solicitud ya es la orden '.RepairRequest::find($id)->workOrder->number.'. Para cancelarla, llama al taller.';
    }

    $response->assertConflict()->assertExactJson(['message' => $message]);
    expect(RepairRequest::find($id)->status->value)->toBe($state)
        ->and(DB::table('notifications')->count())->toBe(0)
        ->and(WorkOrder::count())->toBe($orders);
})->with('acción y estado de partida');

// ───────────────────────── Última fila: borrar el vehículo (§3.3) ─────────────────────────

it('borrar el coche cancela la solicitud abierta en la misma transacción y avisa al taller', function (string $state) {
    $w = e16World();
    [$id] = requestInState($w, $state, ['share_history' => true]);
    DB::table('notifications')->delete();
    loginAs($w->client);
    $this->postJson("/api/v1/vehicles/{$w->car->id}/archive")->assertOk();

    $this->deleteJson("/api/v1/vehicles/{$w->car->id}")->assertNoContent();

    $request = RepairRequest::find($id);
    expect($request->status->value)->toBe('cancelled')
        ->and($request->closed_at)->not->toBeNull()
        ->and($request->vehicle_id)->toBeNull()
        ->and($request->vehicle_make)->toBe('Seat')
        ->and($request->historyAvailable())->toBeFalse()
        ->and(RepairQuote::query()->where('repair_request_id', $id)->where('status', 'sent')->count())->toBe(0);

    $notified = DB::table('notifications')->pluck('notifiable_id')->sort()->values()->all();
    expect($notified)->toBe(collect([$w->owner->id, $w->manager->id])->sort()->values()->all());
})->with(['pending', 'accepted', 'quoted']);

it('borrar el coche no toca las solicitudes cerradas: conservan su estado y la copia fija, y nadie recibe aviso', function (string $state) {
    $w = e16World();
    [$id] = requestInState($w, $state);
    $closedAt = RepairRequest::find($id)->closed_at;
    DB::table('notifications')->delete();
    $service = app(VehicleService::class);
    $service->archive($w->car);

    $service->delete($w->car->fresh());

    $request = RepairRequest::find($id);
    expect($request->status->value)->toBe($state)
        ->and($request->closed_at?->toIso8601String())->toBe($closedAt?->toIso8601String())
        ->and($request->vehicle_id)->toBeNull()
        ->and($request->vehicle_plate)->toBe('1234ABC')
        ->and(DB::table('notifications')->count())->toBe(0);
})->with(['rejected', 'cancelled', 'converted']);

it('borrar un coche sin archivar da 409: la solicitud sigue abierta y el taller no recibe aviso', function (string $state) {
    $w = e16World();
    [$id] = requestInState($w, $state);
    DB::table('notifications')->delete();
    loginAs($w->client);

    $this->deleteJson("/api/v1/vehicles/{$w->car->id}")->assertConflict()
        ->assertExactJson(['message' => 'Archiva el vehículo antes de eliminarlo.']);

    expect(RepairRequest::find($id)->status->value)->toBe($state)
        ->and(RepairRequest::find($id)->vehicle_id)->toBe($w->car->id)
        ->and(DB::table('notifications')->count())->toBe(0);
})->with(['pending', 'accepted', 'quoted']);

// ───────────────────────── Retirar el consentimiento ─────────────────────────

it('retirar el historial también se puede en todos los estados abiertos y corta el acceso del taller', function (string $state) {
    $w = e16World();
    [$id] = requestInState($w, $state, ['share_history' => true]);
    loginAs($w->owner);
    $this->getJson(rm($id, '/history'))->assertOk();
    loginAs($w->client);

    $this->patchJson(rm($id), ['share_history' => false])->assertOk()
        ->assertJsonPath('data.share_history', false)
        ->assertJsonPath('data.history_available', false)
        ->assertJsonPath('data.status', $state);

    loginAs($w->owner);
    $this->getJson(rm($id, '/history'))->assertForbidden();
})->with(['pending', 'accepted', 'quoted']);

it('una solicitud convertida o rechazada deja de compartir el historial aunque el consentimiento siga activo', function (string $state) {
    $w = e16World();
    [$id] = requestInState($w, $state, ['share_history' => true]);
    loginAs($w->mechanic);

    $this->getJson(rm($id))->assertOk()
        ->assertJsonPath('data.share_history', true)
        ->assertJsonPath('data.history_available', false);
    $this->getJson(rm($id, '/history'))->assertForbidden()
        ->assertExactJson(['message' => 'El cliente no comparte su historial con el taller.']);
})->with(['rejected', 'cancelled', 'converted']);
