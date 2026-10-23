<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Línea de intervención u orden (LineItem). @mixin \App\Models\MaintenanceItem */
class LineItemResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'name' => $this->name,
            'part_number' => $this->part_number,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'total' => $this->total,
        ];
    }
}
