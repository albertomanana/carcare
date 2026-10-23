<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\BodyType;
use App\Enums\FuelType;
use App\Enums\ReminderStatus;
use App\Enums\Transmission;
use App\Enums\WorkOrderStatus;
use Database\Factories\VehicleFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Vehicle extends Model
{
    /** @use HasFactory<VehicleFactory> */
    use HasFactory;

    protected $fillable = [
        'workspace_id', 'customer_id', 'nickname', 'make', 'model', 'version', 'year',
        'fuel_type', 'transmission', 'engine', 'body_type', 'color_hex', 'plate', 'vin',
        'purchase_date', 'purchase_mileage', 'current_mileage', 'mileage_updated_at', 'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'fuel_type' => FuelType::class,
            'transmission' => Transmission::class,
            'body_type' => BodyType::class,
            'purchase_date' => DateOnly::class,
            'purchase_mileage' => 'integer',
            'current_mileage' => 'integer',
            'mileage_updated_at' => DateOnly::class,
            'archived_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function mileageLogs(): HasMany
    {
        return $this->hasMany(MileageLog::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(Reminder::class);
    }

    public function pendingReminders(): HasMany
    {
        return $this->hasMany(Reminder::class)->where('status', ReminderStatus::Pending->value);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    /** La orden abierta (ni entregada ni cancelada) más reciente. */
    public function openWorkOrder(): HasOne
    {
        return $this->hasOne(WorkOrder::class)->ofMany(
            ['received_at' => 'max', 'id' => 'max'],
            fn (Builder $q) => $q->whereNotIn('status', WorkOrderStatus::finalValues()),
        );
    }

    public function displayName(): string
    {
        return $this->nickname ?: trim($this->make.' '.$this->model);
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function isElectric(): bool
    {
        return $this->fuel_type === FuelType::Electric;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }
}
