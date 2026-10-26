<?php

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Services\PasswordResetService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/*
 * Tarea 28 (E1‑6, D17 = A), contrato §3.1.1 y ADR‑0006: recuperar la contraseña.
 *  - Pedir el enlace: 204 siempre, exista o no la cuenta (no revela qué emails están registrados).
 *  - Token del broker de Laravel: hasheado, 60 minutos, un solo uso; pedir otro invalida el anterior.
 *  - Restablecer: mismo 422 en `token` para cualquier fallo; rota remember_token, cierra todas las
 *    sesiones y no inicia sesión.
 *  - 429 a partir de la 6.ª petición en un minuto por IP, con un contador por endpoint.
 */

const FORGOT = '/api/v1/auth/forgot-password';
const RESET = '/api/v1/auth/reset-password';

/** Petición como la de la SPA (origen de Vite: Sanctum la trata como stateful, con sesión y CSRF). */
function fromSpa(): Tests\TestCase
{
    return test()->withHeaders(['Referer' => 'http://localhost:5173', 'Accept' => 'application/json']);
}

/** Pide un enlace para $user y devuelve el token del último correo (requiere Notification::fake()). */
function requestResetToken(User $user): string
{
    fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();

    return Notification::sent($user, ResetPasswordNotification::class)->last()->token;
}

function resetBody(string $token, string $email, string $password = 'nuevaclave1', ?string $confirmation = null): array
{
    return ['token' => $token, 'email' => $email, 'password' => $password, 'password_confirmation' => $confirmation ?? $password];
}

function invalidLinkJson(): array
{
    return ['message' => PasswordResetService::INVALID_LINK, 'errors' => ['token' => [PasswordResetService::INVALID_LINK]]];
}

function addSession(User|int|null $user, string $id): void
{
    DB::table('sessions')->insert([
        'id' => $id, 'user_id' => $user instanceof User ? $user->id : $user, 'ip_address' => '127.0.0.1',
        'user_agent' => 'Pest', 'payload' => base64_encode('a:0:{}'), 'last_activity' => now()->getTimestamp(),
    ]);
}

// ───────────────────────── Pedir el enlace ─────────────────────────

it('responde 204 idéntico con cuenta y sin cuenta, y solo notifica a la que existe', function () {
    Notification::fake();
    $user = makeUser();

    $withAccount = fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();
    $withoutAccount = fromSpa()->postJson(FORGOT, ['email' => 'nadie.registrado@prueba.test'])->assertNoContent();

    expect($withAccount->getStatusCode())->toBe($withoutAccount->getStatusCode())
        ->and($withAccount->getContent())->toBe('')
        ->and($withoutAccount->getContent())->toBe('');
    Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
    Notification::assertCount(1);
    $this->assertGuest('web');

    // El token se guarda hasheado, nunca en claro.
    $token = Notification::sent($user, ResetPasswordNotification::class)->last()->token;
    $stored = DB::table('password_reset_tokens')->where('email', $user->email)->value('token');
    expect(DB::table('password_reset_tokens')->count())->toBe(1)
        ->and($stored)->not->toBe($token)
        ->and(Hash::check($token, $stored))->toBeTrue();
});

it('normaliza el email (mayúsculas y espacios) antes de buscar la cuenta', function () {
    Notification::fake();
    $user = makeUser();

    fromSpa()->postJson(FORGOT, ['email' => '  '.mb_strtoupper($user->email).'  '])->assertNoContent();

    Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
});

it('si se pide otra vez en menos de un minuto responde igual y no envía otro correo', function () {
    Notification::fake();
    $user = makeUser();

    fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();
    fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();

    Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
});

it('el correo está en español y su enlace lleva a la SPA con el token y el email', function () {
    Notification::fake();
    $user = makeUser();
    $token = requestResetToken($user);

    $mail = Notification::sent($user, ResetPasswordNotification::class)->last()->toMail($user);
    $prefix = rtrim(config('app.frontend_url'), '/').'/restablecer?token=';

    expect($mail->actionUrl)->toStartWith($prefix)
        ->and($mail->actionUrl)->toBe($prefix.$token.'&email='.rawurlencode($user->email))
        ->and($mail->actionUrl)->not->toContain('/api/')
        ->and($mail->subject)->toBe('Crea una contraseña nueva para CarCare')
        ->and($mail->actionText)->toBe('Crear una contraseña nueva')
        ->and(implode(' ', $mail->outroLines))->toContain('caduca en 60 minutos')->toContain('puedes ignorar este correo');
});

