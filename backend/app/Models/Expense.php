<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
use Database\Factories\ExpenseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    /** @use HasFactory<ExpenseFactory> */
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'maintenance_record_id', 'category', 'description', 'amount', 'currency',
        'expense_date', 'mileage', 'fuel_quantity', 'fuel_unit', 'full_tank',
    ];

    protected function casts(): array
    {
        return [
            'category' => ExpenseCategory::class,
            'amount' => 'decimal:2',
            'expense_date' => DateOnly::class,
            'mileage' => 'integer',
            'fuel_quantity' => 'decimal:2',
            'fuel_unit' => FuelUnit::class,
            'full_tank' => 'boolean',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class);
    }

    /** Lo gestiona una intervención: no se edita ni borra desde Gastos (409). */
    public function isLinked(): bool
    {
        return $this->maintenance_record_id !== null;
    }
}
