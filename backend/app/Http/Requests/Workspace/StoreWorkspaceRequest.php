<?php

namespace App\Http\Requests\Workspace;

use App\Http\Requests\ApiRequest;

/** POST /workspaces: crea un espacio de taller (`{ name }`). */
class StoreWorkspaceRequest extends ApiRequest
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
            'name' => ['required', 'string', 'min:2', 'max:100'],
        ];
    }
}
