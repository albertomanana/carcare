<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Expense */
class ExpenseResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'category' => $this->category->value,
            'description' => $this->description,
            'amount' => $this->amount,
            'currency' => $this->currency ?? 'EUR',
            'expense_date' => self::date($this->expense_date),
            'mileage' => $this->mileage,
            'fuel_quantity' => $this->fuel_quantity,
            'fuel_unit' => $this->fuel_unit?->value,
            'full_tank' => $this->full_tank,
            'maintenance_record_id' => $this->maintenance_record_id,
            'is_linked' => $this->isLinked(),
            'created_at' => self::iso($this->created_at),
            'updated_at' => self::iso($this->updated_at),
        ];
    }
}
