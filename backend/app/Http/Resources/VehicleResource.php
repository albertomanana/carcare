<?php

namespace App\Http\Resources;

use App\Enums\ReminderState;
use App\Models\Vehicle;
use Illuminate\Http\Request;

/** @mixin Vehicle */
class VehicleResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var Vehicle $vehicle */
        $vehicle = $this->resource;
        $vehicle->loadMissing(['customer', 'pendingReminders', 'openWorkOrder', 'workspace']);
        if (! array_key_exists('records_count', $vehicle->getAttributes())) {
            $vehicle->loadCount(['maintenanceRecords as records_count' => fn ($q) => $q->whereNull('archived_at')]);
        }

        // Cada recordatorio usa el km actual de este vehículo (sin consultas extra).
        $states = $vehicle->pendingReminders
            ->each(fn ($r) => $r->setRelation('vehicle', $vehicle))
            ->map(fn ($r) => $r->evaluate()['state']);

        $openOrder = $vehicle->workspace->isWorkshop() ? $vehicle->openWorkOrder : null;

        return [
            'id' => $vehicle->id,
            'workspace_id' => $vehicle->workspace_id,
            'customer' => $vehicle->customer ? new CustomerRefResource($vehicle->customer) : null,
            'nickname' => $vehicle->nickname,
            'make' => $vehicle->make,
            'model' => $vehicle->model,
            'version' => $vehicle->version,
            'year' => $vehicle->year,
            'fuel_type' => $vehicle->fuel_type?->value,
            'transmission' => $vehicle->transmission?->value,
            'engine' => $vehicle->engine,
            'body_type' => $vehicle->body_type?->value,
            'color_hex' => $vehicle->color_hex,
            'plate' => $vehicle->plate,
            'vin' => $vehicle->vin,
            'purchase_date' => self::date($vehicle->purchase_date),
            'purchase_mileage' => $vehicle->purchase_mileage,
            'current_mileage' => $vehicle->current_mileage,
            'mileage_updated_at' => self::date($vehicle->mileage_updated_at),
            'display_name' => $vehicle->displayName(),
            'archived_at' => self::iso($vehicle->archived_at),
            'created_at' => self::iso($vehicle->created_at),
            'updated_at' => self::iso($vehicle->updated_at),
            'stats' => [
                'records_count' => (int) $vehicle->records_count,
                'pending_reminders' => $states->count(),
                'overdue_reminders' => $states->filter(fn ($s) => $s === ReminderState::Overdue)->count(),
                'soon_reminders' => $states->filter(fn ($s) => $s === ReminderState::Soon)->count(),
                'open_work_order' => $openOrder ? [
                    'id' => $openOrder->id,
                    'number' => $openOrder->number,
                    'status' => $openOrder->status->value,
                    'bay' => $openOrder->bay,
                ] : null,
            ],
        ];
    }

    /** Relaciones y contadores para listar vehículos sin consultas N+1. */
    public static function eagerLoad(): array
    {
        return ['customer', 'pendingReminders', 'openWorkOrder', 'workspace'];
    }

    public static function eagerCount(): array
    {
        return ['maintenanceRecords as records_count' => fn ($q) => $q->whereNull('archived_at')];
    }
}
