<?php

namespace App\Models;

use App\Enums\WorkspaceType;
use App\Support\Money;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workspace extends Model
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory;

    public const DEFAULT_SETTINGS = [
        'bays_count' => 4,
        'currency' => 'EUR',
        'tax_rate' => '21.00',
    ];

    protected $fillable = ['name', 'type', 'settings'];

    protected function casts(): array
    {
        return [
            'type' => WorkspaceType::class,
            'settings' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_user')->withPivot('role')->withTimestamps();
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function isPersonal(): bool
    {
        return $this->type === WorkspaceType::Personal;
    }

    public function isWorkshop(): bool
    {
        return $this->type === WorkspaceType::Workshop;
    }

    /** Ajustes completos (con valores por defecto) en el formato del contrato. */
    public function resolvedSettings(): array
    {
        $settings = array_merge(self::DEFAULT_SETTINGS, $this->settings ?? []);

        return [
            'bays_count' => (int) $settings['bays_count'],
            'currency' => 'EUR',
            'tax_rate' => Money::normalize($settings['tax_rate']),
        ];
    }

    public function baysCount(): int
    {
        return $this->resolvedSettings()['bays_count'];
    }

    public function taxRate(): string
    {
        return $this->resolvedSettings()['tax_rate'];
    }
}
