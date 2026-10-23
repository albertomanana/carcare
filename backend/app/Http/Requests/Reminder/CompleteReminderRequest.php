<?php

namespace App\Http\Requests\Reminder;

use App\Http\Requests\ApiRequest;

/**
 * POST /reminders/{r}/complete (`CompleteReminderInput`).
 * Acepta además `confirm_mileage_drop` (opcional) por si el km indicado es menor que una lectura anterior.
 */
class CompleteReminderRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'completed_at' => ['required', ...self::pastDate()],
            'mileage' => ['sometimes', 'nullable', ...self::km()],
            'create_next' => ['sometimes', 'boolean'],
            'confirm_mileage_drop' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['completed_at.before_or_equal' => 'La fecha de realización no puede ser futura.'];
    }
}
