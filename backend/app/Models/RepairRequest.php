<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\BodyType;
use App\Enums\FuelType;
use App\Enums\RepairQuoteStatus;
use App\Enums\RepairRequestStatus;
use App\Enums\Zone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Solicitud de reparación de un particular a un taller (contrato §3.13, ADR‑0007).
 * Tiene exactamente dos partes: el owner del espacio personal que la envía y los miembros del
 * taller destinatario. `customer_id` y `work_order_id` son columnas internas de la conversión.
 */
class RepairRequest extends Model
{
    /** Relaciones que necesita RepairRequestResource. */
    public const RESOURCE_RELATIONS = ['workshop.workshopProfile', 'requester', 'quotes', 'workOrder'];

    protected $fillable = [
        'requester_workspace_id', 'requester_user_id', 'workshop_workspace_id', 'vehicle_id', 'status',
        'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_fuel_type', 'vehicle_body_type',
        'vehicle_color_hex', 'vehicle_plate', 'title', 'description', 'zone', 'preferred_date', 'mileage',
        'contact_phone', 'share_history',
    ];

    protected function casts(): array
    {
        return [
            'status' => RepairRequestStatus::class,
            'vehicle_year' => 'integer',
            'vehicle_fuel_type' => FuelType::class,
            'vehicle_body_type' => BodyType::class,
            'zone' => Zone::class,
            'preferred_date' => DateOnly::class,
            'mileage' => 'integer',
            'share_history' => 'boolean',
            'responded_at' => 'immutable_datetime',
            'closed_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function requesterWorkspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class, 'requester_workspace_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_user_id');
    }

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workspace::class, 'workshop_workspace_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    /** Todas las versiones, de la más reciente a la más antigua. */
    public function quotes(): HasMany
    {
        return $this->hasMany(RepairQuote::class)->orderByDesc('version');
    }

    /** La versión vigente (status = sent), si la hay. */
    public function sentQuote(): HasOne
    {
        return $this->hasOne(RepairQuote::class)->where('status', RepairQuoteStatus::Sent->value);
    }

    public function isOpen(): bool
    {
        return $this->status->isOpen();
    }

    /** Nombre del coche de la copia fija: "make model" (nunca el apodo). */
    public function vehicleName(): string
    {
        return trim($this->vehicle_make.' '.$this->vehicle_model);
    }

    /** "Seat Ibiza (1234ABC)" o "Seat Ibiza" si no tiene matrícula. */
    public function vehicleLabel(): string
    {
        return $this->vehicleName().($this->vehicle_plate ? " ({$this->vehicle_plate})" : '');
    }

    /** El taller puede ver el historial: consentimiento, solicitud abierta y coche sin borrar (§3.13.7). */
    public function historyAvailable(): bool
    {
        return $this->share_history && $this->isOpen() && $this->vehicle_id !== null;
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', RepairRequestStatus::openValues());
    }
}
