<?php

namespace App\Policies;

use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Model;

/** Órdenes de trabajo (solo talleres). */
class WorkOrderPolicy extends WorkspaceScopedPolicy
{
    /** @param  WorkOrder  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->workspace_id;
    }
}
