<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Recuperar la contraseña con el broker de Laravel (contrato §3.1.1, ADR‑0006).
 *
 *  - El token lo crea el broker y se guarda hasheado en `password_reset_tokens`; caduca a los 60 min
 *    (`auth.passwords.users.expire`) y es de un solo uso. Pedir otro enlace sustituye al anterior.
 *  - Nunca revela si un email tiene cuenta: pedir el enlace no devuelve nada, y cualquier fallo al
 *    restablecer (token incorrecto, caducado o usado, o email sin cuenta) da el mismo 422 en `token`.
 *  - Al restablecer, en una transacción: contraseña nueva, `remember_token` rotado, token borrado y
 *    todas las sesiones de la cuenta cerradas (filas de `sessions`). No inicia sesión.
 */
class PasswordResetService
{
    public const INVALID_LINK = 'El enlace para cambiar la contraseña no es válido o ha caducado. Pide uno nuevo.';

    /**
     * Envía el enlace si la cuenta existe. `INVALID_USER` y `RESET_THROTTLED` (ya se envió uno hace
     * menos de un minuto) no se distinguen de un envío correcto: el controlador responde 204 siempre.
     */
    public function sendLink(string $email): void
    {
        $status = Password::broker()->sendResetLink(['email' => $email]);

        if ($status === Password::INVALID_USER) {
            $this->equalizeTiming();
        }
    }

    /**
     * @param  array{token: string, email: string, password: string}  $credentials
     *
     * @throws ValidationException 422 `errors.token` con el mismo mensaje en todos los casos.
     */
    public function reset(#[\SensitiveParameter] array $credentials): void
    {
        $status = DB::transaction(fn () => Password::broker()->reset(
            $credentials,
            function (User $user, #[\SensitiveParameter] string $password) {
                // El cast `hashed` del modelo cifra la contraseña. Rotar remember_token invalida las cookies "Recordarme".
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

                // Cierra todas las sesiones abiertas de la cuenta, incluida la del navegador actual si la hubiera.
                DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->delete();

                event(new PasswordReset($user));
            },
        ));

        if ($status !== Password::PASSWORD_RESET) {
            if ($status === Password::INVALID_USER) {
                $this->equalizeTiming();
            }

            throw ValidationException::withMessages(['token' => [self::INVALID_LINK]]);
        }
    }

    /**
     * Si la cuenta existe, el broker calcula un hash bcrypt del token (al crearlo o al comprobarlo);
     * si no existe, se calcula uno de relleno para que el tiempo de respuesta no delate el email.
     */
    private function equalizeTiming(): void
    {
        Hash::make(Str::random(64));
    }
}
