<?php

use Illuminate\Support\Facades\Route;

/*
 * Regla de oro 3: cada recurso se resuelve a través de su espacio. Un usuario de OTRO espacio
 * recibe 404 (no se revela que el recurso existe) y sin sesión, 401. Un caso por endpoint.
 */

/** Todas las rutas de la API que reciben un recurso en la URL (`route:list --path=api`). */
function resourceEndpoints(): array
{
    return [
        // Espacios, miembros y vistas del espacio
        'ver espacio' => ['GET', '/workspaces/{pws}'],
        'editar espacio' => ['PATCH', '/workspaces/{pws}'],
        'borrar taller' => ['DELETE', '/workspaces/{wws}'],
        'listar miembros' => ['GET', '/workspaces/{wws}/members'],
        'añadir miembro' => ['POST', '/workspaces/{wws}/members'],
        'cambiar rol' => ['PATCH', '/workspaces/{wws}/members/{mechanic}'],
        'quitar miembro' => ['DELETE', '/workspaces/{wws}/members/{mechanic}'],
        'dashboard personal' => ['GET', '/workspaces/{pws}/dashboard'],
        'dashboard taller' => ['GET', '/workspaces/{wws}/dashboard'],
        'actividad' => ['GET', '/workspaces/{pws}/activity'],
        'agenda de recordatorios' => ['GET', '/workspaces/{pws}/reminders'],
        'analítica' => ['GET', '/workspaces/{pws}/analytics'],
        'listar vehículos' => ['GET', '/workspaces/{pws}/vehicles'],
        'crear vehículo' => ['POST', '/workspaces/{pws}/vehicles'],
        'listar clientes' => ['GET', '/workspaces/{wws}/customers'],
        'crear cliente' => ['POST', '/workspaces/{wws}/customers'],
        'listar órdenes' => ['GET', '/workspaces/{wws}/work-orders'],
        'crear orden' => ['POST', '/workspaces/{wws}/work-orders'],
        'elevadores' => ['GET', '/workspaces/{wws}/bays'],
        // Vehículo y vistas derivadas
        'ver vehículo' => ['GET', '/vehicles/{vehicle}'],
        'editar vehículo' => ['PATCH', '/vehicles/{vehicle}'],
        'borrar vehículo' => ['DELETE', '/vehicles/{vehicle}'],
        'archivar vehículo' => ['POST', '/vehicles/{vehicle}/archive'],
        'restaurar vehículo' => ['POST', '/vehicles/{vehicle}/restore'],
        'resumen' => ['GET', '/vehicles/{vehicle}/summary'],
        'zonas' => ['GET', '/vehicles/{vehicle}/zones'],
        'diario' => ['GET', '/vehicles/{vehicle}/journal'],
        'informe' => ['GET', '/vehicles/{vehicle}/report'],
        // Kilometraje
        'listar km' => ['GET', '/vehicles/{vehicle}/mileage'],
        'registrar km' => ['POST', '/vehicles/{vehicle}/mileage'],
        'borrar lectura' => ['DELETE', '/mileage/{log}'],
        // Intervenciones
        'listar intervenciones' => ['GET', '/vehicles/{vehicle}/maintenance'],
        'crear intervención' => ['POST', '/vehicles/{vehicle}/maintenance'],
        'ver intervención' => ['GET', '/maintenance/{record}'],
        'editar intervención' => ['PATCH', '/maintenance/{record}'],
        'archivar intervención' => ['POST', '/maintenance/{record}/archive'],
        'restaurar intervención' => ['POST', '/maintenance/{record}/restore'],
        // Gastos
        'listar gastos' => ['GET', '/vehicles/{vehicle}/expenses'],
        'crear gasto' => ['POST', '/vehicles/{vehicle}/expenses'],
        'editar gasto' => ['PATCH', '/expenses/{expense}'],
        'borrar gasto' => ['DELETE', '/expenses/{expense}'],
        // Recordatorios
        'listar recordatorios' => ['GET', '/vehicles/{vehicle}/reminders'],
        'crear recordatorio' => ['POST', '/vehicles/{vehicle}/reminders'],
        'editar recordatorio' => ['PATCH', '/reminders/{reminder}'],
        'borrar recordatorio' => ['DELETE', '/reminders/{reminder}'],
        'completar recordatorio' => ['POST', '/reminders/{reminder}/complete'],
        'descartar recordatorio' => ['POST', '/reminders/{reminder}/dismiss'],
        // Documentos
        'listar documentos' => ['GET', '/vehicles/{vehicle}/documents'],
        'subir documento' => ['POST', '/vehicles/{vehicle}/documents'],
        'descargar documento' => ['GET', '/documents/{document}/download'],
        'borrar documento' => ['DELETE', '/documents/{document}'],
        // Taller: clientes
        'ver cliente' => ['GET', '/customers/{customer}'],
        'editar cliente' => ['PATCH', '/customers/{customer}'],
        'borrar cliente' => ['DELETE', '/customers/{customer}'],
        'vehículos del cliente' => ['GET', '/customers/{customer}/vehicles'],
        // Taller: órdenes
        'ver orden' => ['GET', '/work-orders/{order}'],
        'editar orden' => ['PATCH', '/work-orders/{order}'],
        'borrar orden' => ['DELETE', '/work-orders/{order}'],
        'cambiar estado de orden' => ['POST', '/work-orders/{order}/status'],
    ];
}

/** Rutas autenticadas sin recurso en la URL. */
function accountEndpoints(): array
{
    return [
        ['GET', '/me'], ['PATCH', '/me'], ['PUT', '/me/password'], ['DELETE', '/me'],
        ['POST', '/auth/logout'], ['GET', '/workspaces'], ['POST', '/workspaces'],
    ];
}

