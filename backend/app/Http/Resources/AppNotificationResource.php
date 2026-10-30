<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Aviso en la app (`AppNotification`, contrato §3.13.8). Se lee de la columna `data` de la tabla estándar
 * `notifications`: `{ kind, summary, workspace_id, repair_request_id }`.
 */
class AppNotificationResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var DatabaseNotification $notification */
        $notification = $this->resource;
        $data = $notification->data;

        return [
            'id' => $notification->id,
            'kind' => $data['kind'],
            'summary' => $data['summary'],
            'workspace_id' => (int) $data['workspace_id'],
            'repair_request_id' => isset($data['repair_request_id']) ? (int) $data['repair_request_id'] : null,
            'read_at' => self::iso($notification->read_at),
            'created_at' => self::iso($notification->created_at),
        ];
    }
}
