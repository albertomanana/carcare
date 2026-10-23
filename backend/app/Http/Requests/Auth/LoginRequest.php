<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * POST /auth/login (`LoginInput`).
 *  - Credenciales incorrectas ⇒ 422 con un mensaje genérico (no revela si el email existe).
 *  - 5 intentos fallidos por minuto y por email+IP ⇒ 429. Un login correcto limpia el contador.
 */
class LoginRequest extends ApiRequest
{
    public const MAX_ATTEMPTS = 5;

    public const FAILED_MESSAGE = 'Las credenciales no son correctas.';

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /** @throws ValidationException|TooManyRequestsHttpException */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = ['email' => $this->input('email'), 'password' => $this->input('password')];

        if (! Auth::guard('web')->attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey(), 60);

            throw ValidationException::withMessages(['email' => [self::FAILED_MESSAGE]]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    private function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), self::MAX_ATTEMPTS)) {
            return;
        }

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw new TooManyRequestsHttpException(
            $seconds,
            "Demasiados intentos de acceso. Vuelve a intentarlo en {$seconds} segundos.",
        );
    }

    private function throttleKey(): string
    {
        return 'login|'.Str::lower((string) $this->input('email')).'|'.$this->ip();
    }
}
