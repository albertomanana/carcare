<?php

namespace App\Policies;

use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Model;

/** Vehículos: ver (todos), operar (crear/editar), manage (archivar, restaurar, borrar y gastos). */
class VehiclePolicy extends WorkspaceScopedPolicy
{
    /** @param  Vehicle  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->workspace_id;
    }
}
