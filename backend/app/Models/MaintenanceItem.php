<?php

namespace App\Models;

use App\Enums\ItemKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Línea de una intervención (pieza, mano de obra, líquido…). Forma `LineItem` del contrato. */
class MaintenanceItem extends Model
{
    protected $fillable = ['maintenance_record_id', 'kind', 'name', 'part_number', 'quantity', 'unit_price', 'total', 'position'];

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

    public function record(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_record_id');
    }
}
