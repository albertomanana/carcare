<?php

namespace App\Policies;

use App\Models\Expense;
use Illuminate\Database\Eloquent\Model;

/** Gastos: requieren manage (owner en personal; owner/manager en talleres). */
class ExpensePolicy extends WorkspaceScopedPolicy
{
    /** @param  Expense  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->vehicle->workspace_id;
    }
}
