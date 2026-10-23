<?php

namespace App\Http\Requests\Reminder;

use App\Enums\ReminderKind;
use App\Enums\Zone;
use App\Http\Requests\ApiRequest;
use App\Models\Reminder;
use Illuminate\Validation\Rule;

/**
 * POST /vehicles/{v}/reminders y PATCH /reminders/{r} (`ReminderInput`).
 * Al crear hace falta al menos `due_date` o `due_mileage`; al editar lo vuelve a comprobar
 * ReminderService con los valores resultantes.
 */
class ReminderRequest extends ApiRequest
{
    public const DUE_MESSAGE = 'Indica una fecha límite o un kilometraje límite.';

    public function rules(): array
    {
        $creating = ! $this->route('reminder') instanceof Reminder;
        $required = $this->presence($creating);

        return [
            'title' => [$required, 'string', 'min:2', 'max:120'],
            'kind' => [$required, Rule::enum(ReminderKind::class)],
            'zone' => ['sometimes', 'nullable', Rule::enum(Zone::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'due_date' => $creating
                ? ['nullable', 'required_without:due_mileage', 'date_format:Y-m-d']
                : ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'due_mileage' => ['sometimes', 'nullable', ...self::km()],
            'recurrence_months' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:120'],
            'recurrence_km' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1000000'],
        ];
    }

    public function messages(): array
    {
        return [
            'due_date.required_without' => self::DUE_MESSAGE,
            'recurrence_months.max' => 'La recurrencia no puede superar 120 meses.',
        ];
    }
}
