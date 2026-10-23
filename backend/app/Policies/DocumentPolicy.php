<?php

namespace App\Policies;

use App\Models\Document;
use Illuminate\Database\Eloquent\Model;

/** Documentos: se autorizan por el espacio de su vehículo. */
class DocumentPolicy extends WorkspaceScopedPolicy
{
    /** @param  Document  $model */
    protected function workspaceIdOf(Model $model): int
    {
        return $model->vehicle->workspace_id;
    }
}
