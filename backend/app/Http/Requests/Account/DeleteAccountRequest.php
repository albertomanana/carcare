<?php

namespace App\Http\Requests\Account;

use App\Http\Requests\ApiRequest;

/** DELETE /me: `{ password }` para confirmar el borrado de la cuenta. */
class DeleteAccountRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'current_password:web'],
        ];
    }

    public function messages(): array
    {
        return ['password.current_password' => 'La contraseña no es correcta.'];
    }
}