/** Rutas públicas. */
function publicEndpoints(): array
{
    return [['GET', '/health'], ['POST', '/auth/register'], ['POST', '/auth/login']];
}

dataset('endpoints con recurso', resourceEndpoints());

/** Las que cuelgan del espacio personal de Olga (no del taller). */
dataset('endpoints del garaje personal', array_filter(
    resourceEndpoints(),
    fn (array $e) => preg_match('/\{(pws|vehicle|log|record|expense|reminder|document)\}/', $e[1]) === 1,
));

it('los datasets cubren todas las rutas de route:list --path=api', function () {
    $normalize = fn (string $method, string $uri) => $method.' /'.preg_replace('/\{[^}]+\}/', '{}', trim($uri, '/'));
    $covered = collect([...resourceEndpoints(), ...accountEndpoints(), ...publicEndpoints()])
        ->map(fn (array $e) => $normalize($e[0], 'api/v1'.$e[1]));

    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/'))
        ->flatMap(fn ($route) => collect($route->methods())->reject(fn ($m) => $m === 'HEAD')->map(fn ($m) => $normalize($m, $route->uri())));

    expect($routes->diff($covered)->values()->all())->toBe([], 'Rutas sin test de aislamiento/401')
        ->and($covered->diff($routes)->values()->all())->toBe([], 'Entradas del dataset que ya no existen')
        ->and($covered->duplicates()->values()->all())->toBe(['GET /api/v1/workspaces/{}/dashboard']); // personal y taller
});

it('toda ruta no pública exige sesión y toda ruta con recurso pasa por una policy', function () {
    $public = collect(publicEndpoints())->map(fn (array $e) => 'api/v1'.$e[1])->all();

    foreach (Route::getRoutes()->getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/') || in_array($route->uri(), $public, true)) {
            continue;
        }
        $middleware = $route->gatherMiddleware();
        expect($middleware)->toContain('auth:sanctum');
        if (str_contains($route->uri(), '{')) {
            expect(collect($middleware)->contains(fn ($m) => str_starts_with($m, 'can:')))
                ->toBeTrue("{$route->uri()} no tiene middleware can:");
        }
    }
});

it('responde 404 a un usuario de otro espacio', function (string $method, string $uri) {
    $w = world();
    // La intrusa tiene sus propios espacios (personal y taller), pero ninguno es el de Olga.
    loginAs(makeUser('Irene Intrusa', 'Taller Irene'));

    $this->json($method, api($uri, $w), ['name' => 'X', 'title' => 'X', 'status' => 'ready', 'email' => 'a@b.test'])
        ->assertNotFound()
        ->assertExactJson(['message' => 'Recurso no encontrado.']);
})->with('endpoints con recurso');

it('no modifica nada cuando un intruso intenta escribir', function () {
    $w = world();
    loginAs(makeUser('Irene Intrusa'));

    $this->postJson(api('/vehicles/{vehicle}/archive', $w))->assertNotFound();
    $this->deleteJson(api('/documents/{document}', $w))->assertNotFound();
    $this->postJson(api('/work-orders/{order}/status', $w), ['status' => 'cancelled'])->assertNotFound();

    expect($w->vehicle->fresh()->archived_at)->toBeNull()
        ->and($w->document->fresh())->not->toBeNull()
        ->and($w->order->fresh()->status->value)->toBe('received');
});

it('responde 401 sin sesión', function (string $method, string $uri) {
    $w = world();
    auth()->forgetGuards();

    $this->json($method, api($uri, $w))
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'No autenticado.']);
})->with('endpoints con recurso');

it('responde 401 sin sesión en las rutas de cuenta y espacios', function (string $method, string $uri) {
    $this->json($method, '/api/v1'.$uri)->assertUnauthorized()->assertExactJson(['message' => 'No autenticado.']);
})->with(accountEndpoints());

it('los miembros del taller no ven el garaje personal de la dueña (404)', function (string $who, string $method, string $uri) {
    $w = world();
    // Comparten el taller con Olga, pero su espacio personal es solo suyo: ni el gerente (manage) lo ve.
    loginAs($w->{$who});

    $this->json($method, api($uri, $w), ['name' => 'X', 'title' => 'X', 'status' => 'ready', 'email' => 'a@b.test'])
        ->assertNotFound()
        ->assertExactJson(['message' => 'Recurso no encontrado.']);
})->with(['mechanic', 'manager'])->with('endpoints del garaje personal');

it('responde 404 a un id inexistente', function () {
    loginAs(makeUser());

    $this->getJson('/api/v1/vehicles/999999')->assertNotFound()->assertExactJson(['message' => 'Recurso no encontrado.']);
    $this->getJson('/api/v1/no-existe')->assertNotFound();
});

it('las rutas de taller responden 404 en un espacio personal', function (string $method, string $suffix) {
    $user = makeUser();
    loginAs($user);
    $ws = $user->personalWorkspace();

    $this->json($method, "/api/v1/workspaces/{$ws->id}/{$suffix}", ['name' => 'Cliente'])->assertNotFound();
})->with([
    ['GET', 'customers'], ['POST', 'customers'], ['GET', 'work-orders'], ['POST', 'work-orders'], ['GET', 'bays'],
]);

it('solo lista los espacios y vehículos propios', function () {
    $w = world();
    $other = makeUser('Otra Persona');
    makeVehicle($other->personalWorkspace(), ['make' => 'Ajeno']);
    loginAs($w->owner);

    $this->getJson('/api/v1/workspaces')->assertOk()->assertJsonCount(2, 'data');
    $this->getJson(api('/workspaces/{pws}/vehicles', $w))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $w->vehicle->id);
});
