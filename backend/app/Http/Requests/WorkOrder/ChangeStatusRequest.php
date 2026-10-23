<?php

namespace App\Http\Requests\WorkOrder;

use App\Enums\WorkOrderStatus;
use App\Http\Requests\ApiRequest;
use App\Models\WorkOrder;
use Illuminate\Validation\Rule;

/** POST /work-orders/{o}/status (`WorkOrderStatusInput`): `{ status, bay? }` (bay null libera el elevador). */
class ChangeStatusRequest extends ApiRequest
{
    public function rules(): array
    {
        /** @var WorkOrder $order */
        $order = $this->route('workOrder');

        return [
            'status' => ['required', Rule::enum(WorkOrderStatus::class)],
            'bay' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.$order->workspace->baysCount()],
        ];
    }

    public function messages(): array
    {
        /** @var WorkOrder $order */
        $order = $this->route('workOrder');
        $bays = $order->workspace->baysCount();

        return [
            'bay.min' => "El elevador debe estar entre 1 y {$bays}.",
            'bay.max' => "El elevador debe estar entre 1 y {$bays}.",
        ];
    }

    public function status(): WorkOrderStatus
    {
        return WorkOrderStatus::from($this->validated('status'));
    }

    public function bayProvided(): bool
    {
        return array_key_exists('bay', $this->validated());
    }

    public function bay(): ?int
    {
        $bay = $this->validated('bay');

        return $bay === null ? null : (int) $bay;
    }
}
