<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Avisos en la app de un usuario (contrato §3.13.8): solo los suyos, siempre. Tabla `notifications`
 * estándar de Laravel; la SPA consulta el contador cada 60 s con la pestaña visible.
 */
class NotificationService
{
    public function list(User $user, bool $unreadOnly, int $perPage): LengthAwarePaginator
    {
        return $user->notifications()
            ->getQuery()
            ->when($unreadOnly, fn ($q) => $q->whereNull('read_at'))
            ->reorder()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function unreadCount(User $user): int
    {
        return $user->unreadNotifications()->count();
    }

    /**
     * Marca como leídas las indicadas (o todas si no llega ninguna). Los ids que no son del usuario se
     * ignoran: la consulta parte siempre de sus notificaciones.
     *
     * @param  list<string>|null  $ids
     */
    public function markAsRead(User $user, ?array $ids): void
    {
        $user->unreadNotifications()
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids))
            ->update(['read_at' => now()]);
    }
}
