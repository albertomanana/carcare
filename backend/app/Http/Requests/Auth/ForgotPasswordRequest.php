<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\ApiRequest;

/** POST /auth/forgot-password (`ForgotPasswordInput`). El email se normaliza como en el login. */
class ForgotPasswordRequest extends ApiRequest
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
        ];
    }
}
