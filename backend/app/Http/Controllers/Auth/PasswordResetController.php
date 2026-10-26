<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Services\PasswordResetService;
use Illuminate\Http\Response;

/**
 * Recuperar la contraseña (contrato §3.1.1). Rutas públicas con `throttle:5,1` (un contador por
 * endpoint e IP) y CSRF como el login (Sanctum stateful).
 */
class PasswordResetController extends Controller
{
    public function __construct(private readonly PasswordResetService $resets) {}

    /** 204 siempre, exista o no la cuenta: no revela qué emails están registrados. */
    public function forgot(ForgotPasswordRequest $request): Response
    {
        $this->resets->sendLink($request->validated('email'));

        return $this->noContent();
    }

    /** 204: contraseña cambiada y todas las sesiones cerradas. No inicia sesión. */
    public function reset(ResetPasswordRequest $request): Response
    {
        $this->resets->reset($request->safe()->only(['token', 'email', 'password']));

        return $this->noContent();
    }
}
