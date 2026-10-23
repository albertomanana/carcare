<?php

namespace App\Policies;

use App\Models\MaintenanceRecord;
use Illuminate\Database\Eloquent\Model;

/** Intervenciones: se autorizan por el espacio de su vehículo. */
class MaintenanceRecordPolicy extends WorkspaceScopedPolicy
{
    /** @param  MaintenanceRecord  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->vehicle->workspace_id;
    }
}
