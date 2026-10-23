<?php

namespace App\Http\Requests\Auth;

use App\Enums\WorkspaceType;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** POST /auth/register (`RegisterInput`). El email se guarda en minúsculas y es único sin distinguir mayúsculas. */
class RegisterRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
            'account_type' => ['required', Rule::enum(WorkspaceType::class)],
            'workshop_name' => ['nullable', 'required_if:account_type,workshop', 'string', 'min:2', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Ya existe una cuenta con ese email.',
            'workshop_name.required_if' => 'Indica el nombre del taller.',
            'account_type.enum' => 'El tipo de cuenta debe ser particular o taller.',
        ];
    }
}
