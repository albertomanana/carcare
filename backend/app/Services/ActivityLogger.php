<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Auth;

/**
 * Registra la actividad de escritura de un espacio (contrato §3.12).
 * La frase `summary` va en español y lista para mostrar; `metadata` nunca lleva
 * secretos ni datos personales sensibles (solo identificadores y valores de negocio).
 */
class ActivityLogger
{
    public function log(
        int $workspaceId,
        string $action,
        string $entityType,
        int $entityId,
        string $summary,
        ?int $vehicleId = null,
        array $metadata = [],
        ?User $user = null,
    ): Activity {
        $user ??= Auth::user();

        return Activity::create([
            'workspace_id' => $workspaceId,
            'user_id' => $user?->getKey(),
            'vehicle_id' => $vehicleId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'summary' => mb_substr($summary, 0, 255),
            'metadata' => $metadata === [] ? null : $metadata,
        ]);
    }

    /** Atajo para acciones sobre un vehículo o sus datos. */
    public function forVehicle(Vehicle $vehicle, string $action, string $entityType, int $entityId, string $summary, array $metadata = []): Activity
    {
        return $this->log($vehicle->workspace_id, $action, $entityType, $entityId, $summary, $vehicle->id, $metadata);
    }

    /** Nombre del autor para las frases: "Ana añadió…". */
    public static function actor(): string
    {
        return Auth::user()?->name ?? 'Alguien';
    }
}
