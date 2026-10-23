<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Referencia breve a una intervención (MaintenanceRecordRef). @mixin \App\Models\MaintenanceRecord */
class MaintenanceRecordRefResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'zone' => $this->zone->value,
            'service_kind' => $this->service_kind?->value,
            'title' => $this->title,
            'service_date' => self::date($this->service_date),
            'mileage' => $this->mileage,
            'total_cost' => $this->total_cost,
        ];
    }
}
