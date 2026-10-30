<?php

namespace App\Http\Resources;

use App\Enums\WorkspaceRole;
use App\Models\RepairRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Solicitud de reparación (`RepairRequest`, contrato §3.13). La ven sus dos partes y `perspective` la
 * decide el servidor: `requester` si quien pregunta es el owner del espacio que la envió; si no, `workshop`.
 * El taller ve la copia fija del coche y nunca el coche vivo: `vehicle_id` le llega a null.
 */
class RepairRequestResource extends ApiResource
{
    /** Clave de la caché por petición con los espacios de los que el usuario es owner. */
    private const OWNED_WORKSPACES = 'carcare.owned_workspaces';

    public function toArray(Request $request): array
    {
        /** @var RepairRequest $r */
        $r = $this->resource;
        $r->loadMissing(RepairRequest::RESOURCE_RELATIONS);
        $isRequester = in_array((int) $r->requester_workspace_id, self::ownedWorkspaces($request), true);
        $order = $r->workOrder;

        return [
            'id' => $r->id,
            'perspective' => $isRequester ? 'requester' : 'workshop',
            'status' => $r->status->value,
            'workshop' => new DirectoryWorkshopRefResource($r->workshop),
            'requester' => ['name' => $r->requester->name, 'email' => $r->requester->email],
            'contact_phone' => $r->contact_phone,
            'vehicle_id' => $isRequester ? $r->vehicle_id : null,
            'vehicle' => [
                'make' => $r->vehicle_make,
                'model' => $r->vehicle_model,
                'year' => $r->vehicle_year,
                'fuel_type' => $r->vehicle_fuel_type?->value,
                'body_type' => $r->vehicle_body_type?->value,
                'color_hex' => $r->vehicle_color_hex,
                'plate' => $r->vehicle_plate,
                'display_name' => $r->vehicleName(),
            ],
            'title' => $r->title,
            'description' => $r->description,
            'zone' => $r->zone?->value,
            'preferred_date' => self::date($r->preferred_date),
            'mileage' => $r->mileage,
            'share_history' => $r->share_history,
            'history_available' => $r->historyAvailable(),
            'reject_reason' => $r->reject_reason,
            'quotes' => RepairQuoteResource::collection($r->quotes),
            'work_order' => $order === null ? null : [
                'id' => $order->id,
                'number' => $order->number,
                'status' => $order->status->value,
                'received_at' => self::iso($order->received_at),
                'completed_at' => self::iso($order->completed_at),
                'delivered_at' => self::iso($order->delivered_at),
            ],
            'responded_at' => self::iso($r->responded_at),
            'closed_at' => self::iso($r->closed_at),
            'created_at' => self::iso($r->created_at),
            'updated_at' => self::iso($r->updated_at),
        ];
    }

    /** @return list<int> Espacios de los que el usuario es owner (una consulta por petición, no por fila). */
    private static function ownedWorkspaces(Request $request): array
    {
        $owned = $request->attributes->get(self::OWNED_WORKSPACES);

        if ($owned === null) {
            $owned = DB::table('workspace_user')
                ->where('user_id', $request->user()?->getKey() ?? 0)
                ->where('role', WorkspaceRole::Owner->value)
                ->pluck('workspace_id')
                ->map(fn ($id) => (int) $id)
                ->all();
            $request->attributes->set(self::OWNED_WORKSPACES, $owned);
        }

        return $owned;
    }
}
