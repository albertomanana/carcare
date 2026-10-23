<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Workspace */
class WorkspaceResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        // El rol sale del pivote si el espacio se cargó desde el usuario; si no, se consulta.
        $role = $this->pivot?->role ?? $request->user()?->roleIn($this->resource)?->value;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type->value,
            'role' => $role,
            'settings' => $this->resolvedSettings(),
            'vehicles_count' => (int) ($this->vehicles_count ?? $this->vehicles()->whereNull('archived_at')->count()),
            'members_count' => (int) ($this->members_count ?? $this->members()->count()),
            'created_at' => self::iso($this->created_at),
        ];
    }
}
