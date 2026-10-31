<?php

use App\Models\Activity;
use App\Models\Customer;
use App\Models\RepairRequest;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Services\ExpenseService;
use App\Services\MaintenanceService;
use App\Services\ReminderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/*
 * E16‑12 · Cada parte ve solo lo suyo (ADR‑0007, "Excepción acotada a ADR‑0002"). La solicitud no abre
 * nada más: incluso después de convertirse en orden, los endpoints de vehículos, intervenciones, gastos,
 * documentos, clientes y órdenes siguen dando 404 a la otra parte. El 404 a un tercero y el 403 entre las
 * partes en las rutas /repair-requests/{r}… están en RepairRequestTest e IsolationTest.
 */

/**
 * Solicitud de Lucía ya convertida en orden en el taller de Marcos, con un garaje con todo tipo de datos.
 * Las propiedades del objeto se sustituyen en las rutas con `api()`: '/vehicles/{car}' → '/api/v1/vehicles/7'.
 */
function convertedWorld(): object
{
    Storage::fake('local');
    $w = e16World();

    $w->record = app(MaintenanceService::class)->create($w->car, [
        'type' => 'repair', 'zone' => 'brakes', 'title' => 'Discos', 'service_date' => day(-20), 'total_cost' => '200.00',
    ]);
    $w->expense = app(ExpenseService::class)->create($w->car, ['category' => 'parking', 'amount' => '3.50', 'expense_date' => day()]);
    $w->reminder = app(ReminderService::class)->create($w->car, ['title' => 'ITV', 'kind' => 'itv', 'due_date' => day(90)]);
    $w->document = makeDocument($w->car);
    $w->log = $w->car->mileageLogs()->first();

    $id = sendRequest($w, ['share_history' => true]);
    loginAs($w->owner);
    $quoteId = test()->postJson("/api/v1/repair-requests/{$id}/accept", ['quote' => quoteInput()])->assertOk()->json('data.quotes.0.id');
    loginAs($w->client);
    test()->postJson("/api/v1/repair-requests/{$id}/quote/accept", ['quote_id' => $quoteId])->assertOk();

    $w->rr = RepairRequest::find($id);
    $w->order = $w->rr->workOrder;
    $w->customer = $w->rr->customer;
    $w->wvehicle = $w->order->vehicle;

    return $w;
}

dataset('garaje del particular', [
    'ver coche' => ['GET', '/vehicles/{car}'],
    'editar coche' => ['PATCH', '/vehicles/{car}'],
    'archivar coche' => ['POST', '/vehicles/{car}/archive'],
    'borrar coche' => ['DELETE', '/vehicles/{car}'],
    'resumen' => ['GET', '/vehicles/{car}/summary'],
    'zonas' => ['GET', '/vehicles/{car}/zones'],
    'diario' => ['GET', '/vehicles/{car}/journal'],
    'informe' => ['GET', '/vehicles/{car}/report'],
    'kilometraje' => ['GET', '/vehicles/{car}/mileage'],
    'borrar lectura' => ['DELETE', '/mileage/{log}'],
    'intervenciones' => ['GET', '/vehicles/{car}/maintenance'],
    'ver intervención' => ['GET', '/maintenance/{record}'],
    'gastos' => ['GET', '/vehicles/{car}/expenses'],
    'editar gasto' => ['PATCH', '/expenses/{expense}'],
    'recordatorios' => ['GET', '/vehicles/{car}/reminders'],
    'editar recordatorio' => ['PATCH', '/reminders/{reminder}'],
    'documentos' => ['GET', '/vehicles/{car}/documents'],
    'descargar documento' => ['GET', '/documents/{document}/download'],
    'espacio personal' => ['GET', '/workspaces/{pws}'],
    'vehículos del espacio' => ['GET', '/workspaces/{pws}/vehicles'],
    'dashboard personal' => ['GET', '/workspaces/{pws}/dashboard'],
    'actividad personal' => ['GET', '/workspaces/{pws}/activity'],
    'agenda personal' => ['GET', '/workspaces/{pws}/reminders'],
    'analítica personal' => ['GET', '/workspaces/{pws}/analytics'],
    'solicitudes enviadas' => ['GET', '/workspaces/{pws}/repair-requests'],
    'enviar en su nombre' => ['POST', '/workspaces/{pws}/repair-requests'],
]);

dataset('taller de la otra parte', [
    'ver orden' => ['GET', '/work-orders/{order}'],
    'editar orden' => ['PATCH', '/work-orders/{order}'],
    'borrar orden' => ['DELETE', '/work-orders/{order}'],
    'estado de la orden' => ['POST', '/work-orders/{order}/status'],
    'su ficha de cliente' => ['GET', '/customers/{customer}'],
    'editar su ficha' => ['PATCH', '/customers/{customer}'],
    'exportar su ficha' => ['POST', '/customers/{customer}/export'],
    'anonimizar su ficha' => ['POST', '/customers/{customer}/anonymize'],
    'vehículos de su ficha' => ['GET', '/customers/{customer}/vehicles'],
    'la copia del coche' => ['GET', '/vehicles/{wvehicle}'],
    'historial de la copia' => ['GET', '/vehicles/{wvehicle}/maintenance'],
    'gastos de la copia' => ['GET', '/vehicles/{wvehicle}/expenses'],
    'el taller' => ['GET', '/workspaces/{wws}'],
    'clientes del taller' => ['GET', '/workspaces/{wws}/customers'],
    'órdenes del taller' => ['GET', '/workspaces/{wws}/work-orders'],
    'vehículos del taller' => ['GET', '/workspaces/{wws}/vehicles'],
    'elevadores' => ['GET', '/workspaces/{wws}/bays'],
    'miembros' => ['GET', '/workspaces/{wws}/members'],
    'dashboard del taller' => ['GET', '/workspaces/{wws}/dashboard'],
    'actividad del taller' => ['GET', '/workspaces/{wws}/activity'],
    'solicitudes recibidas' => ['GET', '/workspaces/{wws}/repair-requests'],
    'perfil del directorio' => ['GET', '/workspaces/{wws}/directory-profile'],
    'editar el perfil' => ['PUT', '/workspaces/{wws}/directory-profile'],
]);

