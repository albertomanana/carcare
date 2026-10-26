<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // El enlace del correo de "crear una contraseña nueva" lleva a la SPA, nunca a la API (contrato §3.1.1).
        ResetPassword::createUrlUsing(fn (CanResetPassword $user, #[\SensitiveParameter] string $token) => self::passwordResetUrl(
            $token,
            $user->getEmailForPasswordReset(),
        ));
    }

    /** `{app.frontend_url}/restablecer?token=…&email=…` (email codificado para URL). */
    public static function passwordResetUrl(#[\SensitiveParameter] string $token, string $email): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/restablecer?'.http_build_query(
            ['token' => $token, 'email' => $email],
            '',
            '&',
            PHP_QUERY_RFC3986,
        );
    }
}
