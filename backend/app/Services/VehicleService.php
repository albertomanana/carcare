<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Exceptions\ConflictException;
use App\Models\Document;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Support\ActivityPhrase;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class VehicleService
{
    public function __construct(
        private readonly MileageService $mileage,
        private readonly ActivityLogger $activity,
    ) {}

    public function create(Workspace $workspace, array $data): Vehicle
    {
        return DB::transaction(function () use ($workspace, $data) {
            $vehicle = new Vehicle(Arr::except($data, ['current_mileage', 'mileage_updated_at', 'archived_at']));
            $vehicle->workspace()->associate($workspace);
            $vehicle->save();

            // El km inicial es la primera lectura del vehículo.
            if (isset($data['current_mileage'])) {
                $this->mileage->record($vehicle, (int) $data['current_mileage'], today()->toDateString(), MileageSource::VehicleCreated, $vehicle->id);
            }

            $this->activity->forVehicle($vehicle, 'vehicle.created', 'vehicle', $vehicle->id,
                ActivityPhrase::of('añadió', 'añadiste', 'el vehículo '.$vehicle->displayName()));

            return $vehicle->refresh();
        });
    }

    /** current_mileage no se edita aquí: se usa /mileage (contrato §3.3). */
    public function update(Vehicle $vehicle, array $data): Vehicle
    {
        $vehicle->fill(Arr::except($data, ['current_mileage', 'mileage_updated_at', 'archived_at', 'workspace_id']));

        if ($vehicle->isDirty()) {
            $vehicle->save();
            $this->activity->forVehicle($vehicle, 'vehicle.updated', 'vehicle', $vehicle->id,
                ActivityPhrase::of('editó', 'editaste', 'el vehículo '.$vehicle->displayName()),
                ['fields' => array_keys($vehicle->getChanges())]);
        }

        return $vehicle;
    }

    public function archive(Vehicle $vehicle): Vehicle
    {
        if (! $vehicle->isArchived()) {
            $vehicle->forceFill(['archived_at' => now()])->save();
            $this->activity->forVehicle($vehicle, 'vehicle.archived', 'vehicle', $vehicle->id,
                ActivityPhrase::of('archivó', 'archivaste', 'el vehículo '.$vehicle->displayName()));
        }

        return $vehicle;
    }

    public function restore(Vehicle $vehicle): Vehicle
    {
        if (! $vehicle->isArchived()) {
            return $vehicle;
        }

        // La matrícula es única entre los vehículos activos del espacio.
        if ($vehicle->plate && Vehicle::query()
            ->where('workspace_id', $vehicle->workspace_id)
            ->whereNull('archived_at')
            ->where('plate', $vehicle->plate)
            ->exists()) {
            throw new ConflictException("Ya hay un vehículo activo con la matrícula {$vehicle->plate}.");
        }

        $vehicle->forceFill(['archived_at' => null])->save();
        $this->activity->forVehicle($vehicle, 'vehicle.restored', 'vehicle', $vehicle->id,
            ActivityPhrase::of('restauró', 'restauraste', 'el vehículo '.$vehicle->displayName()));

        return $vehicle;
    }

    /** Solo vehículos archivados. Borra en cascada su historial y sus archivos. */
    public function delete(Vehicle $vehicle): void
    {
        if (! $vehicle->isArchived()) {
            throw new ConflictException('Archiva el vehículo antes de eliminarlo.');
        }

        $files = $vehicle->documents()->get(['disk', 'path']);

        DB::transaction(function () use ($vehicle) {
            $this->activity->log($vehicle->workspace_id, 'vehicle.deleted', 'vehicle', $vehicle->id,
                ActivityPhrase::of('eliminó', 'eliminaste', 'el vehículo '.$vehicle->displayName()));
            $vehicle->delete();
        });

        $this->deleteFiles($files);
    }

    /** @param  iterable<Document>  $documents */
    public function deleteFiles(iterable $documents): void
    {
        foreach ($documents as $document) {
            Storage::disk($document->disk)->delete($document->path);
        }
    }
}
