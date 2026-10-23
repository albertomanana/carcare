<?php

namespace App\Http\Requests\Vehicle;

use App\Http\Requests\ApiRequest;

/** POST /vehicles/{v}/mileage (`MileageInput`). La coherencia con otras lecturas la comprueba MileageService. */
class StoreMileageRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'recorded_at' => ['required', ...self::pastDate()],
            'mileage' => ['required', ...self::km()],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
            'confirm_mileage_drop' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'mileage.max' => 'El kilometraje debe estar entre 0 y 2.000.000 km.',
            'recorded_at.before_or_equal' => 'La fecha de la lectura no puede ser futura.',
        ];
    }
}
