<?php

use App\Models\Activity;
use App\Models\WorkshopProfile;

/*
 * E16 · Directorio de talleres (contrato §3.13.1 y §3.13.2, ADR‑0007).
 *  - GET /workshops y /workshops/{id}: cualquier usuario con sesión, solo talleres con listed = true.
 *  - GET/PUT /workspaces/{ws}/directory-profile: lo ve el equipo del taller; solo el owner lo edita.
 */

it('lista solo los talleres con listed = true, por nombre, con is_member', function () {
    $w = e16World();
    $b = makeUser('Beatriz Taller', 'Neumáticos Prueba');
    listWorkshop(workshopOf($b), ['city' => 'Tarragona', 'services' => ['tyres'], 'phone' => null, 'address' => null]);
    $hidden = makeUser('Oculto', 'Taller Oculto');
    listWorkshop(workshopOf($hidden), ['listed' => false]);
    loginAs($w->manager);

    $list = $this->getJson('/api/v1/workshops')->assertOk();

    expect(array_column($list->json('data'), 'name'))->toBe(['Neumáticos Prueba', 'Taller Destino'])
        ->and($list->json('meta.total'))->toBe(2)
        ->and($list->json('data.0'))->toBe([
            'id' => workshopOf($b)->id, 'name' => 'Neumáticos Prueba', 'city' => 'Tarragona', 'address' => null,
            'phone' => null, 'services' => ['tyres'], 'opening_hours' => 'L-V 8:00-14:00', 'is_member' => false,
        ])
        ->and($list->json('data.1.is_member'))->toBeTrue(); // la gerente es miembro de Taller Destino
});

it('busca por nombre o ciudad sin distinguir mayúsculas y filtra por servicio', function () {
    $w = e16World();
    listWorkshop(workshopOf(makeUser('B', 'Neumáticos Prueba')), ['city' => 'Tarragona', 'services' => ['tyres', 'ac']]);
    loginAs($w->client);

    $names = fn (string $query) => array_column($this->getJson('/api/v1/workshops'.$query)->assertOk()->json('data'), 'name');

    expect($names('?search=destino'))->toBe(['Taller Destino'])
        ->and($names('?search=TARRA'))->toBe(['Neumáticos Prueba'])
        ->and($names('?service=brakes'))->toBe(['Taller Destino'])
        ->and($names('?service=ac'))->toBe(['Neumáticos Prueba'])
        ->and($names('?service=bodywork'))->toBe([]);

    $this->getJson('/api/v1/workshops?service=lavado')->assertUnprocessable()->assertJsonValidationErrors('service');
});

it('la ficha del directorio da 404 si no existe, no es un taller o no está en el directorio', function () {
    $w = e16World();
    loginAs($w->intruder);

    $this->getJson("/api/v1/workshops/{$w->wws->id}")->assertOk()
        ->assertJsonPath('data.name', 'Taller Destino')
        ->assertJsonPath('data.city', 'Lleida')
        ->assertJsonPath('data.is_member', false);

    $this->getJson("/api/v1/workshops/{$w->pws->id}")->assertNotFound()->assertExactJson(['message' => 'Recurso no encontrado.']);
    $this->getJson('/api/v1/workshops/999999')->assertNotFound();
    $this->getJson('/api/v1/workshops/'.workshopOf($w->intruder)->id)->assertNotFound(); // nunca guardó su perfil

    WorkshopProfile::query()->where('workspace_id', $w->wws->id)->update(['listed' => false]);
    $this->getJson("/api/v1/workshops/{$w->wws->id}")->assertNotFound();
});

it('el perfil que nunca se guardó sale vacío y con listed = false', function () {
    $w = e16World();
    loginAs($w->intruder);

    $this->getJson('/api/v1/workspaces/'.workshopOf($w->intruder)->id.'/directory-profile')->assertOk()
        ->assertExactJson(['data' => [
            'workspace_id' => workshopOf($w->intruder)->id, 'listed' => false, 'city' => null, 'address' => null,
            'phone' => null, 'services' => [], 'opening_hours' => null, 'updated_at' => null,
        ]]);
});

