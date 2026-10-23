<?php

namespace App\Policies;

use App\Models\Reminder;
use Illuminate\Database\Eloquent\Model;

/** Recordatorios: se autorizan por el espacio de su vehículo. */
class ReminderPolicy extends WorkspaceScopedPolicy
{
    /** @param  Reminder  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->vehicle->workspace_id;
    }
}
