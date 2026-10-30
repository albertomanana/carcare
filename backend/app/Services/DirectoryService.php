<?php

namespace App\Services;

use App\Enums\WorkshopService;
use App\Enums\WorkspaceType;
use App\Models\User;
use App\Models\WorkshopProfile;
use App\Models\Workspace;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Directorio de talleres (contrato §3.13.2, ADR‑0007): una proyección pública y optativa del taller.
 * El nombre público es Workspace.name; el resto (ciudad, dirección, teléfono, servicios y horario) lo
 * elige el owner. Solo aparecen los talleres de CarCare con `listed = true`: nada externo ni inventado.
 */
class DirectoryService
{
    private const FIELDS = ['listed', 'city', 'address', 'phone', 'services', 'opening_hours'];

    public function __construct(private readonly ActivityLogger $activity) {}

    /** Perfil del taller. Si el owner nunca lo guardó, uno vacío sin persistir: listed = false, services = []. */
    public function profile(Workspace $workspace): WorkshopProfile
    {
        return $workspace->workshopProfile ?? new WorkshopProfile([
            'workspace_id' => $workspace->id,
            'listed' => false,
            'services' => [],
        ]);
    }

    /**
     * PUT del perfil. Los campos que no llegan se conservan (así "Aparecer en el directorio" se puede
     * apagar sin borrar la ciudad ni el resto). Desactivar `listed` saca al taller del directorio y bloquea
     * las solicitudes nuevas; las abiertas siguen su curso.
     */
    public function update(Workspace $workspace, array $data): WorkshopProfile
    {
        return DB::transaction(function () use ($workspace, $data) {
            // Bloqueo del espacio: dos PUT simultáneos del primer guardado no chocan con la clave única.
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            $profile = WorkshopProfile::query()->where('workspace_id', $workspace->id)->first()
                ?? new WorkshopProfile(['workspace_id' => $workspace->id, 'services' => []]);

            $values = Arr::only($data, self::FIELDS);
            if (array_key_exists('services', $values)) {
                $values['services'] = array_values($values['services'] ?? []);
            }
            $profile->fill($values);
            $profile->services ??= [];
            $profile->listed ??= false;
            $profile->save();

            if ($profile->wasRecentlyCreated || $profile->wasChanged()) {
                $this->activity->log($workspace->id, 'directory_profile.updated', 'directory_profile', $profile->id,
                    ActivityLogger::actor().' actualizó el perfil del directorio');
            }

            $workspace->setRelation('workshopProfile', $profile);

            return $profile;
        });
    }

    /**
     * GET /workshops: talleres con `listed = true`, por nombre ascendente. `search` busca en el nombre o la
     * ciudad (contiene, sin distinguir mayúsculas) y `service` filtra por uno de los servicios anunciados.
     * Cada fila lleva `is_member` para el usuario que pregunta.
     */
    public function search(User $user, ?string $search, ?WorkshopService $service, int $perPage): LengthAwarePaginator
    {
        $like = $search === null || $search === '' ? null : '%'.mb_strtolower($search).'%';

        return Workspace::query()
            ->where('type', WorkspaceType::Workshop->value)
            ->whereHas('workshopProfile', fn (Builder $q) => $q->where('listed', true)->whereNotNull('city')
                // Los servicios se guardan como lista JSON de literales del enum: '["tyres","brakes"]'.
                ->when($service, fn (Builder $s) => $s->where('services', 'like', '%"'.$service->value.'"%')))
            ->when($like, fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereRaw('LOWER(name) LIKE ?', [$like])
                ->orWhereHas('workshopProfile', fn (Builder $p) => $p->whereRaw('LOWER(city) LIKE ?', [$like]))))
            ->with('workshopProfile')
            ->withExists(['members as is_member' => fn (Builder $q) => $q->where('users.id', $user->id)])
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($perPage);
    }

    /** Ficha de un taller del directorio (la policy ya comprobó que está en él). */
    public function show(User $user, Workspace $workshop): Workspace
    {
        $workshop->loadMissing('workshopProfile');
        $workshop->setAttribute('is_member', $user->roleIn($workshop) !== null);

        return $workshop;
    }
}
