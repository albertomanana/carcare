<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\MileageLog */
class MileageLogResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'recorded_at' => self::date($this->recorded_at),
            'mileage' => $this->mileage,
            'source' => $this->source->value,
            'note' => $this->note,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
