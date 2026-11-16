<?php

namespace App\Http\Resources;

use App\Models\MaintenanceRecord;
use App\Support\Money;
use Illuminate\Http\Request;

/** @mixin \App\Models\Expense */
class ExpenseResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(self::eagerLoad());
        $record = $this->maintenanceRecord;
        $reminder = $this->reminder;
        $head = ['id' => $this->id, 'vehicle_id' => $this->vehicle_id];
        if ($this->withVehicle) {
            $head['vehicle'] = new VehicleRefResource($this->vehicle);
        }

        return $head + [
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
            'recurrence_months' => $this->recurrence_months,
            'renewal' => $reminder === null ? null : [
                'reminder_id' => $reminder->id,
                'title' => $reminder->title,
                'due_date' => self::date($reminder->due_date),
                'status' => $reminder->status->value,
            ],
            'origin' => $record === null ? null : [
                'record_id' => $record->id,
                'title' => $record->title,
                'type' => $record->type->value,
                'workshop_name' => $record->workshop_name,
                'parts_cost' => $record->parts_cost,
                'labor_cost' => $record->labor_cost,
                'tax_amount' => self::taxOf($record),
                'work_order_number' => $record->work_order_number,
                'repair_request_id' => $record->repair_request_id,
            ],
            'created_at' => self::iso($this->created_at),
            'updated_at' => self::iso($this->updated_at),
        ];
    }

    private bool $withVehicle = false;

    /** Para listados de todo el espacio (detalle del mes): cada gasto lleva su vehículo. */
    public function withVehicle(): static
    {
        $this->withVehicle = true;

        return $this;
    }

    public static function eagerLoad(): array
    {
        return ['maintenanceRecord', 'reminder'];
    }

    /** IVA de una intervención llegada de una orden de taller: lo que va del total a piezas + mano de obra. */
    private static function taxOf(MaintenanceRecord $record): ?string
    {
        if ($record->work_order_number === null || $record->parts_cost === null || $record->labor_cost === null) {
            return null;
        }
        $tax = Money::toCents($record->total_cost) - Money::toCents($record->parts_cost) - Money::toCents($record->labor_cost);

        return $tax > 0 ? Money::format($tax) : null;
    }
}
