<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Datos públicos de un taller en el directorio (contrato §3.13.2). 1:1 con el espacio de taller.
 * El nombre público es Workspace.name: no se guarda dos veces.
 */
class WorkshopProfile extends Model
{
    protected $fillable = ['workspace_id', 'listed', 'city', 'address', 'phone', 'services', 'opening_hours'];

    protected function casts(): array
    {
        return [
            'listed' => 'boolean',
            'services' => 'array',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
