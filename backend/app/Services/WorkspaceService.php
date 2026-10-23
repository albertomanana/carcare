<?php

namespace App\Services;

use App\Enums\WorkspaceRole;
use App\Enums\WorkspaceType;
use App\Exceptions\ConflictException;
use App\Models\Document;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\Workspace;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/** Espacios de trabajo y sus miembros (contrato §3.2, ADR-0002). */
class WorkspaceService
{
    public const PERSONAL_NAME = 'Mi garaje';

    public function __construct(private readonly ActivityLogger $activity) {}

    /**
     * Espacios del usuario con su rol (pivote) y contadores: primero el personal, luego talleres por nombre.
     *
     * @return \Illuminate\Support\Collection<int, Workspace>
     */
    public function forUser(User $user): \Illuminate\Support\Collection
    {
        return $user->workspaces()
            ->withCount([
                'vehicles' => fn ($q) => $q->whereNull('archived_at'),
                'members',
            ])
            ->get()
            ->sortBy(fn (Workspace $w) => [$w->isPersonal() ? 0 : 1, mb_strtolower($w->name), $w->id])
            ->values();
    }

    public function createPersonal(User $user): Workspace
    {
        return $this->createWithOwner($user, self::PERSONAL_NAME, WorkspaceType::Personal);
    }

    public function createWorkshop(User $user, string $name): Workspace
    {
        return $this->createWithOwner($user, $name, WorkspaceType::Workshop);
    }

    private function createWithOwner(User $user, string $name, WorkspaceType $type): Workspace
    {
        return DB::transaction(function () use ($user, $name, $type) {
            $workspace = Workspace::create([
                'name' => $name,
                'type' => $type,
                'settings' => Workspace::DEFAULT_SETTINGS,
            ]);
            $workspace->members()->attach($user->id, ['role' => WorkspaceRole::Owner->value]);

            return $workspace;
        });
    }

    public function update(Workspace $workspace, array $data): Workspace
    {
        if (array_key_exists('name', $data)) {
            $workspace->name = $data['name'];
        }

        if (! empty($data['settings']) && is_array($data['settings'])) {
            $settings = $workspace->resolvedSettings();

            if (isset($data['settings']['bays_count'])) {
                $bays = (int) $data['settings']['bays_count'];
                $this->ensureBaysAreFree($workspace, $bays);
                $settings['bays_count'] = $bays;
            }
            if (isset($data['settings']['tax_rate'])) {
                $settings['tax_rate'] = (string) $data['settings']['tax_rate'];
            }

            $workspace->settings = $settings;
        }

        $workspace->save();

        return $workspace;
    }

    /** No se puede reducir el número de elevadores si queda una orden abierta en uno que desaparece. */
    private function ensureBaysAreFree(Workspace $workspace, int $bays): void
    {
        $blocking = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->open()
            ->where('bay', '>', $bays)
            ->orderBy('bay')
            ->first();

        if ($blocking) {
            throw new ConflictException("El elevador {$blocking->bay} está ocupado por {$blocking->number}: libéralo antes de reducir los elevadores.");
        }
    }

    /** Solo talleres (409 en el personal). Borra todos sus datos y archivos. */
    public function delete(Workspace $workspace): void
    {
        if ($workspace->isPersonal()) {
            throw new ConflictException('No se puede eliminar tu espacio personal.');
        }

        $this->destroy($workspace);
    }

    /** Borrado físico del espacio, en cascada, más sus archivos privados. */
    public function destroy(Workspace $workspace): void
    {
        $files = Document::query()
            ->whereHas('vehicle', fn ($q) => $q->where('workspace_id', $workspace->id))
            ->get(['disk', 'path']);

        DB::transaction(fn () => $workspace->delete());

        foreach ($files as $file) {
            Storage::disk($file->disk)->delete($file->path);
        }
    }

    // ───────────── Miembros ─────────────

    public function addMember(Workspace $workspace, string $email, WorkspaceRole $role): User
    {
        if ($workspace->isPersonal()) {
            throw new ConflictException('Los espacios personales no admiten más miembros.');
        }

        $user = User::query()->where('email', mb_strtolower($email))->first();
        if (! $user) {
            throw ValidationException::withMessages(['email' => ['No existe ninguna cuenta con ese email.']]);
        }
        if ($user->roleIn($workspace) !== null) {
            throw ValidationException::withMessages(['email' => ['Esa persona ya es miembro del espacio.']]);
        }

        $workspace->members()->attach($user->id, ['role' => $role->value]);

        $this->activity->log($workspace->id, 'member.added', 'member', $user->id,
            ActivityLogger::actor()." añadió a {$user->name} como ".mb_strtolower($role->label()),
            metadata: ['role' => $role->value]);

        return $user;
    }

    public function changeRole(Workspace $workspace, User $actor, User $member, WorkspaceRole $role): void
    {
        $current = $this->roleOrFail($workspace, $member);

        // Dar o quitar el rol de propietario es una capacidad de propietario.
        if (($current === WorkspaceRole::Owner || $role === WorkspaceRole::Owner)
            && $actor->roleIn($workspace) !== WorkspaceRole::Owner) {
            throw new AuthorizationException('No tienes permiso para esta acción.');
        }

        if ($current === WorkspaceRole::Owner && $role !== WorkspaceRole::Owner && $this->ownersCount($workspace) <= 1) {
            throw new ConflictException('No se puede cambiar el rol del último propietario del espacio.');
        }

        if ($current === $role) {
            return;
        }

        $workspace->members()->updateExistingPivot($member->id, ['role' => $role->value]);

        $this->activity->log($workspace->id, 'member.role_changed', 'member', $member->id,
            ActivityLogger::actor()." cambió el rol de {$member->name} a ".mb_strtolower($role->label()),
            metadata: ['from' => $current->value, 'to' => $role->value]);
    }

    public function removeMember(Workspace $workspace, User $actor, User $member): void
    {
        $current = $this->roleOrFail($workspace, $member);

        // Un gerente no puede expulsar a un propietario (salir uno mismo siempre se permite).
        if ($actor->id !== $member->id && $current === WorkspaceRole::Owner
            && $actor->roleIn($workspace) !== WorkspaceRole::Owner) {
            throw new AuthorizationException('No tienes permiso para esta acción.');
        }

        if ($current === WorkspaceRole::Owner && $this->ownersCount($workspace) <= 1) {
            throw new ConflictException('No se puede quitar al último propietario del espacio.');
        }

        DB::table('workspace_user')->where('workspace_id', $workspace->id)->where('user_id', $member->id)->delete();
        // Las órdenes que tenía asignadas quedan sin asignar.
        WorkOrder::query()->where('workspace_id', $workspace->id)->where('assigned_to', $member->id)->update(['assigned_to' => null]);

        $summary = $actor->id === $member->id
            ? "{$member->name} salió del espacio"
            : ActivityLogger::actor()." quitó a {$member->name} del espacio";
        $this->activity->log($workspace->id, 'member.removed', 'member', $member->id, $summary);
    }

    private function roleOrFail(Workspace $workspace, User $member): WorkspaceRole
    {
        return $member->roleIn($workspace) ?? abort(404);
    }

    private function ownersCount(Workspace $workspace): int
    {
        return DB::table('workspace_user')
            ->where('workspace_id', $workspace->id)
            ->where('role', WorkspaceRole::Owner->value)
            ->count();
    }
}
