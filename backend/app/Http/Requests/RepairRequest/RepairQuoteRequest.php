<?php

namespace App\Http\Requests\RepairRequest;

use App\Enums\ItemKind;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/**
 * POST /repair-requests/{r}/quotes (`RepairQuoteInput`, contrato §3.13.5): 1–50 líneas con precio
 * obligatorio, IVA 0–100 (por defecto el del taller), validez 1–90 días (por defecto 15) y nota ≤ 1000.
 * AcceptRepairRequestRequest reutiliza estas reglas con el prefijo `quote.`.
 */
class RepairQuoteRequest extends ApiRequest
{
    public function rules(): array
    {
        return self::quoteRules();
    }

    public function messages(): array
    {
        return self::quoteMessages();
    }

    public static function quoteRules(string $prefix = ''): array
    {
        return [
            "{$prefix}items" => ['required', 'array', 'min:1', 'max:50'],
            "{$prefix}items.*" => ['array'],
            "{$prefix}items.*.kind" => ['required', Rule::enum(ItemKind::class)],
            "{$prefix}items.*.name" => ['required', 'string', 'min:1', 'max:120'],
            "{$prefix}items.*.part_number" => ['sometimes', 'nullable', 'string', 'max:60'],
            "{$prefix}items.*.quantity" => ['required', 'numeric', 'gt:0', 'max:99999.99', 'decimal:0,2'],
            "{$prefix}items.*.unit_price" => ['required', ...self::money()],
            "{$prefix}tax_rate" => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            "{$prefix}valid_days" => ['sometimes', 'nullable', 'integer', 'min:1', 'max:90'],
            "{$prefix}note" => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    public static function quoteMessages(string $prefix = ''): array
    {
        return [
            "{$prefix}items.required" => 'Un presupuesto necesita al menos una línea.',
            "{$prefix}items.min" => 'Un presupuesto necesita al menos una línea.',
            "{$prefix}items.max" => 'Un presupuesto admite como máximo 50 líneas.',
            "{$prefix}items.*.unit_price.required" => 'Cada línea del presupuesto necesita su precio.',
            "{$prefix}items.*.quantity.gt" => 'La cantidad de cada línea debe ser mayor que 0.',
            "{$prefix}tax_rate.max" => 'El IVA debe estar entre 0 y 100.',
            "{$prefix}valid_days.min" => 'La validez debe estar entre 1 y 90 días.',
            "{$prefix}valid_days.max" => 'La validez debe estar entre 1 y 90 días.',
        ];
    }
}
