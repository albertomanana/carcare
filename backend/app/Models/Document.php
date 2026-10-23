<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\DocumentType;
use Database\Factories\DocumentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    /** @use HasFactory<DocumentFactory> */
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'maintenance_record_id', 'title', 'document_type', 'disk', 'path',
        'original_filename', 'mime_type', 'size', 'expires_at',
    ];

    /** La ruta interna nunca sale de la API: se descarga por /documents/{id}/download. */
    protected $hidden = ['disk', 'path'];

    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'size' => 'integer',
            'expires_at' => DateOnly::class,
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
}
