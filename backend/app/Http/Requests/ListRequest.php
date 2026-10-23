<?php

namespace App\Http\Requests;

use App\Enums\DocumentType;
use Illuminate\Validation\Rule;

/**
 * Filtros sencillos de listados: actividad (`vehicle_id`), clientes (`search`) y
 * documentos (`document_type`, `maintenance_record_id`), más la paginación.
 */
class ListRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'vehicle_id' => ['sometimes', 'nullable', 'integer'],
            'document_type' => ['sometimes', 'nullable', Rule::enum(DocumentType::class)],
            'maintenance_record_id' => ['sometimes', 'nullable', 'integer'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
