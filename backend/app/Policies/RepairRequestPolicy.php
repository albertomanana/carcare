<?php

namespace App\Policies;

use App\Enums\WorkspaceRole;
use App\Models\RepairRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Solicitud de reparación (contrato §3.13.1, ADR‑0007): el único recurso con dos partes.
 *  - solicitante: el owner del espacio personal que la envió (`requester_workspace_id`);
 *  - taller: cualquier miembro del espacio destinatario (`workshop_workspace_id`).
 * Quien no es ninguna de las dos partes recibe 404 en todas las rutas. Una parte que pide una
 * acción de la otra, o el mecánico que intenta decidir, recibe 403.
 */
class RepairRequestPolicy
{
    private const FORBIDDEN = 'No tienes permiso para esta acción.';

    /** Ver la solicitud y el historial compartido: las dos partes. */
    public function view(User $user, RepairRequest $request): Response
    {
        return self::isRequester($user, $request) || self::workshopRole($user, $request) !== null
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    /** Acciones del particular: cancelar, compartir el historial y responder al presupuesto. */
    public function actAsRequester(User $user, RepairRequest $request): Response
    {
        if (self::isRequester($user, $request)) {
            return Response::allow();
        }

        return self::workshopRole($user, $request) !== null
            ? Response::deny(self::FORBIDDEN)
            : Response::denyAsNotFound();
    }

    /** Decisiones del taller (aceptar, rechazar, enviar presupuesto): owner y manager. */
    public function decide(User $user, RepairRequest $request): Response
    {
        $role = self::workshopRole($user, $request);

        if ($role !== null && $role->allows(WorkspaceRole::MANAGE)) {
            return Response::allow();
        }

        return $role !== null || self::isRequester($user, $request)
            ? Response::deny(self::FORBIDDEN)
            : Response::denyAsNotFound();
    }

    public static function isRequester(User $user, RepairRequest $request): bool
    {
        return $user->roleIn($request->requester_workspace_id) === WorkspaceRole::Owner;
    }

    private static function workshopRole(User $user, RepairRequest $request): ?WorkspaceRole
    {
        return $user->roleIn($request->workshop_workspace_id);
    }
}
