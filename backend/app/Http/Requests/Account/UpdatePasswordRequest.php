<?php

namespace App\Http\Requests\Account;

use App\Http\Requests\ApiRequest;

/** PUT /me/password: `{ current_password, password, password_confirmation }`. */
class UpdatePasswordRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed', 'different:current_password'],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.current_password' => 'La contraseña actual no es correcta.',
            'password.different' => 'La nueva contraseña debe ser distinta de la actual.',
        ];
    }
}
