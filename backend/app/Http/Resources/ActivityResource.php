<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Activity */
class ActivityResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'summary' => $this->summary,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'vehicle_id' => $this->vehicle_id,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
