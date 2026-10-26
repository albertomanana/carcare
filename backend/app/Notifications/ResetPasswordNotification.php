<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Correo "crear una contraseña nueva" en español (contrato §3.1.1, ADR‑0006).
 *
 * El enlace lo construye `ResetPassword::createUrlUsing` (AppServiceProvider) y apunta a la SPA:
 * `{app.frontend_url}/restablecer?token=…&email=…`. Con el mailer `log` (D17 = A) el correo completo
 * queda en storage/logs/laravel.log, ya decodificado, con el enlace en una sola línea.
 */
class ResetPasswordNotification extends ResetPassword
{
    public const SUBJECT = 'Crea una contraseña nueva para CarCare';

    /** @param  string  $url */
    protected function buildMailMessage($url): MailMessage
    {
        $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

        return (new MailMessage)
            ->subject(self::SUBJECT)
            ->greeting('Hola:')
            ->line('Hemos recibido una petición para cambiar la contraseña de tu cuenta de CarCare.')
            ->action('Crear una contraseña nueva', $url)
            ->line("El enlace caduca en {$minutes} minutos y solo se puede usar una vez.")
            ->line('Si no lo has pedido tú, puedes ignorar este correo: tu contraseña no cambiará.')
            ->salutation('Un saludo, el equipo de CarCare');
    }
}
