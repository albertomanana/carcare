<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\RecordType;
use App\Enums\ServiceKind;
use App\Enums\Zone;
use Database\Factories\MaintenanceRecordFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MaintenanceRecord extends Model
{
    /** @use HasFactory<MaintenanceRecordFactory> */
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'type', 'zone', 'service_kind', 'title', 'description', 'service_date',
        'mileage', 'workshop_name', 'parts_cost', 'labor_cost', 'total_cost', 'currency', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => RecordType::class,
            'zone' => Zone::class,
            'service_kind' => ServiceKind::class,
            'service_date' => DateOnly::class,
            'mileage' => 'integer',
            'parts_cost' => 'decimal:2',
            'labor_cost' => 'decimal:2',
            'total_cost' => 'decimal:2',
            'archived_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(MaintenanceItem::class)->orderBy('position')->orderBy('id');
    }

    /** Gasto vinculado (D3-A). */
    public function expense(): HasOne
    {
        return $this->hasOne(Expense::class);
    }

    /** Orden de trabajo que generó esta intervención al entregarse. */
    public function workOrder(): HasOne
    {
        return $this->hasOne(WorkOrder::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeLatestFirst(Builder $query): Builder
    {
        return $query->orderByDesc('service_date')->orderByDesc('mileage')->orderByDesc('id');
    }
}
