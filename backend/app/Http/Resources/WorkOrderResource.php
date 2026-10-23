<?php

namespace App\Http\Resources;

use App\Models\WorkOrder;
use Illuminate\Http\Request;

/** @mixin WorkOrder */
class WorkOrderResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var WorkOrder $order */
        $order = $this->resource;
        $order->loadMissing(WorkOrder::RESOURCE_RELATIONS);

        return [
            'id' => $order->id,
            'workspace_id' => $order->workspace_id,
            'number' => $order->number,
            'vehicle' => new VehicleRefResource($order->vehicle),
            'customer' => $order->customer ? new CustomerRefResource($order->customer) : null,
            'title' => $order->title,
            'complaint' => $order->complaint,
            'diagnosis' => $order->diagnosis,
            'status' => $order->status->value,
            'priority' => $order->priority->value,
            'bay' => $order->bay,
            'assigned_to' => $order->assignee ? ['id' => $order->assignee->id, 'name' => $order->assignee->name] : null,
            'mileage_in' => $order->mileage_in,
            'received_at' => self::iso($order->received_at),
            'promised_at' => self::iso($order->promised_at),
            'completed_at' => self::iso($order->completed_at),
            'delivered_at' => self::iso($order->delivered_at),
            'items' => LineItemResource::collection($order->items),
            'subtotal' => $order->subtotal,
            'tax_rate' => $order->tax_rate,
            'tax_amount' => $order->tax_amount,
            'total' => $order->total,
            'is_late' => $order->isLate(),
            'maintenance_record_id' => $order->maintenance_record_id,
            'created_at' => self::iso($order->created_at),
            'updated_at' => self::iso($order->updated_at),
        ];
    }
}
