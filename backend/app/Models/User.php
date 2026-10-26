<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use App\Enums\WorkspaceType;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'locale',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
            'password' => 'hashed',
        ];
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_user')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** Correo en español con el enlace a la SPA (contrato §3.1.1). */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function personalWorkspace(): ?Workspace
    {
        return $this->workspaces()->where('type', WorkspaceType::Personal->value)->first();
    }

    /**
     * Rol del usuario en un espacio, o null si no es miembro (las policies responden 404).
     * Sin caché a propósito: los cambios de rol se ven en la siguiente petición.
     */
    public function roleIn(Workspace|int $workspace): ?WorkspaceRole
    {
        $role = DB::table('workspace_user')
            ->where('user_id', $this->getKey())
            ->where('workspace_id', $workspace instanceof Workspace ? $workspace->getKey() : $workspace)
            ->value('role');

        return $role === null ? null : WorkspaceRole::from($role);
    }
}
