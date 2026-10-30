<?php

namespace App\Notifications;

use App\Enums\NotificationKind;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Aviso en la app de E16 (contrato §3.13.8, ADR‑0007 opción 4C): tabla `notifications` estándar de Laravel,
 * canal `database`, sin correo ni colas. `data = { kind, summary, workspace_id, repair_request_id }`.
 * La frase nunca lleva el nombre, el email ni el teléfono del particular.
 */
class RepairRequestNotification extends Notification
{
    /**
     * Id UUIDv7 (ordenado por tiempo y monótono en el mismo proceso): dos avisos del mismo segundo se
     * ordenan bien con `created_at, id`. Por eso cada instancia va a **un solo** destinatario
     * (RepairRequestNotifier envía una por persona; si se mandara a varios, compartirían la clave primaria).
     */
    public function __construct(
        public readonly NotificationKind $kind,
        public readonly string $summary,
        public readonly int $workspaceId,
        public readonly ?int $repairRequestId,
    ) {
        $this->id = (string) Str::uuid7();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, summary: string, workspace_id: int, repair_request_id: int|null} */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => $this->kind->value,
            'summary' => $this->summary,
            'workspace_id' => $this->workspaceId,
            'repair_request_id' => $this->repairRequestId,
        ];
    }
}
