<?php

namespace App\Http\Requests\Directory;

use App\Enums\WorkshopService;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/**
 * PUT /workspaces/{ws}/directory-profile (`DirectoryProfileInput`, contrato §3.13.2).
 * `listed` es obligatorio; con `listed = true`, la ciudad también (422 en `errors.city`).
 */
class DirectoryProfileRequest extends ApiRequest
{
    /** Formato del teléfono del directorio, que también usa `contact_phone` de una solicitud. */
    public const PHONE_REGEX = '/^[0-9 +()-]{6,30}$/';

    public const PHONE_MESSAGE = 'El teléfono solo puede contener números, espacios y los signos + ( ) - (de 6 a 30 caracteres).';

    protected function prepareForValidation(): void
    {
        foreach (['city', 'address', 'phone', 'opening_hours'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $this->merge([$field => $value === '' ? null : $value]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'listed' => ['required', 'boolean'],
            'city' => ['nullable', 'required_if_accepted:listed', 'string', 'min:2', 'max:80'],
            'address' => ['sometimes', 'nullable', 'string', 'max:160'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30', 'regex:'.self::PHONE_REGEX],
            'services' => ['sometimes', 'nullable', 'array', 'max:'.count(WorkshopService::cases())],
            'services.*' => ['required', 'distinct', Rule::enum(WorkshopService::class)],
            'opening_hours' => ['sometimes', 'nullable', 'string', 'max:200'],
        ];
    }

    public function messages(): array
    {
        return [
            'city.required_if_accepted' => 'Indica la ciudad para aparecer en el directorio.',
            'phone.regex' => self::PHONE_MESSAGE,
            'services.*.distinct' => 'Hay un servicio repetido.',
        ];
    }

    /** Datos validados con `listed` como booleano. */
    public function payload(): array
    {
        $data = $this->validated();
        $data['listed'] = $this->boolean('listed');

        return $data;
    }
}
