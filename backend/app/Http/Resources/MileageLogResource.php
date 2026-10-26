<?php

namespace App\Http\Resources;

use App\Enums\MileageSource;
use Illuminate\Http\Request;

/**
 * Lectura de kilometraje (`MileageLog`). `source_id` es el id del registro que la generó
 * (contrato §3.4.1). Quien no puede ver gastos (rol mechanic en un taller) recibe las lecturas
 * `expense` con `source_id = null`, igual que recibe `revenue: null` en el dashboard.
 *
 * @mixin \App\Models\MileageLog
 */
class MileageLogResource extends ApiResource
{
    /** false ⇒ las lecturas de gastos se devuelven sin `source_id`. */
    public bool $expenseSourceVisible = true;

    /**
     * Colección (o página) de lecturas para un usuario que puede o no ver los gastos del espacio.
     *
     * @param  mixed  $logs  Colección o paginador de MileageLog.
     */
    public static function collectionFor(mixed $logs, bool $expenseSourceVisible): ApiResourceCollection
    {
        $collection = static::collection($logs);
        $collection->collection->each(function (self $resource) use ($expenseSourceVisible) {
            $resource->expenseSourceVisible = $expenseSourceVisible;
        });

        return $collection;
    }

    public function toArray(Request $request): array
    {
        $hideSource = $this->source === MileageSource::Expense && ! $this->expenseSourceVisible;

        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'recorded_at' => self::date($this->recorded_at),
            'mileage' => $this->mileage,
            'source' => $this->source->value,
            'source_id' => $hideSource ? null : $this->source_id,
            'note' => $this->note,
            'created_at' => self::iso($this->created_at),
        ];
    }
}
