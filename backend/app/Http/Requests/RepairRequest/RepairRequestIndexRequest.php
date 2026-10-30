<?php

namespace App\Http\Requests\RepairRequest;

use App\Enums\RepairRequestStatus;
use App\Http\Requests\ApiRequest;

/** GET /workspaces/{ws}/repair-requests: `status` (lista por comas u `open`), `work_order_id` y paginación. */
class RepairRequestIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'status' => [
                'sometimes', 'nullable', 'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $invalid = array_diff($this->statuses() ?? [], [...RepairRequestStatus::values(), 'open']);
                    if ($invalid !== []) {
                        $fail('Estado no válido: '.implode(', ', $invalid).'.');
                    }
                },
            ],
            'work_order_id' => ['sometimes', 'nullable', 'integer'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /** @return list<string>|null */
    public function statuses(): ?array
    {
        $raw = $this->query('status');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        return array_values(array_filter(array_map('trim', explode(',', $raw)), fn ($s) => $s !== ''));
    }

    public function workOrderId(): ?int
    {
        return $this->filled('work_order_id') ? (int) $this->query('work_order_id') : null;
    }
}
