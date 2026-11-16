<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;

/** `?month=YYYY-MM` para el detalle de un mes de la analítica (contrato §4.1). */
class MonthRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'month' => ['required', 'date_format:Y-m'],
        ];
    }

    public function messages(): array
    {
        return [
            'month.required' => 'Indica el mes (AAAA-MM).',
            'month.date_format' => 'El mes tiene que ir como AAAA-MM.',
        ];
    }

    public function month(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m', (string) $this->query('month'))->startOfMonth();
    }
}
