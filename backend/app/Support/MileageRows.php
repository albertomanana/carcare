<?php

namespace App\Support;

use App\Models\Vehicle;
use Illuminate\Support\Collection;

/**
 * Lecturas de km como filas ligeras, acotadas a la ventana de fechas que necesita un cálculo.
 *
 * Devuelve, en el orden canónico ascendente (fecha, km, id), las lecturas entre $from y $to más la
 * última lectura anterior a $from: así "la lectura anterior más reciente" de cualquier día de la
 * ventana sale igual que recorriendo todo el historial, pero el coste no crece con los años de datos.
 */
final class MileageRows
{
    /**
     * @return Collection<int, object{id: int, date: string, mileage: int, source: string, note: ?string}>
     */
    public static function window(Vehicle $vehicle, string $from, string $to): Collection
    {
        $columns = ['id', 'recorded_at', 'mileage', 'source', 'note'];

        $previous = $vehicle->mileageLogs()->where('recorded_at', '<', $from)
            ->latestFirst()->limit(1)->toBase()->get($columns);
        $inWindow = $vehicle->mileageLogs()->whereBetween('recorded_at', [$from, $to])
            ->oldestFirst()->toBase()->get($columns);

        return $previous->concat($inWindow)->map(fn (object $row) => (object) [
            'id' => (int) $row->id,
            'date' => substr((string) $row->recorded_at, 0, 10),
            'mileage' => (int) $row->mileage,
            'source' => (string) $row->source,
            'note' => $row->note,
        ])->values();
    }

    /** Filas con fecha entre $from y $to ('Y-m-d', ambos incluidos), en el mismo orden. */
    public static function between(Collection $rows, string $from, string $to): Collection
    {
        return $rows->filter(fn (object $r) => $r->date >= $from && $r->date <= $to)->values();
    }
}
