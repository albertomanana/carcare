<?php

namespace App\Http\Resources;

use App\Models\MaintenanceRecord;
use Illuminate\Http\Request;

/** @mixin MaintenanceRecord */
class MaintenanceRecordResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var MaintenanceRecord $record */
        $record = $this->resource;
        $record->loadMissing(self::eagerLoad());
        if (! array_key_exists('documents_count', $record->getAttributes())) {
            $record->loadCount('documents');
        }

        return [
            'id' => $record->id,
            'vehicle_id' => $record->vehicle_id,
            'type' => $record->type->value,
            'zone' => $record->zone->value,
            'service_kind' => $record->service_kind?->value,
            'title' => $record->title,
            'description' => $record->description,
            'service_date' => self::date($record->service_date),
            'mileage' => $record->mileage,
            'workshop_name' => $record->workshop_name,
            'parts_cost' => $record->parts_cost,
            'labor_cost' => $record->labor_cost,
            'total_cost' => $record->total_cost,
            'currency' => $record->currency ?? 'EUR',
            'items' => LineItemResource::collection($record->items),
            'expense_id' => $record->expense?->id,
            'work_order_id' => $record->workOrder?->id,
            'documents_count' => (int) $record->documents_count,
            'archived_at' => self::iso($record->archived_at),
            'created_at' => self::iso($record->created_at),
            'updated_at' => self::iso($record->updated_at),
        ];
    }

    public static function eagerLoad(): array
    {
        return ['items', 'expense:id,maintenance_record_id', 'workOrder:id,maintenance_record_id'];
    }
}
