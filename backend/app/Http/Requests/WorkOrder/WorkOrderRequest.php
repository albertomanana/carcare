<?php

namespace App\Http\Requests\WorkOrder;

use App\Enums\Priority;
use App\Http\Requests\ApiRequest;
use App\Models\WorkOrder;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;

/**
 * POST /workspaces/{ws}/work-orders y PATCH /work-orders/{o} (`WorkOrderInput`, parcial en PATCH).
 *  - vehicle_id: vehículo activo del mismo taller.
 *  - bay: 1…bays_count (la ocupación la comprueba WorkOrderService ⇒ 409).
 *  - assigned_to: miembro del espacio.
 */
class WorkOrderRequest extends ApiRequest
{
    protected function prepareForValidation(): void
    {
        $this->dropNullItems();
    }

    private function order(): ?WorkOrder
    {
        $order = $this->route('workOrder');

        return $order instanceof WorkOrder ? $order : null;
    }

    private function workspace(): Workspace
    {
        return $this->order()?->workspace ?? $this->route('workspace');
    }

    public function rules(): array
    {
        $workspace = $this->workspace();
        $required = $this->presence($this->order() === null);

        return [
            'vehicle_id' => [
                $required, 'integer',
                Rule::exists('vehicles', 'id')->where('workspace_id', $workspace->id)->whereNull('archived_at'),
            ],
            'title' => [$required, 'string', 'min:2', 'max:120'],
            'complaint' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'diagnosis' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'priority' => ['sometimes', Rule::enum(Priority::class)],
            'bay' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.$workspace->baysCount()],
            'assigned_to' => [
                'sometimes', 'nullable', 'integer',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
            'mileage_in' => ['sometimes', 'nullable', ...self::km()],
            'promised_at' => ['sometimes', 'nullable', 'date'],
            'tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            ...self::itemRules(),
        ];
    }

    public function messages(): array
    {
        $bays = $this->workspace()->baysCount();

        return [
            'vehicle_id.exists' => 'El vehículo no existe en este taller o está archivado.',
            'bay.min' => "El elevador debe estar entre 1 y {$bays}.",
            'bay.max' => "El elevador debe estar entre 1 y {$bays}.",
            'assigned_to.exists' => 'La persona asignada no es miembro de este taller.',
            'items.max' => 'Una orden admite como máximo 50 líneas.',
            'items.*.quantity.gt' => 'La cantidad de cada línea debe ser mayor que 0.',
            'tax_rate.max' => 'El IVA debe estar entre 0 y 100.',
        ];
    }

    /**
     * Datos validados con `promised_at` convertido a la zona horaria de la aplicación
     * (el cliente puede enviarlo con cualquier desplazamiento ISO 8601).
     */
    public function payload(): array
    {
        $data = $this->validated();

        if (! empty($data['promised_at'])) {
            $data['promised_at'] = CarbonImmutable::parse($data['promised_at'])->setTimezone(config('app.timezone'));
        }

        return $data;
    }
}