it('el taller recibe 404 en el garaje del particular, también después de la conversión', function (string $who, string $method, string $uri) {
    $w = convertedWorld();
    loginAs($w->{$who});

    $this->json($method, api($uri, $w))->assertNotFound()->assertExactJson(['message' => 'Recurso no encontrado.']);
    expect(Vehicle::find($w->car->id)->archived_at)->toBeNull();
})->with(['owner', 'manager', 'mechanic'])->with('garaje del particular');

it('el particular recibe 404 en el taller: en su orden, en su ficha de cliente y en la copia de su coche', function (string $method, string $uri) {
    $w = convertedWorld();
    loginAs($w->client);

    $this->json($method, api($uri, $w))->assertNotFound()->assertExactJson(['message' => 'Recurso no encontrado.']);
    expect(WorkOrder::find($w->order->id))->not->toBeNull()
        ->and(Customer::find($w->customer->id)->anonymized_at)->toBeNull();
})->with('taller de la otra parte');

it('un tercero recibe 404 en la solicitud y en todo lo que nació de ella', function (string $method, string $uri) {
    $w = convertedWorld();
    loginAs($w->intruder);

    $this->json($method, api($uri, $w))->assertNotFound();
})->with([
    'solicitud' => ['GET', '/repair-requests/{rr}'],
    'historial' => ['GET', '/repair-requests/{rr}/history'],
    'orden' => ['GET', '/work-orders/{order}'],
    'cliente' => ['GET', '/customers/{customer}'],
    'copia del coche' => ['GET', '/vehicles/{wvehicle}'],
    'coche del particular' => ['GET', '/vehicles/{car}'],
]);

it('el taller solo ve una solicitud en la bandeja del espacio destinatario, nunca en otro', function () {
    $w = convertedWorld();
    $otherOwner = makeUser('Otra Dueña', 'Otro Taller');
    listWorkshop(workshopOf($otherOwner));
    loginAs($otherOwner);

    $this->getJson('/api/v1/workspaces/'.workshopOf($otherOwner)->id.'/repair-requests')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/workspaces/'.workshopOf($otherOwner)->id.'/repair-requests?work_order_id='.$w->order->id)->assertOk()->assertJsonCount(0, 'data');
    // Un particular no puede enviar en nombre del taller ni filtrar por órdenes que no son suyas.
    loginAs($w->client);
    $this->getJson("/api/v1/workspaces/{$w->pws->id}/repair-requests?work_order_id=0")->assertOk()->assertJsonCount(1, 'data');
});

it('hasta que el cliente acepta el presupuesto, el taller no tiene su ficha ni su coche (minimización, ADR‑0007)', function () {
    $w = e16World();
    $id = sendRequest($w);
    loginAs($w->owner);
    $this->postJson("/api/v1/repair-requests/{$id}/accept", ['quote' => quoteInput()])->assertOk();

    expect(Customer::query()->where('workspace_id', $w->wws->id)->count())->toBe(0)
        ->and(Vehicle::query()->where('workspace_id', $w->wws->id)->count())->toBe(0)
        ->and(WorkOrder::query()->where('workspace_id', $w->wws->id)->count())->toBe(0);
});

it('ninguna frase del taller lleva el email o el teléfono del particular, ni su nombre salvo el alta del cliente', function () {
    $w = convertedWorld();
    // Más acciones sobre la misma pareja: rechazar un presupuesto, cancelar y la orden hasta entregada.
    $rejected = sendRequest($w);
    loginAs($w->manager);
    $v1 = $this->postJson("/api/v1/repair-requests/{$rejected}/accept", ['quote' => quoteInput()])->assertOk()->json('data.quotes.0.id');
    loginAs($w->client);
    $this->postJson("/api/v1/repair-requests/{$rejected}/quote/reject", ['quote_id' => $v1, 'reason' => 'Caro'])->assertOk();
    $this->postJson("/api/v1/repair-requests/{$rejected}/cancel")->assertOk();
    loginAs($w->mechanic);
    foreach (['in_progress', 'ready', 'delivered'] as $status) {
        $this->postJson("/api/v1/work-orders/{$w->order->id}/status", ['status' => $status])->assertOk();
    }

    $email = $w->client->email;
    $phone = '600 000 000';

    $activities = Activity::query()->where('workspace_id', $w->wws->id)->get();
    expect($activities->pluck('action')->all())->toContain('customer.created', 'work_order.created', 'repair_quote.accepted', 'repair_quote.rejected');
    foreach ($activities as $activity) {
        $text = $activity->summary.' '.json_encode($activity->metadata, JSON_UNESCAPED_UNICODE);
        expect($text)->not->toContain($email)->and($text)->not->toContain($phone);
        if ($activity->action !== 'customer.created') {
            expect($text)->not->toContain('Lucía');
        }
    }

    $summaries = DB::table('notifications')->pluck('data')->map(fn ($data) => json_decode($data, true)['summary']);
    expect($summaries)->not->toBeEmpty();
    foreach ($summaries as $summary) {
        expect($summary)->not->toContain('Lucía')->and($summary)->not->toContain($email)->and($summary)->not->toContain($phone);
    }
});
