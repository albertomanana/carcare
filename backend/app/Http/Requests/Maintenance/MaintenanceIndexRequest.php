<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\RecordType;
use App\Enums\Zone;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** GET /vehicles/{v}/maintenance: `type`, `zone`, `year`, `search`, `archived=0|1`. */
class MaintenanceIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'type' => ['sometimes', 'nullable', Rule::enum(RecordType::class)],
            'zone' => ['sometimes', 'nullable', Rule::enum(Zone::class)],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1900', 'max:2100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'archived' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