it('el enlace se puede copiar del log del correo (mailer log) y funciona', function () {
    $path = tempnam(sys_get_temp_dir(), 'carcare-correo');
    config([
        'logging.channels.correo-prueba' => ['driver' => 'single', 'path' => $path, 'level' => 'debug'],
        'mail.default' => 'log',
        'mail.mailers.log.channel' => 'correo-prueba',
    ]);
    $user = makeUser();

    fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();

    $log = (string) file_get_contents($path);
    @unlink($path);
    $prefix = preg_quote(rtrim(config('app.frontend_url'), '/').'/restablecer?token=', '#');
    // El enlace completo está en una sola línea (Laravel decodifica el quoted-printable al escribir el log).
    expect(preg_match('#'.$prefix.'([0-9a-f]{64})&email=([^\s\]\)<"]+)#', $log, $m))->toBe(1)
        ->and(rawurldecode($m[2]))->toBe($user->email)
        ->and($log)->toContain('caduca en 60 minutos');

    fromSpa()->postJson(RESET, resetBody($m[1], rawurldecode($m[2])))->assertNoContent();
    expect(Hash::check('nuevaclave1', $user->fresh()->password))->toBeTrue();
});

// ───────────────────────── Restablecer ─────────────────────────

it('restablece la contraseña, rota remember_token, cierra todas las sesiones y no inicia sesión', function () {
    Notification::fake();
    $user = makeUser();
    $other = makeUser();
    $user->forceFill(['remember_token' => 'token-recordarme-antiguo'])->save();
    addSession($user, 'sesion-portatil');
    addSession($user, 'sesion-movil');
    addSession($other, 'sesion-de-otra-persona');
    addSession(null, 'sesion-invitado');
    $token = requestResetToken($user);

    fromSpa()->postJson(RESET, resetBody($token, $user->email))->assertNoContent();

    $user->refresh();
    expect(Hash::check('nuevaclave1', $user->password))->toBeTrue()
        ->and($user->remember_token)->not->toBeNull()->not->toBe('token-recordarme-antiguo')
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(DB::table('sessions')->pluck('id')->sort()->values()->all())->toBe(['sesion-de-otra-persona', 'sesion-invitado'])
        ->and(DB::table('password_reset_tokens')->where('email', $user->email)->exists())->toBeFalse();
    $this->assertGuest('web');

    // Entra con la nueva desde /entrar; la antigua ya no vale.
    fromSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertUnprocessable();
    fromSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'nuevaclave1'])->assertOk();
});

it('un token ya usado da 422 en errors.token', function () {
    Notification::fake();
    $user = makeUser();
    $token = requestResetToken($user);

    fromSpa()->postJson(RESET, resetBody($token, $user->email))->assertNoContent();
    fromSpa()->postJson(RESET, resetBody($token, $user->email, 'otraclave22'))
        ->assertUnprocessable()
        ->assertExactJson(invalidLinkJson());

    expect(Hash::check('nuevaclave1', $user->fresh()->password))->toBeTrue();
});

it('un token caducado (61 minutos) da 422 en errors.token y no cambia la contraseña', function () {
    Notification::fake();
    $user = makeUser();
    $token = requestResetToken($user);

    $this->travel(61)->minutes();

    fromSpa()->postJson(RESET, resetBody($token, $user->email))
        ->assertUnprocessable()
        ->assertExactJson(invalidLinkJson());
    expect(Hash::check('password', $user->fresh()->password))->toBeTrue();
});

it('a los 59 minutos el token todavía vale', function () {
    Notification::fake();
    $user = makeUser();
    $token = requestResetToken($user);

    $this->travel(59)->minutes();

    fromSpa()->postJson(RESET, resetBody($token, $user->email))->assertNoContent();
});

