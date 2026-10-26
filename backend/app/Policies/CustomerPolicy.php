<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

/**
 * Clientes (solo talleres). En los espacios personales no hay clientes: aunque existiera alguno
 * (p. ej. por un dato antiguo), sus rutas responden 404 como las demás rutas de taller.
 */
class CustomerPolicy extends WorkspaceScopedPolicy
{
    /** @param  Customer  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->workspace_id;
    }

    public function view(User $user, Model $model): Response
    {
        return $this->workshopOnly(parent::view($user, $model), $model);
    }

    public function operate(User $user, Model $model): Response
    {
        return $this->workshopOnly(parent::operate($user, $model), $model);
    }

    public function manage(User $user, Model $model): Response
    {
        return $this->workshopOnly(parent::manage($user, $model), $model);
    }

    /** @param  Customer  $customer */
    private function workshopOnly(Response $response, Model $customer): Response
    {
        if ($response->allowed() && ! $customer->workspace->isWorkshop()) {
            return Response::denyAsNotFound();
        }

        return $response;
    }
}
