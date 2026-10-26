<?php

namespace App\Services;

use App\Http\Resources\MaintenanceRecordResource;
use App\Http\Resources\MileageLogResource;
use App\Http\Resources\ReminderResource;
use App\Http\Resources\VehicleResource;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Support\ExpenseRows;
use App\Support\Money;
use DateTimeInterface;

/** Informe exportable del vehículo (historial completo para imprimir o vender el coche). */
class ReportService
{
    /** @param  bool  $expenseSourceVisible  false para quien no ve gastos (mechanic): sus lecturas van sin `source_id`. */
    public function forVehicle(Vehicle $vehicle, bool $expenseSourceVisible = true): array
    {
        // Solo totales: filas ligeras en vez de un modelo por gasto.
        $expenses = ExpenseRows::get($vehicle->expenses()->getQuery());
        $records = $vehicle->maintenanceRecords()->active()->latestFirst()
            ->with(MaintenanceRecordResource::eagerLoad())->withCount('documents')->get();
        $pending = Reminder::sortByUrgency(
            $vehicle->pendingReminders()->get()->each(fn (Reminder $r) => $r->setRelation('vehicle', $vehicle))
        );

        $byYear = $expenses
            ->groupBy('year')
            ->map(fn ($group, $year) => ['year' => (int) $year, 'total' => Money::format(ExpenseRows::sum($group))])
            ->sortKeys()
            ->values()
            ->all();

        return [
            'generated_at' => now()->format(DateTimeInterface::ATOM),
            'vehicle' => new VehicleResource($vehicle),
            'records' => MaintenanceRecordResource::collection($records),
            'expenses' => [
                'total' => Money::format(ExpenseRows::sum($expenses)),
                'by_category' => ExpenseRows::byCategory($expenses),
                'by_year' => $byYear,
            ],
            'mileage_logs' => MileageLogResource::collectionFor($vehicle->mileageLogs()->latestFirst()->get(), $expenseSourceVisible),
            'pending_reminders' => ReminderResource::collection($pending),
            'documents' => $vehicle->documents()->orderByDesc('created_at')->get()->map(fn ($d) => [
                'id' => $d->id,
                'title' => $d->title,
                'document_type' => $d->document_type->value,
                'created_at' => $d->created_at?->format(DateTimeInterface::ATOM),
                'expires_at' => $d->expires_at?->toDateString(),
            ])->all(),
        ];
    }
}
