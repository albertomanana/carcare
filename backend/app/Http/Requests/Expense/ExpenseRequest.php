<?php

namespace App\Http\Requests\Expense;

use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
use App\Enums\RecordType;
use App\Enums\Zone;
use App\Http\Requests\ApiRequest;
use App\Models\Expense;
use Illuminate\Validation\Rule;

/**
 * POST /vehicles/{v}/expenses y PATCH /expenses/{e} (`ExpenseInput`, parcial en PATCH).
 * amount > 0, expense_date no futura. Los datos de repostaje solo se guardan con category = fuel
 * (ExpenseService los pone a null en el resto y elige la unidad por defecto).
 */
class ExpenseRequest extends ApiRequest
{
    public function rules(): array
    {
        $required = $this->presence(! $this->route('expense') instanceof Expense);

        return [
            'category' => [$required, Rule::enum(ExpenseCategory::class)],
            'amount' => [$required, ...self::money(positive: true)],
            'expense_date' => [$required, ...self::pastDate()],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mileage' => ['sometimes', 'nullable', ...self::km()],
            'fuel_quantity' => ['sometimes', 'nullable', 'numeric', 'gt:0', 'max:99999.99', 'decimal:0,2'],
            'fuel_unit' => ['sometimes', 'nullable', Rule::enum(FuelUnit::class)],
            'full_tank' => ['sometimes', 'nullable', 'boolean'],
            'confirm_mileage_drop' => ['sometimes', 'boolean'],
            // Gasto periódico (§3.6.1): mensual, trimestral, semestral o anual, con su próxima renovación
            'recurrence_months' => ['sometimes', 'nullable', 'integer', Rule::in([1, 3, 6, 12])],
            'next_due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            // Asociar a una intervención sin coste o crearla en el mismo paso (solo al crear el gasto)
            'maintenance_record_id' => ['sometimes', 'nullable', 'integer', 'prohibits:record'],
            'record' => ['sometimes', 'nullable', 'array'],
            'record.title' => ['required_with:record', 'string', 'min:2', 'max:120'],
            'record.type' => ['sometimes', 'nullable', Rule::enum(RecordType::class)],
            'record.zone' => ['sometimes', 'nullable', Rule::enum(Zone::class)],
            'record.workshop_name' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.gt' => 'El importe debe ser mayor que 0.',
            'expense_date.before_or_equal' => 'La fecha del gasto no puede ser futura.',
            'fuel_quantity.gt' => 'La cantidad repostada debe ser mayor que 0.',
            'mileage.max' => 'El kilometraje debe estar entre 0 y 2.000.000 km.',
        ];
    }
}
