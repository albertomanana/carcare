<?php

namespace App\Http\Requests\Document;

use App\Enums\DocumentType;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/**
 * POST /vehicles/{v}/documents (multipart/form-data).
 * Máx. 10 MB; MIME REAL (detectado por fileinfo, no el que declara el cliente) PDF/JPEG/PNG/WebP.
 */
class StoreDocumentRequest extends ApiRequest
{
    public const MAX_KB = 10240;

    public const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    public function rules(): array
    {
        $vehicle = $this->route('vehicle');

        return [
            'file' => ['required', 'file', 'max:'.self::MAX_KB, 'mimetypes:'.implode(',', self::MIME_TYPES)],
            'title' => ['required', 'string', 'min:1', 'max:120'],
            'document_type' => ['required', Rule::enum(DocumentType::class)],
            'maintenance_record_id' => [
                'sometimes', 'nullable', 'integer',
                Rule::exists('maintenance_records', 'id')->where('vehicle_id', $vehicle->id),
            ],
            'expires_at' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'El archivo no puede pesar más de 10 MB.',
            'file.mimetypes' => 'Solo se admiten archivos PDF, JPEG, PNG o WebP.',
            'maintenance_record_id.exists' => 'La intervención no pertenece a este vehículo.',
        ];
    }
}
