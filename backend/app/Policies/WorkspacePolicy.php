<?php

namespace App\Policies;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

/**
 * view/operate/manage/own sobre un espacio. Las variantes *Workshop además exigen
 * que el espacio sea un taller: en espacios personales esas rutas no existen (404).
 */
class WorkspacePolicy extends WorkspaceScopedPolicy
{
    protected function workspaceIdOf(Model $model): int
    {
        return $model->getKey();
    }

    public function own(User $user, Workspace $workspace): Response
    {
        return static::check($user, $workspace->id, WorkspaceRole::OWN);
    }

    /** Quitar a un miembro exige manage; salir uno mismo solo exige pertenecer al espacio. */
    public function removeMember(User $user, Workspace $workspace, User $member): Response
    {
        $capability = $user->is($member) ? WorkspaceRole::VIEW : WorkspaceRole::MANAGE;

        return static::check($user, $workspace->id, $capability);
    }

    public function viewWorkshop(User $user, Workspace $workspace): Response
    {
        return $this->workshopOnly($user, $workspace, WorkspaceRole::VIEW);
    }

    public function operateWorkshop(User $user, Workspace $workspace): Response
    {
        return $this->workshopOnly($user, $workspace, WorkspaceRole::OPERATE);
    }

    /** Perfil del directorio (E16, §3.13.2): lo edita solo el owner (manager y mechanic ⇒ 403). */
    public function ownWorkshop(User $user, Workspace $workspace): Response
    {
        return $this->workshopOnly($user, $workspace, WorkspaceRole::OWN);
    }

    /**
     * Listado de solicitudes de reparación (§3.13.1): en `personal`, las enviadas (solo el owner);
     * en `workshop`, las recibidas (cualquier miembro).
     */
    public function listRepairRequests(User $user, Workspace $workspace): Response
    {
        return static::check($user, $workspace->id, $workspace->isPersonal() ? WorkspaceRole::OWN : WorkspaceRole::VIEW);
    }

    /** Enviar una solicitud: solo el owner de un espacio personal. En un taller la ruta no existe (404). */
    public function createRepairRequest(User $user, Workspace $workspace): Response
    {
        if ($user->roleIn($workspace) === null || $workspace->isWorkshop()) {
            return Response::denyAsNotFound();
        }

        return static::check($user, $workspace->id, WorkspaceRole::OWN);
    }

    /**
     * Ficha pública del directorio (§3.13.1): cualquier usuario con sesión, pero solo si el espacio es un
     * taller con `listed = true`. Si no, 404 (no se revela que existe).
     */
    public function viewInDirectory(User $user, Workspace $workspace): Response
    {
        return $workspace->isWorkshop() && $workspace->workshopProfile?->listed === true
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    private function workshopOnly(User $user, Workspace $workspace, string $capability): Response
    {
        $response = static::check($user, $workspace->id, $capability);

        if ($response->allowed() && ! $workspace->isWorkshop()) {
            return Response::denyAsNotFound();
        }

        return $response;
    }
}
