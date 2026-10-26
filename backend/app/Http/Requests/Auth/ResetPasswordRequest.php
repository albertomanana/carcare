<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiRequest;
use App\Services\PasswordResetService;

/**
 * POST /auth/reset-password (`ResetPasswordInput`). La contraseña sigue las mismas reglas que el
 * registro (8–255 caracteres, con confirmación). Un token vacío da el mismo mensaje que uno inválido.
 */
class ResetPasswordRequest extends ApiRequest
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
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'token.required' => PasswordResetService::INVALID_LINK,
            'token.string' => PasswordResetService::INVALID_LINK,
            'token.max' => PasswordResetService::INVALID_LINK,
        ];
    }
}
