<?php

namespace App\Policies;

use App\Models\MileageLog;
use Illuminate\Database\Eloquent\Model;

/** Lecturas de kilometraje: se autorizan por el espacio de su vehículo. */
class MileageLogPolicy extends WorkspaceScopedPolicy
{
    /** @param  MileageLog  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->vehicle->workspace_id;
    }
}
