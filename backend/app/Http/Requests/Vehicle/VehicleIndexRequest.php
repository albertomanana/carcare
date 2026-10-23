<?php

namespace App\Http\Requests\Vehicle;

use App\Http\Requests\ApiRequest;

/** GET /workspaces/{ws}/vehicles: `archived=0|1`, `search`, `customer_id`, `sort=recent|name|mileage`. */
class VehicleIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'archived' => ['sometimes', 'boolean'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'customer_id' => ['sometimes', 'nullable', 'integer'],
            'sort' => ['sometimes', 'in:recent,name,mileage'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return ['sort.in' => 'El orden debe ser recent, name o mileage.'];
    }
}
