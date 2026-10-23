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

    private function workshopOnly(User $user, Workspace $workspace, string $capability): Response
    {
        $response = static::check($user, $workspace->id, $capability);

        if ($response->allowed() && ! $workspace->isWorkshop()) {
            return Response::denyAsNotFound();
        }

        return $response;
    }
}
