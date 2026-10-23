<?php

use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;

/** Las peticiones de la SPA llegan desde el origen de Vite: Sanctum las trata con sesión. */
function spa(): \Tests\TestCase
{
    return test()->withHeaders(['Referer' => 'http://localhost:5173', 'Accept' => 'application/json']);
}

it('responde al health check', function () {
    $this->getJson('/api/v1/health')->assertOk()->assertExactJson(['status' => 'ok']);
});

it('registra un particular con su espacio personal y deja la sesión iniciada', function () {
    spa()->postJson('/api/v1/auth/register', [
        'name' => 'Laura Nueva', 'email' => 'Laura@Prueba.TEST', 'password' => 'secreta123',
        'password_confirmation' => 'secreta123', 'account_type' => 'personal',
    ])
        ->assertCreated()
        ->assertJsonPath('data.user.email', 'laura@prueba.test')
        ->assertJsonPath('data.user.locale', 'es')
        ->assertJsonCount(1, 'data.workspaces')
        ->assertJsonPath('data.workspaces.0.type', 'personal')
        ->assertJsonPath('data.workspaces.0.name', 'Mi garaje')
        ->assertJsonPath('data.workspaces.0.role', 'owner')
        ->assertJsonPath('data.workspaces.0.settings.tax_rate', '21.00');

    $this->assertAuthenticated('web');
    spa()->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.user.name', 'Laura Nueva');
});

it('registra un taller: espacio personal + taller como owner', function () {
    spa()->postJson('/api/v1/auth/register', [
        'name' => 'Tomás Taller', 'email' => 'tomas@prueba.test', 'password' => 'secreta123',
        'password_confirmation' => 'secreta123', 'account_type' => 'workshop', 'workshop_name' => 'Talleres Tomás',
    ])
        ->assertCreated()
        ->assertJsonCount(2, 'data.workspaces')
        ->assertJsonPath('data.workspaces.0.type', 'personal')
        ->assertJsonPath('data.workspaces.1.type', 'workshop')
        ->assertJsonPath('data.workspaces.1.name', 'Talleres Tomás')
        ->assertJsonPath('data.workspaces.1.settings.bays_count', 4);
});

it('valida el registro en español', function () {
    makeUser()->forceFill(['email' => 'existe@prueba.test'])->save();

    spa()->postJson('/api/v1/auth/register', [
        'name' => 'A', 'email' => 'EXISTE@prueba.test', 'password' => 'corta', 'password_confirmation' => 'otra',
        'account_type' => 'workshop',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'email', 'password', 'workshop_name'])
        ->assertJsonPath('errors.email.0', 'Ya existe una cuenta con ese email.')
        ->assertJsonPath('errors.workshop_name.0', 'Indica el nombre del taller.')
        ->assertJsonPath('errors.name.0', 'El nombre debe tener al menos 2 caracteres.');
});

it('inicia sesión y devuelve Me', function () {
    $user = makeUser('Pepa Login');
    $user->forceFill(['email' => 'pepa@prueba.test'])->save();

    spa()->postJson('/api/v1/auth/login', ['email' => 'PEPA@prueba.test', 'password' => 'password'])
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'email', 'locale', 'created_at'], 'workspaces' => [['id', 'name', 'type', 'role', 'settings', 'vehicles_count', 'members_count', 'created_at']]]]);
});

it('rechaza credenciales incorrectas con un mensaje genérico', function () {
    $user = makeUser();

    spa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'incorrecta'])
        ->assertUnprocessable()
        ->assertExactJson([
            'message' => 'Las credenciales no son correctas.',
            'errors' => ['email' => ['Las credenciales no son correctas.']],
        ]);

    spa()->postJson('/api/v1/auth/login', ['email' => 'nadie@prueba.test', 'password' => 'incorrecta'])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Las credenciales no son correctas.');
});

it('limita a 5 intentos fallidos por minuto (429)', function () {
    RateLimiter::clear('login|limite@prueba.test|127.0.0.1');
    $user = makeUser();
    $user->forceFill(['email' => 'limite@prueba.test'])->save();

    for ($i = 0; $i < 5; $i++) {
        spa()->postJson('/api/v1/auth/login', ['email' => 'limite@prueba.test', 'password' => 'mal'])->assertUnprocessable();
    }

    $response = spa()->postJson('/api/v1/auth/login', ['email' => 'limite@prueba.test', 'password' => 'password'])
        ->assertStatus(429);
    expect($response->json('message'))->toStartWith('Demasiados intentos de acceso.')
        ->and($response->headers->get('Retry-After'))->not->toBeNull();
});

it('cierra la sesión', function () {
    $user = makeUser();
    spa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

    spa()->postJson('/api/v1/auth/logout')->assertNoContent();
    $this->assertGuest('web');
});

it('edita el perfil y la contraseña', function () {
    $user = makeUser('Nombre Viejo');
    loginAs($user);

    $this->patchJson('/api/v1/me', ['name' => 'Nombre Nuevo', 'email' => 'NUEVO@prueba.test'])
        ->assertOk()
        ->assertJsonPath('data.user.name', 'Nombre Nuevo')
        ->assertJsonPath('data.user.email', 'nuevo@prueba.test');

    $this->putJson('/api/v1/me/password', ['current_password' => 'mala', 'password' => 'otraclave1', 'password_confirmation' => 'otraclave1'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.current_password.0', 'La contraseña actual no es correcta.');

    $this->putJson('/api/v1/me/password', ['current_password' => 'password', 'password' => 'otraclave1', 'password_confirmation' => 'otraclave1'])
        ->assertNoContent();
    expect(\Illuminate\Support\Facades\Hash::check('otraclave1', $user->fresh()->password))->toBeTrue();
});

it('borra la cuenta con su espacio personal y los talleres donde es único propietario', function () {
    $w = world();
    loginAs($w->owner);

    $this->deleteJson('/api/v1/me', ['password' => 'mala'])->assertUnprocessable();
    $this->deleteJson('/api/v1/me', ['password' => 'password'])->assertNoContent();

    expect(User::find($w->owner->id))->toBeNull()
        ->and(\App\Models\Workspace::find($w->pws->id))->toBeNull()
        ->and(\App\Models\Workspace::find($w->wws->id))->toBeNull()
        ->and(\App\Models\Vehicle::find($w->vehicle->id))->toBeNull()
        ->and(User::find($w->mechanic->id))->not->toBeNull();
    // Los ficheros del garaje borrado tampoco quedan en el disco privado.
    Storage::disk('local')->assertMissing($w->document->path);
});

it('al borrar la cuenta conserva los talleres que tienen otro propietario', function () {
    $w = world();
    $w->wws->members()->updateExistingPivot($w->manager->id, ['role' => 'owner']);
    loginAs($w->owner);

    $this->deleteJson('/api/v1/me', ['password' => 'password'])->assertNoContent();

    expect(\App\Models\Workspace::find($w->pws->id))->toBeNull()
        ->and(\App\Models\Workspace::find($w->wws->id))->not->toBeNull()
        ->and(\App\Models\WorkOrder::find($w->order->id))->not->toBeNull()
        ->and($w->manager->fresh()->roleIn($w->wws)?->value)->toBe('owner')
        ->and($w->mechanic->fresh()->roleIn($w->wws)?->value)->toBe('mechanic')
        ->and($w->wws->members()->count())->toBe(2);
});
