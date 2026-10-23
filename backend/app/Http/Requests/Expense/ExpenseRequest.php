<?php

namespace App\Http\Requests\Expense;

use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
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
