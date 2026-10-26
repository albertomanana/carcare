<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    /** Nombre que queda al anonimizar (contrato §3.10.1). */
    public const ANONYMIZED_NAME = 'Cliente anonimizado';

    /** `anonymized_at` no es asignable en masa: solo lo fija CustomerService::anonymize. */
    protected $fillable = ['workspace_id', 'name', 'email', 'phone', 'tax_id', 'notes'];

    protected function casts(): array
    {
        return [
            'anonymized_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function isAnonymized(): bool
    {
        return $this->anonymized_at !== null;
    }
}
