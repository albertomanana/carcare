<?php

namespace App\Services;

use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
use App\Enums\ReminderState;
use App\Enums\ServiceKind;
use App\Http\Resources\MaintenanceRecordRefResource;
use App\Http\Resources\ReminderResource;
use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\MileageLog;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Support\Dates;
use App\Support\Money;
use App\Support\Totals;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Resumen y analítica de un vehículo con las definiciones exactas del contrato §4.
 * Si falta un dato para una cifra, se devuelve null o `available: false` con el motivo.
 */
class SummaryService
{
    public const COST_PER_KM_REASON = 'Necesitas al menos dos lecturas de kilometraje separadas 30 días y 500 km en este periodo.';

    public const CONSUMPTION_REASON = 'Necesitas al menos dos repostajes con el depósito lleno y el kilometraje anotado en este periodo.';

    private const MIN_KM = 500;

    private const MIN_DAYS = 30;

    public function forVehicle(Vehicle $vehicle, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $today = CarbonImmutable::today();
        $expenses = $vehicle->expenses()->orderBy('expense_date')->orderBy('id')->get();
        $logs = $vehicle->mileageLogs()->oldestFirst()->get();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => $this->totals($expenses, $from, $to),
            'by_category' => Totals::byCategory($this->between($expenses, $from, $to)),
            'by_month' => Totals::byMonth(
                $expenses,
                Dates::months($to->startOfMonth()->subMonths(11), $to),
                fn (Expense $e) => $e->expense_date->format('Y-m'),
            ),
            'cost_per_km' => $this->costPerKm($expenses, $logs, $from, $to),
            'consumption' => $this->consumption($expenses, $from, $to),
            'mileage' => [
                'current' => $vehicle->current_mileage,
                'updated_at' => $vehicle->mileage_updated_at?->toDateString(),
                'km_this_month' => $this->kmInPeriod($logs, $to->startOfMonth(), $to->endOfMonth()),
                'km_this_year' => $this->kmInPeriod($logs, $to->startOfYear(), $to->endOfYear()),
                'avg_daily_km' => $this->avgDailyKm($logs, $to),
                'series' => $this->series($logs, $to->subMonths(12), $to),
            ],
            'records' => $this->records($vehicle),
            'since_last' => $this->sinceLast($vehicle, $today),
            'reminders' => $this->reminders($vehicle),
        ];
    }

    /** @param  Collection<int, Expense>  $expenses */
    private function between(Collection $expenses, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $a = $from->toDateString();
        $b = $to->toDateString();

        return $expenses->filter(function (Expense $e) use ($a, $b) {
            $d = $e->expense_date->toDateString();

            return $d >= $a && $d <= $b;
        })->values();
    }

    private function totals(Collection $expenses, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $period = Totals::sumCents($this->between($expenses, $from, $to));

        // Periodo inmediatamente anterior de la misma duración.
        $days = Dates::daysBetween($from, $to) + 1;
        $prevTo = $from->subDay();
        $prevFrom = $prevTo->subDays($days - 1);
        $previousExpenses = $this->between($expenses, $prevFrom, $prevTo);
        $previous = $previousExpenses->isEmpty() ? null : Totals::sumCents($previousExpenses);

        return [
            'period' => Money::format($period),
            'month' => Money::format(Totals::sumCents($this->between($expenses, $to->startOfMonth(), $to->endOfMonth()))),
            'year' => Money::format(Totals::sumCents($this->between($expenses, $to->startOfYear(), $to->endOfYear()))),
            'previous_period' => $previous === null ? null : Money::format($previous),
            'change_pct' => ($previous === null || $previous === 0) ? null : round(($period - $previous) / $previous * 100, 1),
        ];
    }

    /**
     * Coste por km: ≥ 2 lecturas en el periodo separadas ≥ 500 km y ≥ 30 días.
     * km = máx − mín de las lecturas del periodo; valor = total del periodo / km.
     */
    private function costPerKm(Collection $expenses, Collection $logs, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $inPeriod = $this->logsBetween($logs, $from, $to);
        $unavailable = ['available' => false, 'reason' => self::COST_PER_KM_REASON, 'value' => null, 'km' => null];

        if ($inPeriod->count() < 2) {
            return $unavailable;
        }

        $km = $inPeriod->max('mileage') - $inPeriod->min('mileage');
        $days = Dates::daysBetween($inPeriod->first()->recorded_at, $inPeriod->last()->recorded_at);
        if ($km < self::MIN_KM || $days < self::MIN_DAYS) {
            return $unavailable;
        }

        $cents = Totals::sumCents($this->between($expenses, $from, $to));

        return [
            'available' => true,
            'reason' => null,
            'value' => Money::format(intdiv($cents * 2 + $km, $km * 2)), // céntimos/km, redondeo half-up
            'km' => $km,
        ];
    }

    /**
     * Consumo por el método lleno-a-lleno: entre dos repostajes consecutivos con depósito lleno
     * y km, cantidad repostada después del primero hasta el segundo (incluido) / km × 100.
     * Media ponderada de los tramos del periodo, en la unidad predominante.
     */
    private function consumption(Collection $expenses, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $fuel = $this->between($expenses, $from, $to)
            ->filter(fn (Expense $e) => $e->category === ExpenseCategory::Fuel && $e->fuel_quantity !== null);

        $unit = $fuel->countBy(fn (Expense $e) => ($e->fuel_unit ?? FuelUnit::L)->value)->sortDesc()->keys()->first();
        $fuel = $fuel
            ->filter(fn (Expense $e) => ($e->fuel_unit ?? FuelUnit::L)->value === $unit)
            ->sortBy([
                fn (Expense $a, Expense $b) => strcmp($a->expense_date->toDateString(), $b->expense_date->toDateString()),
                fn (Expense $a, Expense $b) => ($a->mileage ?? 0) <=> ($b->mileage ?? 0),
                fn (Expense $a, Expense $b) => $a->id <=> $b->id,
            ])
            ->values();

        $fills = $fuel->filter(fn (Expense $e) => $e->full_tank && $e->mileage !== null)->count();

        $quantity = 0; // centésimas de unidad
        $km = 0;
        $previousFull = null;
        $accumulated = 0;
        foreach ($fuel as $expense) {
            if ($previousFull !== null) {
                $accumulated += Money::toCents($expense->fuel_quantity);
            }
            if ($expense->full_tank && $expense->mileage !== null) {
                if ($previousFull !== null && $expense->mileage > $previousFull->mileage) {
                    $quantity += $accumulated;
                    $km += $expense->mileage - $previousFull->mileage;
                }
                $previousFull = $expense;
                $accumulated = 0;
            }
        }

        if ($fills < 2 || $km <= 0) {
            return ['available' => false, 'reason' => self::CONSUMPTION_REASON, 'value' => null, 'unit' => null, 'fills' => $fills];
        }

        return [
            'available' => true,
            'reason' => null,
            // (centésimas / 100) / km × 100 = centésimas / km
            'value' => number_format($quantity / $km, 2, '.', ''),
            'unit' => $unit.'/100km',
            'fills' => $fills,
        ];
    }

    /**
     * Km recorridos en un periodo: última lectura del periodo − última anterior al inicio
     * (o la primera del periodo si no hay anterior). null si no hay dos lecturas.
     */
    public function kmInPeriod(Collection $logs, CarbonImmutable $start, CarbonImmutable $end): ?int
    {
        $inPeriod = $this->logsBetween($logs, $start, $end);
        if ($inPeriod->isEmpty()) {
            return null;
        }

        $startDate = $start->toDateString();
        $base = $logs->filter(fn (MileageLog $l) => $l->recorded_at->toDateString() < $startDate)->last()
            ?? $inPeriod->first();
        $last = $inPeriod->last();

        return $base->id === $last->id ? null : $last->mileage - $base->mileage;
    }

    /** (km última − km primera) / días entre ambas, sobre los últimos 90 días. */
    private function avgDailyKm(Collection $logs, CarbonImmutable $to): ?float
    {
        $window = $this->logsBetween($logs, $to->subDays(90), $to);
        if ($window->count() < 2) {
            return null;
        }

        $days = Dates::daysBetween($window->first()->recorded_at, $window->last()->recorded_at);
        if ($days < 7) {
            return null;
        }

        return round(($window->last()->mileage - $window->first()->mileage) / $days, 1);
    }

    /** Lecturas de los últimos 12 meses, ascendente (una por día: la mayor). */
    private function series(Collection $logs, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->logsBetween($logs, $from, $to)
            ->groupBy(fn (MileageLog $l) => $l->recorded_at->toDateString())
            ->map(fn (Collection $day, string $date) => ['date' => $date, 'mileage' => (int) $day->max('mileage')])
            ->values()
            ->all();
    }

    private function records(Vehicle $vehicle): array
    {
        $records = $vehicle->maintenanceRecords()->active()->latestFirst()->get();

        return [
            'count' => $records->count(),
            'last' => $records->first() ? new MaintenanceRecordRefResource($records->first()) : null,
            'recent' => MaintenanceRecordRefResource::collection($records->take(5)),
        ];
    }

    /** Desde el último cambio de aceite, revisión e ITV (intervenciones no archivadas). */
    private function sinceLast(Vehicle $vehicle, CarbonImmutable $today): array
    {
        $result = [];
        foreach ([ServiceKind::Oil, ServiceKind::Service, ServiceKind::Itv] as $kind) {
            /** @var MaintenanceRecord|null $record */
            $record = $vehicle->maintenanceRecords()->active()->where('service_kind', $kind->value)->latestFirst()->first();

            $result[] = [
                'kind' => $kind->value,
                'label' => $kind->label(),
                'record' => $record ? new MaintenanceRecordRefResource($record) : null,
                'days' => $record ? Dates::daysBetween($record->service_date, $today) : null,
                'km' => ($record && $record->mileage !== null && $vehicle->current_mileage !== null)
                    ? $vehicle->current_mileage - $record->mileage
                    : null,
            ];
        }

        return $result;
    }

    private function reminders(Vehicle $vehicle): array
    {
        $pending = Reminder::sortByUrgency(
            $vehicle->pendingReminders()->get()->each(fn (Reminder $r) => $r->setRelation('vehicle', $vehicle))
        );
        $states = $pending->map(fn (Reminder $r) => $r->evaluate()['state']);

        return [
            'overdue' => $states->filter(fn ($s) => $s === ReminderState::Overdue)->count(),
            'soon' => $states->filter(fn ($s) => $s === ReminderState::Soon)->count(),
            'upcoming' => ReminderResource::collection($pending->take(5)),
        ];
    }

    /** @param  Collection<int, MileageLog>  $logs  ordenadas ascendente */
    private function logsBetween(Collection $logs, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $a = $from->toDateString();
        $b = $to->toDateString();

        return $logs->filter(function (MileageLog $l) use ($a, $b) {
            $d = $l->recorded_at->toDateString();

            return $d >= $a && $d <= $b;
        })->values();
    }
}
