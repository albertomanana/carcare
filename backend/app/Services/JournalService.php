<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Enums\ReminderStatus;
use App\Models\Expense;
use App\Models\MileageLog;
use App\Models\Vehicle;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Diario día a día de un vehículo (contrato §4, "Diario"): solo días con eventos, descendente.
 *  - km_driven = lectura máxima del día − lectura anterior más reciente (null si falta alguna).
 *  - spent = suma de los gastos del día (incluidos los vinculados a intervenciones).
 *  - Las lecturas generadas por otros datos y los gastos vinculados no se repiten como entradas
 *    propias: ya aparecen en su intervención, gasto u orden.
 */
class JournalService
{
    /** Orden de las entradas dentro de un día. */
    private const TYPE_ORDER = ['record' => 0, 'expense' => 1, 'mileage' => 2, 'reminder_done' => 3, 'document' => 4];

    public function forVehicle(Vehicle $vehicle, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $a = $from->toDateString();
        $b = $to->toDateString();

        $logs = $vehicle->mileageLogs()->oldestFirst()->get();
        $expenses = $vehicle->expenses()->whereBetween('expense_date', [$a, $b])->get();

        $entries = collect()
            ->merge($vehicle->maintenanceRecords()->active()->whereBetween('service_date', [$a, $b])->get()
                ->map(fn ($r) => [
                    'type' => 'record',
                    'id' => $r->id,
                    'date' => $r->service_date->toDateString(),
                    'title' => $r->title,
                    'amount' => $r->total_cost,
                    'mileage' => $r->mileage,
                    'meta' => ['type' => $r->type->value, 'zone' => $r->zone->value, 'service_kind' => $r->service_kind?->value],
                ]))
            ->merge($expenses->reject(fn (Expense $e) => $e->isLinked())
                ->map(fn (Expense $e) => [
                    'type' => 'expense',
                    'id' => $e->id,
                    'date' => $e->expense_date->toDateString(),
                    'title' => $e->description ?: $e->category->label(),
                    'amount' => $e->amount,
                    'mileage' => $e->mileage,
                    'meta' => [
                        'category' => $e->category->value,
                        'fuel_quantity' => $e->fuel_quantity,
                        'fuel_unit' => $e->fuel_unit?->value,
                        'full_tank' => $e->full_tank,
                    ],
                ]))
            ->merge($this->logsBetween($logs, $a, $b)
                ->filter(fn (MileageLog $l) => in_array($l->source, [MileageSource::Manual, MileageSource::VehicleCreated], true))
                ->map(fn (MileageLog $l) => [
                    'type' => 'mileage',
                    'id' => $l->id,
                    'date' => $l->recorded_at->toDateString(),
                    'title' => $l->note ?: 'Lectura de kilometraje',
                    'amount' => null,
                    'mileage' => $l->mileage,
                    'meta' => ['source' => $l->source->value],
                ]))
            ->merge($vehicle->reminders()->where('status', ReminderStatus::Done->value)
                ->whereBetween('completed_at', [$a, $b])->get()
                ->map(fn ($r) => [
                    'type' => 'reminder_done',
                    'id' => $r->id,
                    'date' => $r->completed_at->toDateString(),
                    'title' => $r->title,
                    'amount' => null,
                    'mileage' => $r->completed_mileage,
                    'meta' => ['kind' => $r->kind->value],
                ]))
            ->merge($vehicle->documents()
                ->whereBetween('created_at', [$from->startOfDay(), $to->endOfDay()])->get()
                ->map(fn ($d) => [
                    'type' => 'document',
                    'id' => $d->id,
                    'date' => $d->created_at->toDateString(),
                    'title' => $d->title,
                    'amount' => null,
                    'mileage' => null,
                    'meta' => ['document_type' => $d->document_type->value],
                ]));

        $spentByDay = $expenses->groupBy(fn (Expense $e) => $e->expense_date->toDateString())
            ->map(fn (Collection $day) => $day->sum(fn (Expense $e) => Money::toCents($e->amount)));

        $days = $entries->pluck('date')->merge($spentByDay->keys())->unique()->sortDesc()->values();

        return $days->map(fn (string $date) => [
            'date' => $date,
            'km_driven' => $this->kmDriven($logs, $date),
            'spent' => Money::format((int) ($spentByDay[$date] ?? 0)),
            'entries' => $entries->where('date', $date)
                ->sortBy([
                    fn ($x, $y) => self::TYPE_ORDER[$x['type']] <=> self::TYPE_ORDER[$y['type']],
                    fn ($x, $y) => $x['id'] <=> $y['id'],
                ])
                ->values()
                ->all(),
        ])->all();
    }

    /** Lectura máxima del día − lectura anterior más reciente; null si no hay ambas. */
    private function kmDriven(Collection $logs, string $date): ?int
    {
        $today = $logs->filter(fn (MileageLog $l) => $l->recorded_at->toDateString() === $date);
        $before = $logs->filter(fn (MileageLog $l) => $l->recorded_at->toDateString() < $date)->last();

        if ($today->isEmpty() || $before === null) {
            return null;
        }

        return (int) $today->max('mileage') - $before->mileage;
    }

    private function logsBetween(Collection $logs, string $a, string $b): Collection
    {
        return $logs->filter(function (MileageLog $l) use ($a, $b) {
            $d = $l->recorded_at->toDateString();

            return $d >= $a && $d <= $b;
        });
    }
}