it('un email ajeno, un email sin cuenta o un token inventado dan exactamente el mismo 422', function () {
    Notification::fake();
    $user = makeUser();
    $other = makeUser();
    $token = requestResetToken($user);

    foreach ([
        resetBody($token, $other->email),                      // token de otra cuenta
        resetBody($token, 'nadie.registrado@prueba.test'),     // email sin cuenta
        resetBody(str_repeat('a', 64), $user->email),          // token inventado
    ] as $body) {
        fromSpa()->postJson(RESET, $body)->assertUnprocessable()->assertExactJson(invalidLinkJson());
    }

    expect(Hash::check('password', $user->fresh()->password))->toBeTrue()
        ->and(Hash::check('password', $other->fresh()->password))->toBeTrue();
    // Los intentos fallidos no gastan el token bueno.
    fromSpa()->postJson(RESET, resetBody($token, $user->email))->assertNoContent();
});

it('pedir otro enlace invalida el anterior: solo vale el último', function () {
    Notification::fake();
    $user = makeUser();
    $first = requestResetToken($user);
    $this->travel(61)->seconds(); // el broker no envía más de un correo por minuto a la misma cuenta
    $second = requestResetToken($user);

    expect($second)->not->toBe($first);
    fromSpa()->postJson(RESET, resetBody($first, $user->email))->assertUnprocessable()->assertExactJson(invalidLinkJson());
    fromSpa()->postJson(RESET, resetBody($second, $user->email))->assertNoContent();
});

it('valida en español: email, token vacío y contraseña corta o sin confirmar', function () {
    Notification::fake();
    $user = makeUser();
    $token = requestResetToken($user);

    fromSpa()->postJson(FORGOT, [])->assertUnprocessable()->assertJsonValidationErrors('email');
    fromSpa()->postJson(FORGOT, ['email' => 'esto-no-es-un-email'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'El email debe ser un email válido.');

    fromSpa()->postJson(RESET, resetBody($token, $user->email, 'corta'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password')
        ->assertJsonMissingValidationErrors(['token', 'email']);
    fromSpa()->postJson(RESET, resetBody($token, $user->email, 'nuevaclave1', 'otraclave11'))
        ->assertUnprocessable()
        ->assertJsonPath('errors.password.0', 'La confirmación de la contraseña no coincide.');
    fromSpa()->postJson(RESET, resetBody('', $user->email))
        ->assertUnprocessable()
        ->assertJsonPath('errors.token.0', PasswordResetService::INVALID_LINK);
    fromSpa()->postJson(RESET, resetBody($token, 'sin-arroba'))->assertUnprocessable()->assertJsonValidationErrors('email');

    // Ninguno de esos intentos gasta el token.
    fromSpa()->postJson(RESET, resetBody($token, $user->email))->assertNoContent();
});

// ───────────────────────── Límite de intentos ─────────────────────────

it('la 6.ª petición en un minuto desde la misma IP responde 429, con un contador por endpoint', function () {
    Notification::fake();
    $user = makeUser();

    foreach ([$user->email, 'nadie@prueba.test', $user->email, 'otro@prueba.test', 'sin-formato'] as $email) {
        expect(fromSpa()->postJson(FORGOT, ['email' => $email])->getStatusCode())->toBeIn([204, 422]);
    }
    $limited = fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertStatus(429);
    expect($limited->json())->toBe(['message' => 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'])
        ->and($limited->headers->get('Retry-After'))->not->toBeNull();

    // El otro endpoint lleva su propio contador.
    for ($i = 0; $i < 5; $i++) {
        fromSpa()->postJson(RESET, resetBody(str_repeat('b', 64), $user->email))->assertUnprocessable();
    }
    fromSpa()->postJson(RESET, resetBody(str_repeat('b', 64), $user->email))->assertStatus(429);

    // Pasado el minuto, se puede volver a pedir.
    $this->travel(61)->seconds();
    fromSpa()->postJson(FORGOT, ['email' => $user->email])->assertNoContent();
});
