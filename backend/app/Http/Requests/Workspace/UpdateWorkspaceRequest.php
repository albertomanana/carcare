<?php

namespace App\Http\Requests\Workspace;

use App\Http\Requests\ApiRequest;

/** PATCH /workspaces/{ws}: `{ name?, settings?: { bays_count?, tax_rate? } }`. */
class UpdateWorkspaceRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'settings' => ['sometimes', 'array'],
            'settings.bays_count' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'settings.tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ];
    }

    public function messages(): array
    {
        return [
            'settings.bays_count.min' => 'El taller debe tener entre 1 y 12 elevadores.',
            'settings.bays_count.max' => 'El taller debe tener entre 1 y 12 elevadores.',
            'settings.tax_rate.min' => 'El IVA debe estar entre 0 y 100.',
            'settings.tax_rate.max' => 'El IVA debe estar entre 0 y 100.',
        ];
    }
}
