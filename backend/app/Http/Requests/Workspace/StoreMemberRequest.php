<?php

namespace App\Http\Requests\Workspace;

use App\Enums\WorkspaceRole;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** POST /workspaces/{ws}/members: `{ email, role: manager|mechanic }` (usuario ya registrado). */
class StoreMemberRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', Rule::in([WorkspaceRole::Manager->value, WorkspaceRole::Mechanic->value])],
        ];
    }

    public function messages(): array
    {
        return ['role.in' => 'El rol debe ser gerente (manager) o mecánico (mechanic).'];
    }
}
