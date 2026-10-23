<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Auditoría ligera: qué pasó, quién y cuándo, con una frase en español lista para mostrar. */
class Activity extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'workspace_id', 'user_id', 'vehicle_id', 'action', 'entity_type', 'entity_id', 'summary', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'entity_id' => 'integer',
            'metadata' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
