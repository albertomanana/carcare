<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Exceptions\ConflictException;
use App\Models\MileageLog;
use App\Models\Vehicle;
use App\Support\Dates;
use App\Support\Km;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Regla de kilometraje (contrato §3.4). Cualquier dato con km (lectura manual, intervención,
 * gasto, orden, recordatorio) genera una lectura con su origen, y el km actual del vehículo
 * es siempre el de la lectura más reciente por fecha (desempate: mayor km).
 */
class MileageService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** Lectura manual desde la API (POST /vehicles/{v}/mileage). */
    public function addManual(Vehicle $vehicle, array $data): MileageLog
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $log = $this->record(
                $vehicle,
                (int) $data['mileage'],
                $data['recorded_at'],
                MileageSource::Manual,
                note: $data['note'] ?? null,
                confirmed: (bool) ($data['confirm_mileage_drop'] ?? false),
            );

            $this->activity->forVehicle($vehicle, 'mileage.recorded', 'mileage_log', $log->id,
                ActivityLogger::actor().' registró '.Km::human($log->mileage).' en '.$vehicle->displayName(),
                ['mileage' => $log->mileage]);

            return $log;
        });
    }

    /** Solo se borran lecturas manuales: las demás se gestionan desde su origen. */
    public function deleteManual(MileageLog $log): void
    {
        if ($log->source !== MileageSource::Manual) {
            throw new ConflictException('Esta lectura se gestiona desde su origen (alta, intervención, gasto, orden o recordatorio).');
        }

        DB::transaction(function () use ($log) {
            $vehicle = $log->vehicle;
            $log->delete();
            $this->recalculate($vehicle);
        });
    }

    public function record(
        Vehicle $vehicle,
        int $mileage,
        string $date,
        MileageSource $source,
        ?int $sourceId = null,
        ?string $note = null,
        bool $confirmed = false,
    ): MileageLog {
        $this->assertConsistent($vehicle, $mileage, $date, $confirmed);

        $log = $vehicle->mileageLogs()->create([
            'recorded_at' => $date,
            'mileage' => $mileage,
            'source' => $source,
            'source_id' => $sourceId,
            'note' => $note,
        ]);

        $this->recalculate($vehicle);

        return $log;
    }

    /**
     * Mantiene la lectura ligada a un origen (intervención, gasto, orden): la crea,
     * la actualiza o la borra si el origen ya no tiene km.
     */
    public function syncForSource(
        Vehicle $vehicle,
        MileageSource $source,
        int $sourceId,
        ?int $mileage,
        ?string $date,
        bool $confirmed = false,
    ): void {
        $existing = MileageLog::query()
            ->where('vehicle_id', $vehicle->id)
            ->where('source', $source->value)
            ->where('source_id', $sourceId)
            ->first();

        if ($mileage === null || $date === null) {
            if ($existing) {
                $existing->delete();
                $this->recalculate($vehicle);
            }

            return;
        }

        if ($existing && $existing->mileage === $mileage && $existing->recorded_at->toDateString() === Dates::ymd($date)) {
            return;
        }

        $this->assertConsistent($vehicle, $mileage, $date, $confirmed, $existing?->id);

        if ($existing) {
            $existing->update(['mileage' => $mileage, 'recorded_at' => $date]);
        } else {
            $vehicle->mileageLogs()->create([
                'recorded_at' => $date,
                'mileage' => $mileage,
                'source' => $source,
                'source_id' => $sourceId,
            ]);
        }

        $this->recalculate($vehicle);
    }

    public function removeForSource(Vehicle $vehicle, MileageSource $source, int $sourceId): void
    {
        $deleted = MileageLog::query()
            ->where('vehicle_id', $vehicle->id)
            ->where('source', $source->value)
            ->where('source_id', $sourceId)
            ->delete();

        if ($deleted > 0) {
            $this->recalculate($vehicle);
        }
    }

    /**
     * 422 si el km es menor que el de una lectura con fecha anterior o igual, o mayor que
     * el de una lectura posterior, salvo confirmación expresa (confirm_mileage_drop).
     */
    public function assertConsistent(Vehicle $vehicle, int $mileage, string $date, bool $confirmed, ?int $ignoreLogId = null): void
    {
        if ($confirmed) {
            return;
        }

        $date = Dates::ymd($date);
        $base = MileageLog::query()
            ->where('vehicle_id', $vehicle->id)
            ->when($ignoreLogId, fn ($q) => $q->whereKeyNot($ignoreLogId));

        $earlier = (clone $base)
            ->where('recorded_at', '<=', $date)
            ->where('mileage', '>', $mileage)
            ->latestFirst()
            ->first();

        if ($earlier) {
            throw ValidationException::withMessages(['mileage' => [sprintf(
                'El kilometraje no cuadra con lecturas anteriores (último: %s el %s). Confírmalo si es correcto.',
                Km::human($earlier->mileage),
                Dates::human($earlier->recorded_at),
            )]]);
        }

        $later = (clone $base)
            ->where('recorded_at', '>', $date)
            ->where('mileage', '<', $mileage)
            ->oldestFirst()
            ->first();

        if ($later) {
            throw ValidationException::withMessages(['mileage' => [sprintf(
                'El kilometraje no cuadra con lecturas posteriores (%s el %s). Confírmalo si es correcto.',
                Km::human($later->mileage),
                Dates::human($later->recorded_at),
            )]]);
        }
    }

    /** current_mileage = lectura más reciente por fecha (desempate: mayor km). */
    public function recalculate(Vehicle $vehicle): void
    {
        $latest = MileageLog::query()->where('vehicle_id', $vehicle->id)->latestFirst()->first();

        $vehicle->forceFill([
            'current_mileage' => $latest?->mileage,
            'mileage_updated_at' => $latest?->recorded_at,
        ])->save();
    }
}
