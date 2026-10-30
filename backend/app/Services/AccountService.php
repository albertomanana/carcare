<?php

namespace App\Services;

use App\Enums\WorkspaceRole;
use App\Enums\WorkspaceType;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/** Alta y baja de cuentas. */
class AccountService
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    /** Crea el usuario y su espacio personal "Mi garaje"; si es taller, también su espacio de taller. */
    public function register(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => mb_strtolower($data['email']),
                'password' => $data['password'],
                'locale' => 'es',
            ]);

            $this->workspaces->createPersonal($user);

            if (($data['account_type'] ?? null) === WorkspaceType::Workshop->value) {
                $this->workspaces->createWorkshop($user, $data['workshop_name']);
            }

            return $user;
        });
    }

    /** PATCH /me: nombre y/o email (en minúsculas). */
    public function updateProfile(User $user, array $data): User
    {
        if (array_key_exists('email', $data)) {
            $data['email'] = mb_strtolower($data['email']);
        }
        $user->fill(array_intersect_key($data, array_flip(['name', 'email'])))->save();

        return $user;
    }

    /** PUT /me/password: el cast `hashed` del modelo cifra la nueva contraseña. */
    public function updatePassword(User $user, string $password): void
    {
        $user->forceFill(['password' => $password])->save();
    }

    /**
     * Borra la cuenta: su espacio personal (con datos y archivos), los talleres donde es el
     * único propietario, su pertenencia al resto y sus avisos en la app.
     */
    public function delete(User $user): void
    {
        $workspaces = $user->workspaces()->get();

        foreach ($workspaces as $workspace) {
            /** @var Workspace $workspace */
            $isOwner = $workspace->pivot->role === WorkspaceRole::Owner->value;
            $otherOwners = DB::table('workspace_user')
                ->where('workspace_id', $workspace->id)
                ->where('role', WorkspaceRole::Owner->value)
                ->where('user_id', '!=', $user->id)
                ->exists();

            if ($workspace->isPersonal() || ($isOwner && ! $otherOwners)) {
                $this->workspaces->destroy($workspace);
            }
        }

        DB::transaction(function () use ($user) {
            DB::table('workspace_user')->where('user_id', $user->id)->delete();
            // E16 (§3.13.8): la tabla `notifications` es polimórfica y no tiene clave foránea.
            $user->notifications()->delete();
            $user->delete();
        });
    }
}
