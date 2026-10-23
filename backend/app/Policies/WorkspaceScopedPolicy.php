<?php

namespace App\Policies;

use App\Enums\WorkspaceRole;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

/**
 * Base de las policies: todo recurso se resuelve a su espacio de trabajo y se
 * comprueba el rol del usuario en él (contrato §2).
 *  - No es miembro del espacio ⇒ 404 (no se revela que el recurso existe).
 *  - Es miembro pero su rol no alcanza ⇒ 403.
 */
abstract class WorkspaceScopedPolicy
{
    /** Espacio al que pertenece el recurso (normalmente a través de su vehículo). */
    abstract protected function workspaceIdOf(Model $model): int;

    public function view(User $user, Model $model): Response
    {
        return static::check($user, $this->workspaceIdOf($model), WorkspaceRole::VIEW);
    }

    public function operate(User $user, Model $model): Response
    {
        return static::check($user, $this->workspaceIdOf($model), WorkspaceRole::OPERATE);
    }

    public function manage(User $user, Model $model): Response
    {
        return static::check($user, $this->workspaceIdOf($model), WorkspaceRole::MANAGE);
    }

    public static function check(User $user, int $workspaceId, string $capability): Response
    {
        $role = $user->roleIn($workspaceId);

        if ($role === null) {
            return Response::denyAsNotFound();
        }

        return $role->allows($capability)
            ? Response::allow()
            : Response::deny('No tienes permiso para esta acción.');
    }
}
