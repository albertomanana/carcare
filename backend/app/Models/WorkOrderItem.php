<?php

namespace App\Models;

use App\Enums\ItemKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Línea de una orden de trabajo. Misma forma que MaintenanceItem (`LineItem` del contrato). */
class WorkOrderItem extends Model
{
    protected $fillable = ['work_order_id', 'kind', 'name', 'part_number', 'quantity', 'unit_price', 'total', 'position'];

    protected function casts(): array
    {
        return [
            'kind' => ItemKind::class,
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
            'position' => 'integer',
        ];
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }
}
