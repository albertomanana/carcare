<?php

namespace App\Http\Requests\Vehicle;

use App\Enums\BodyType;
use App\Enums\FuelType;
use App\Enums\Transmission;
use App\Http\Requests\ApiRequest;
use App\Models\Customer;
use App\Models\Vehicle;
use App\Models\Workspace;
use Closure;
use Illuminate\Validation\Rule;

/**
 * POST /workspaces/{ws}/vehicles y PATCH /vehicles/{v} (`VehicleInput`, parcial en PATCH).
 *  - plate: mayúsculas, sin espacios ni guiones; única por espacio entre no archivados.
 *  - vin: 17 caracteres [A-HJ-NPR-Z0-9], único por espacio.
 *  - customer_id: solo en talleres, del mismo espacio (422 en personal) y no anonimizado (§3.10.1).
 *  - current_mileage: solo al crear (en PATCH se ignora: se usa /mileage).
 */
class VehicleRequest extends ApiRequest
{
    public static function normalizePlate(mixed $plate): mixed
    {
        if (! is_string($plate)) {
            return $plate;
        }
        $plate = mb_strtoupper(preg_replace('/[\s\-]+/u', '', $plate) ?? '');

        return $plate === '' ? null : $plate;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if ($this->has('plate')) {
            $merge['plate'] = self::normalizePlate($this->input('plate'));
        }
        if ($this->has('vin') && is_string($this->input('vin'))) {
            $vin = mb_strtoupper(preg_replace('/\s+/u', '', $this->input('vin')) ?? '');
            $merge['vin'] = $vin === '' ? null : $vin;
        }
        foreach (['make', 'model', 'nickname', 'version', 'engine'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $merge[$field] = ($value === '' && ! in_array($field, ['make', 'model'], true)) ? null : $value;
            }
        }
        $this->merge($merge);
    }

    private function vehicle(): ?Vehicle
    {
        $vehicle = $this->route('vehicle');

        return $vehicle instanceof Vehicle ? $vehicle : null;
    }

    private function workspace(): Workspace
    {
        return $this->vehicle()?->workspace ?? $this->route('workspace');
    }

    public function rules(): array
    {
        $vehicle = $this->vehicle();
        $workspace = $this->workspace();
        $creating = $vehicle === null;
        $required = $this->presence($creating);

        $rules = [
            'make' => [$required, 'string', 'min:1', 'max:60'],
            'model' => [$required, 'string', 'min:1', 'max:80'],
            'nickname' => ['sometimes', 'nullable', 'string', 'max:60'],
            'version' => ['sometimes', 'nullable', 'string', 'max:80'],
            'year' => ['sometimes', 'nullable', 'integer', 'min:1900', 'max:'.(now()->year + 1)],
            'fuel_type' => ['sometimes', 'nullable', Rule::enum(FuelType::class)],
            'transmission' => ['sometimes', 'nullable', Rule::enum(Transmission::class)],
            'engine' => ['sometimes', 'nullable', 'string', 'max:60'],
            'body_type' => ['sometimes', 'nullable', Rule::enum(BodyType::class)],
            'color_hex' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'plate' => [
                'sometimes', 'nullable', 'string', 'max:15',
                Rule::unique('vehicles', 'plate')
                    ->where('workspace_id', $workspace->id)
                    ->whereNull('archived_at')
                    ->ignore($vehicle?->id),
            ],
            'vin' => [
                'sometimes', 'nullable', 'string', 'regex:/^[A-HJ-NPR-Z0-9]{17}$/',
                Rule::unique('vehicles', 'vin')->where('workspace_id', $workspace->id)->ignore($vehicle?->id),
            ],
            'purchase_date' => ['sometimes', 'nullable', ...self::pastDate()],
            'purchase_mileage' => ['sometimes', 'nullable', ...self::km()],
            'customer_id' => $workspace->isWorkshop()
                ? [
                    'sometimes', 'nullable', 'bail', 'integer',
                    Rule::exists('customers', 'id')->where('workspace_id', $workspace->id),
                    $this->notAnonymized($vehicle),
                ]
                : ['sometimes', 'nullable', 'prohibited'],
        ];

        if ($creating) {
            $rules['current_mileage'] = ['sometimes', 'nullable', ...self::km()];
        }

        return $rules;
    }

    /**
     * Un cliente anonimizado no se puede asignar a ningún vehículo (§3.10.1). Si el vehículo ya era suyo y el
     * PATCH reenvía el mismo `customer_id` (la SPA manda el formulario completo), no es una asignación nueva.
     */
    private function notAnonymized(?Vehicle $vehicle): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($vehicle) {
            if ($vehicle?->customer_id !== null && (int) $value === (int) $vehicle->customer_id) {
                return;
            }

            if (Customer::query()->whereKey((int) $value)->whereNotNull('anonymized_at')->exists()) {
                $fail('Este cliente está anonimizado: crea uno nuevo.');
            }
        };
    }

    public function messages(): array
    {
        $maxYear = now()->year + 1;

        return [
            'year.min' => "El año debe estar entre 1900 y {$maxYear}.",
            'year.max' => "El año debe estar entre 1900 y {$maxYear}.",
            'color_hex.regex' => 'El color debe tener el formato #RRGGBB.',
            'plate.unique' => 'Ya hay un vehículo activo con esa matrícula en este espacio.',
            'vin.regex' => 'El VIN debe tener 17 caracteres (letras y números, sin I, O ni Q).',
            'vin.unique' => 'Ya hay un vehículo con ese número de bastidor en este espacio.',
            'customer_id.prohibited' => 'Los vehículos de un espacio personal no tienen cliente.',
            'customer_id.exists' => 'El cliente no existe en este taller.',
            'purchase_mileage.max' => 'El kilometraje debe estar entre 0 y 2.000.000 km.',
            'current_mileage.max' => 'El kilometraje debe estar entre 0 y 2.000.000 km.',
        ];
    }
}
