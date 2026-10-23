<?php

namespace App\Http\Requests\WorkOrder;

use App\Enums\WorkOrderStatus;
use App\Http\Requests\ApiRequest;

/**
 * GET /workspaces/{ws}/work-orders: `status` (lista por comas u `open`), `vehicle_id`, `customer_id`,
 * `assigned_to`, `search` y `per_page` hasta 200 (tablero kanban).
 */
class WorkOrderIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'status' => [
                'sometimes', 'nullable', 'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $statuses = $this->statuses() ?? [];
                    $invalid = array_diff($statuses, [...WorkOrderStatus::values(), 'open']);
                    if ($invalid !== []) {
                        $fail('Estado no válido: '.implode(', ', $invalid).'.');
                    }
                },
            ],
            'vehicle_id' => ['sometimes', 'nullable', 'integer'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'assigned_to' => ['sometimes', 'nullable', 'integer'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
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
}
