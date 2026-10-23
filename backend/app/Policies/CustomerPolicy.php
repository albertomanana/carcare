<?php

namespace App\Policies;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Model;

/** Clientes (solo talleres). */
class CustomerPolicy extends WorkspaceScopedPolicy
{
    /** @param  Customer  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->workspace_id;
    }
}
