<?php

namespace App\Services;

use App\Enums\NotificationKind;
use App\Enums\WorkOrderStatus;
use App\Models\RepairRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Notifications\RepairRequestNotification;
use Illuminate\Support\Facades\Auth;

/**
 * Destinatarios de los avisos de E16 (contrato §3.13.8):
 *  - de lo que hace el taller, la persona que envió la solicitud;
 *  - de lo que hace el particular, el owner y los managers del taller en ese momento (nunca el mecánico).
 * Nunca recibe el aviso quien hace la acción. Va aparte de RepairRequestService para que WorkOrderService
 * pueda avisar de una orden lista sin depender de él.
 */
class RepairRequestNotifier
{
    /** Al particular, desde su espacio personal. */
    public function toRequester(RepairRequest $request, NotificationKind $kind, string $summary): void
    {
        $requester = $request->requester()->first();

        if ($requester === null || $this->isActor($requester)) {
            return;
        }

        $requester->notify(new RepairRequestNotification($kind, $summary, $request->requester_workspace_id, $request->id));
    }

    /** Al owner y a los managers del taller destinatario, desde el taller. */
    public function toWorkshop(RepairRequest $request, NotificationKind $kind, string $summary): void
    {
        $recipients = $request->workshop()->firstOrFail()->managers()->orderBy('users.id')->get()
            ->reject(fn (User $user) => $this->isActor($user));

        // Una instancia por persona: cada una lleva su propio id ordenado (RepairRequestNotification).
        foreach ($recipients as $user) {
            $user->notify(new RepairRequestNotification($kind, $summary, $request->workshop_workspace_id, $request->id));
        }
    }

    /**
     * La orden que nació de una solicitud pasa a `ready`: se avisa al particular (§3.13.6). Ningún otro cambio
     * de estado de la orden avisa. "Tu Seat Ibiza está listo en Taller Demo (OT-2026-0031)".
     */
    public function orderReady(WorkOrder $order): void
    {
        if ($order->status !== WorkOrderStatus::Ready) {
            return;
        }

        $request = RepairRequest::query()->where('work_order_id', $order->id)->with('workshop')->first();
        if ($request === null) {
            return;
        }

        $this->toRequester($request, NotificationKind::OrderReady,
            "Tu {$request->vehicleName()} está listo en {$request->workshop->name} ({$order->number})");
    }

    private function isActor(User $user): bool
    {
        return Auth::id() !== null && Auth::id() === $user->getKey();
    }
}