it('el owner guarda el perfil, deja rastro en la actividad y aparece en el directorio', function () {
    $owner = makeUser('Ana Dueña', 'Talleres Ejemplo Norte');
    $ws = workshopOf($owner);
    loginAs($owner);

    $profile = $this->putJson("/api/v1/workspaces/{$ws->id}/directory-profile", [
        'listed' => true, 'city' => '  Lleida ', 'address' => 'C/ Inventada, 12', 'phone' => '+34 (973) 000-000',
        'services' => ['tyres', 'brakes'], 'opening_hours' => 'L-V 8:00-14:00 y 15:30-19:00',
    ])->assertOk();

    expect($profile->json('data'))->toMatchArray([
        'workspace_id' => $ws->id, 'listed' => true, 'city' => 'Lleida', 'services' => ['tyres', 'brakes'],
    ])->and($profile->json('data.updated_at'))->not->toBeNull();

    $activity = Activity::query()->where('workspace_id', $ws->id)->where('action', 'directory_profile.updated')->sole();
    expect($activity->summary)->toBe('Ana Dueña actualizó el perfil del directorio')
        ->and($activity->user_id)->toBe($owner->id);

    $this->getJson('/api/v1/workshops?search=norte')->assertOk()->assertJsonPath('data.0.id', $ws->id);
    $this->getJson("/api/v1/workspaces/{$ws->id}/directory-profile")->assertOk()->assertJsonPath('data.city', 'Lleida');
});

it('apagar listed saca al taller del directorio y conserva el resto de datos', function () {
    $w = e16World();
    loginAs($w->owner);

    $this->putJson("/api/v1/workspaces/{$w->wws->id}/directory-profile", ['listed' => false])->assertOk()
        ->assertJsonPath('data.listed', false)
        ->assertJsonPath('data.city', 'Lleida')
        ->assertJsonPath('data.services', ['maintenance', 'brakes']);

    $this->getJson('/api/v1/workshops')->assertOk()->assertJsonCount(0, 'data');
    expect(WorkshopProfile::count())->toBe(1);
});

it('valida el perfil del directorio (422 con el campo)', function (array $body, string $field) {
    $w = e16World();
    loginAs($w->owner);

    $this->putJson("/api/v1/workspaces/{$w->wws->id}/directory-profile", $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'falta listed' => [['city' => 'Lleida'], 'listed'],
    'listed sin ciudad' => [['listed' => true], 'city'],
    'listed con ciudad vacía' => [['listed' => true, 'city' => '  '], 'city'],
    'ciudad de 1 letra' => [['listed' => true, 'city' => 'L'], 'city'],
    'ciudad de 81' => [['listed' => true, 'city' => str_repeat('a', 81)], 'city'],
    'dirección de 161' => [['listed' => false, 'address' => str_repeat('a', 161)], 'address'],
    'teléfono con letras' => [['listed' => false, 'phone' => '973 ABC 000'], 'phone'],
    'teléfono corto' => [['listed' => false, 'phone' => '123'], 'phone'],
    'servicio que no existe' => [['listed' => false, 'services' => ['lavado']], 'services.0'],
    'servicio repetido' => [['listed' => false, 'services' => ['tyres', 'tyres']], 'services.1'],
    'horario de 201' => [['listed' => false, 'opening_hours' => str_repeat('a', 201)], 'opening_hours'],
]);

it('la ciudad que falta con listed = true da el mensaje en español', function () {
    $w = e16World();
    loginAs($w->owner);

    $this->putJson("/api/v1/workspaces/{$w->wws->id}/directory-profile", ['listed' => true, 'city' => null])
        ->assertUnprocessable()
        ->assertJsonPath('errors.city.0', 'Indica la ciudad para aparecer en el directorio.');
});

it('solo el owner edita el perfil: la gerente y el mecánico reciben 403 y lo pueden ver', function (string $who) {
    $w = e16World();
    loginAs($w->{$who});

    $this->putJson("/api/v1/workspaces/{$w->wws->id}/directory-profile", ['listed' => false])
        ->assertForbidden()
        ->assertExactJson(['message' => 'No tienes permiso para esta acción.']);
    $this->getJson("/api/v1/workspaces/{$w->wws->id}/directory-profile")->assertOk()->assertJsonPath('data.listed', true);
})->with(['manager', 'mechanic']);

it('el perfil del directorio no existe en un espacio personal (404)', function (string $method) {
    $w = e16World();
    loginAs($w->client);

    $this->json($method, "/api/v1/workspaces/{$w->pws->id}/directory-profile", ['listed' => true, 'city' => 'Lleida'])
        ->assertNotFound();
    expect(WorkshopProfile::query()->where('workspace_id', $w->pws->id)->exists())->toBeFalse();
})->with(['GET', 'PUT']);
