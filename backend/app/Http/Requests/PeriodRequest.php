<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;

/**
 * `?from&to` (fechas 'YYYY-MM-DD', inclusivas) para resumen, diario y analítica.
 * El periodo por defecto depende del endpoint: lo decide el controlador con period().
 */
class PeriodRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    public function messages(): array
    {
        return ['to.after_or_equal' => 'La fecha de fin no puede ser anterior a la de inicio.'];
    }

    /**
     * @param  callable(CarbonImmutable $to): CarbonImmutable  $defaultFrom  inicio por defecto a partir del fin
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function period(callable $defaultFrom): array
    {
        $to = $this->filled('to') ? CarbonImmutable::parse($this->query('to'))->startOfDay() : CarbonImmutable::today();
        $from = $this->filled('from') ? CarbonImmutable::parse($this->query('from'))->startOfDay() : $defaultFrom($to);

        return [$from, $to];
    }
}
