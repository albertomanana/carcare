<?php

namespace App\Models;

use App\Enums\Priority;
use App\Enums\WorkOrderStatus;
use Database\Factories\WorkOrderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkOrder extends Model
{
    /** @use HasFactory<WorkOrderFactory> */
    use HasFactory;

    /** Relaciones que necesita WorkOrderResource (evita consultas N+1). */
    public const RESOURCE_RELATIONS = ['vehicle', 'customer', 'assignee', 'items'];

    protected $fillable = [
        'workspace_id', 'vehicle_id', 'customer_id', 'number', 'year', 'sequence', 'title', 'complaint',
        'diagnosis', 'status', 'priority', 'bay', 'assigned_to', 'mileage_in', 'received_at', 'promised_at',
        'completed_at', 'delivered_at', 'subtotal', 'tax_rate', 'tax_amount', 'total', 'maintenance_record_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => WorkOrderStatus::class,
            'priority' => Priority::class,
            'bay' => 'integer',
            'mileage_in' => 'integer',
            'year' => 'integer',
            'sequence' => 'integer',
            'received_at' => 'immutable_datetime',
            'promised_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'delivered_at' => 'immutable_datetime',
            'subtotal' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function items(): HasMany
    {
        return $this->hasMany(WorkOrderItem::class)->orderBy('position')->orderBy('id');
    }

    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class);
    }

    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    /** true si la fecha prometida ya pasó y no está lista, entregada ni cancelada. */
    public function isLate(): bool
    {
        return $this->promised_at !== null
            && $this->promised_at->isPast()
            && ! in_array($this->status, [WorkOrderStatus::Ready, WorkOrderStatus::Delivered, WorkOrderStatus::Cancelled], true);
    }

    /** Abiertas = todo menos entregadas y canceladas. */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNotIn('status', WorkOrderStatus::finalValues());
    }

    public function scopeLate(Builder $query): Builder
    {
        return $query->whereNotIn('status', [
            WorkOrderStatus::Ready->value, WorkOrderStatus::Delivered->value, WorkOrderStatus::Cancelled->value,
        ])->whereNotNull('promised_at')->where('promised_at', '<', now());
    }
}
