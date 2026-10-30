<?php

namespace App\Services;

use App\Enums\WorkspaceType;
use App\Models\Activity;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Support\ActivityPhrase;
use Illuminate\Support\Facades\Auth;

/**
 * Registra la actividad de escritura de un espacio (contrato §3.12).
 * La frase `summary` va en español y lista para mostrar; `metadata` nunca lleva
 * secretos ni datos personales sensibles (solo identificadores y valores de negocio).
 *
 * Autor en la frase: con un `ActivityPhrase`, en un taller empieza por el nombre de quien lo hizo
 * ("Ana registró…") y en un espacio personal va en segunda persona y sin nombre ("Anotaste…").
 * Las acciones que solo existen en talleres (clientes, órdenes, miembros) pasan la frase ya escrita.
 */
class ActivityLogger
{
    /** @var array<int, bool> espacio => es personal (el tipo de un espacio no cambia nunca). */
    private array $personal = [];

    public function log(
        int $workspaceId,
        string $action,
        string $entityType,
        int $entityId,
        string|ActivityPhrase $summary,
        ?int $vehicleId = null,
        array $metadata = [],
        ?User $user = null,
    ): Activity {
        $user ??= Auth::user();

        if ($summary instanceof ActivityPhrase) {
            $summary = $summary->render($this->isPersonal($workspaceId), $user?->name ?? 'Alguien');
        }

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

    /**
     * Actividad sin autor (`user = null`). E16 (§3.13.9): en la actividad del taller, las acciones del
     * particular y lo que nace de la conversión de una solicitud no llevan su nombre ("El cliente aceptó…").
     */
    public function logWithoutUser(
        int $workspaceId,
        string $action,
        string $entityType,
        int $entityId,
        string $summary,
        ?int $vehicleId = null,
        array $metadata = [],
    ): Activity {
        return Activity::create([
            'workspace_id' => $workspaceId,
            'user_id' => null,
            'vehicle_id' => $vehicleId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'summary' => mb_substr($summary, 0, 255),
            'metadata' => $metadata === [] ? null : $metadata,
        ]);
    }

    /** Atajo para acciones sobre un vehículo o sus datos. */
    public function forVehicle(Vehicle $vehicle, string $action, string $entityType, int $entityId, string|ActivityPhrase $summary, array $metadata = []): Activity
    {
        if ($vehicle->relationLoaded('workspace') && $vehicle->workspace !== null) {
            $this->personal[$vehicle->workspace_id] ??= $vehicle->workspace->isPersonal();
        }

        return $this->log($vehicle->workspace_id, $action, $entityType, $entityId, $summary, $vehicle->id, $metadata);
    }

    /** Nombre del autor para las frases de los talleres: "Ana añadió…". */
    public static function actor(): string
    {
        return Auth::user()?->name ?? 'Alguien';
    }

    private function isPersonal(int $workspaceId): bool
    {
        // toBase(): el valor en bruto ('personal'), sin pasar por el cast a enum del modelo.
        return $this->personal[$workspaceId] ??= Workspace::query()
            ->whereKey($workspaceId)
            ->toBase()
            ->value('type') === WorkspaceType::Personal->value;
    }
}
