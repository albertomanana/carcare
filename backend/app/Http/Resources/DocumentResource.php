<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\Document */
class DocumentResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'maintenance_record_id' => $this->maintenance_record_id,
            'title' => $this->title,
            'document_type' => $this->document_type->value,
            'original_filename' => $this->original_filename,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'expires_at' => self::date($this->expires_at),
            'download_url' => "/api/v1/documents/{$this->id}/download",
            'created_at' => self::iso($this->created_at),
        ];
    }
}
