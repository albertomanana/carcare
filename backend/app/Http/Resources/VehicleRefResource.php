<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Referencia breve a un vehículo (VehicleRef). @mixin \App\Models\Vehicle */
class VehicleRefResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'display_name' => $this->displayName(),
            'make' => $this->make,
            'model' => $this->model,
            'plate' => $this->plate,
            'body_type' => $this->body_type?->value,
            'color_hex' => $this->color_hex,
        ];
    }
}
