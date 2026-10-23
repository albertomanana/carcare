<?php

namespace App\Http\Requests;

use App\Enums\ItemKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Base de los Form Requests de la API.
 *
 * La autorización NO se hace aquí: cada ruta lleva su middleware `can:` (policies), que se
 * ejecuta antes de validar. Así un recurso ajeno responde 404 aunque el cuerpo sea inválido.
 */
abstract class ApiRequest extends FormRequest
{
    public const MAX_MONEY = '999999.99';

    public const MAX_KM = 2000000;

    public function authorize(): bool
    {
        return true;
    }

    /** Importe en euros: número con 2 decimales como máximo, ≥ 0 (o > 0 si $positive). */
    protected static function money(bool $positive = false): array
    {
        return ['numeric', $positive ? 'gt:0' : 'min:0', 'max:'.self::MAX_MONEY, 'decimal:0,2'];
    }

    /** Kilometraje: entero 0–2.000.000. */
    protected static function km(): array
    {
        return ['integer', 'min:0', 'max:'.self::MAX_KM];
    }

    /** Fecha 'YYYY-MM-DD' que no puede ser futura. */
    protected static function pastDate(): array
    {
        return ['date_format:Y-m-d', 'before_or_equal:today'];
    }

    /** Líneas (`LineItemInput[]`) de intervenciones y órdenes de trabajo. */
    protected static function itemRules(): array
    {
        return [
            'items' => ['sometimes', 'array', 'max:50'],
            'items.*' => ['array'],
            'items.*.kind' => ['required', Rule::enum(ItemKind::class)],
            'items.*.name' => ['required', 'string', 'max:120'],
            'items.*.part_number' => ['nullable', 'string', 'max:60'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:99999.99', 'decimal:0,2'],
            'items.*.unit_price' => ['nullable', ...self::money()],
        ];
    }

    /** `items: null` equivale a no enviarlas (no borra las líneas existentes). */
    protected function dropNullItems(): void
    {
        if ($this->has('items') && $this->input('items') === null) {
            $this->request->remove('items');
            if ($this->isJson()) {
                $this->json()->remove('items');
            }
        }
    }

    /** 'required' al crear, 'sometimes' al editar (PATCH parcial). */
    protected function presence(bool $creating): string
    {
        return $creating ? 'required' : 'sometimes';
    }
}
