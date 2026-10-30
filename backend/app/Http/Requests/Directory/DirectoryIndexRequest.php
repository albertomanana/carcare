<?php

namespace App\Http\Requests\Directory;

use App\Enums\WorkshopService;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** GET /workshops: `search` (nombre o ciudad), `service` (un `WorkshopService`) y la paginación. */
class DirectoryIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'service' => ['sometimes', 'nullable', Rule::enum(WorkshopService::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function search(): ?string
    {
        $search = trim((string) $this->validated('search'));

        return $search === '' ? null : $search;
    }

    public function service(): ?WorkshopService
    {
        $service = $this->validated('service');

        return $service === null || $service === '' ? null : WorkshopService::from($service);
    }
}
