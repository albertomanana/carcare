<?php

namespace App\Http\Requests\Maintenance;

use App\Enums\RecordType;
use App\Enums\ServiceKind;
use App\Enums\Zone;
use App\Http\Requests\ApiRequest;
use App\Models\MaintenanceRecord;
use Illuminate\Validation\Rule;

/**
 * POST /vehicles/{v}/maintenance y PATCH /maintenance/{r} (`MaintenanceInput`, parcial en PATCH).
 * title 2–120, service_date no futura, importes 0–999.999,99 con 2 decimales, items máx. 50, quantity > 0.
 */
class MaintenanceRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $this->dropNullItems();
    }

    public function rules(): array
    {
        $required = $this->presence(! $this->route('maintenanceRecord') instanceof MaintenanceRecord);

        return [
            'type' => [$required, Rule::enum(RecordType::class)],
            'zone' => [$required, Rule::enum(Zone::class)],
            'service_kind' => ['sometimes', 'nullable', Rule::enum(ServiceKind::class)],
            'title' => [$required, 'string', 'min:2', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'service_date' => [$required, ...self::pastDate()],
            'mileage' => ['sometimes', 'nullable', ...self::km()],
            'workshop_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'parts_cost' => ['sometimes', 'nullable', ...self::money()],
            'labor_cost' => ['sometimes', 'nullable', ...self::money()],
            'total_cost' => ['sometimes', 'nullable', ...self::money()],
            ...self::itemRules(),
            'confirm_mileage_drop' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'service_date.before_or_equal' => 'La fecha de la intervención no puede ser futura.',
            'items.max' => 'Una intervención admite como máximo 50 líneas.',
            'items.*.quantity.gt' => 'La cantidad de cada línea debe ser mayor que 0.',
            'mileage.max' => 'El kilometraje debe estar entre 0 y 2.000.000 km.',
        ];
    }
}
