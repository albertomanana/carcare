<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\ApiRequest;
use App\Models\Customer;

/** POST /workspaces/{ws}/customers y PATCH /customers/{c} (`CustomerInput`). */
class CustomerRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $email = mb_strtolower(trim($this->input('email')));
            $this->merge(['email' => $email === '' ? null : $email]);
        }
        if (is_string($this->input('tax_id'))) {
            $taxId = mb_strtoupper(preg_replace('/[\s\-]+/u', '', $this->input('tax_id')) ?? '');
            $this->merge(['tax_id' => $taxId === '' ? null : $taxId]);
        }
    }

    public function rules(): array
    {
        $required = $this->presence(! $this->route('customer') instanceof Customer);

        return [
            'name' => [$required, 'string', 'min:2', 'max:120'],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30', 'regex:/^[0-9+()\s.\-]{6,30}$/'],
            'tax_id' => ['sometimes', 'nullable', 'string', 'max:20'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return ['phone.regex' => 'El teléfono solo puede contener números, espacios y los signos + ( ) - .'];
    }
}
