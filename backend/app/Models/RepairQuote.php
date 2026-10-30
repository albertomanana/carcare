<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\RepairQuoteStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Versión de un presupuesto (contrato §3.13.5). Inmutable: para cambiarlo, el taller envía otra.
 * Las líneas se guardan en JSON con `total` calculado en el servidor. No es una factura (D12).
 */
class RepairQuote extends Model
{
    protected $fillable = [
        'repair_request_id', 'version', 'status', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'total',
        'valid_days', 'valid_until', 'note', 'client_reason', 'sent_at', 'answered_at',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'status' => RepairQuoteStatus::class,
            'items' => 'array',
            'subtotal' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'valid_days' => 'integer',
            'valid_until' => DateOnly::class,
            'sent_at' => 'immutable_datetime',
            'answered_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function repairRequest(): BelongsTo
    {
        return $this->belongsTo(RepairRequest::class);
    }

    /** Vigente y hoy > valid_until. Se calcula al leer, sin tareas programadas. */
    public function isExpired(): bool
    {
        return $this->status === RepairQuoteStatus::Sent && today()->greaterThan($this->valid_until);
    }
}
