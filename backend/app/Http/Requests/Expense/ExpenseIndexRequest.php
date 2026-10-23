<?php

namespace App\Http\Requests\Expense;

use App\Enums\ExpenseCategory;
use App\Http\Requests\ApiRequest;

/** GET /vehicles/{v}/expenses: `from`, `to`, `category` (admite lista separada por comas). */
class ExpenseIndexRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'category' => [
                'sometimes', 'nullable', 'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $invalid = array_diff($this->categories() ?? [], ExpenseCategory::values());
                    if ($invalid !== []) {
                        $fail('Categoría no válida: '.implode(', ', $invalid).'.');
                    }
                },
            ],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /** @return list<string>|null */
    public function categories(): ?array
    {
        $raw = $this->query('category');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        return array_values(array_filter(array_map('trim', explode(',', $raw)), fn ($c) => $c !== ''));
    }
}
