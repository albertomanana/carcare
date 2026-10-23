<?php

namespace App\Services;

use App\Http\Resources\MaintenanceRecordResource;
use App\Http\Resources\MileageLogResource;
use App\Http\Resources\ReminderResource;
use App\Http\Resources\VehicleResource;
use App\Models\Expense;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Support\Money;
use App\Support\Totals;
use DateTimeInterface;

/** Informe exportable del vehículo (historial completo para imprimir o vender el coche). */
class ReportService
{
    public function forVehicle(Vehicle $vehicle): array
    {
        $expenses = $vehicle->expenses()->get();
        $records = $vehicle->maintenanceRecords()->active()->latestFirst()
            ->with(MaintenanceRecordResource::eagerLoad())->withCount('documents')->get();
        $pending = Reminder::sortByUrgency(
            $vehicle->pendingReminders()->get()->each(fn (Reminder $r) => $r->setRelation('vehicle', $vehicle))
        );

        $byYear = $expenses
            ->groupBy(fn (Expense $e) => (int) $e->expense_date->format('Y'))
            ->map(fn ($group, $year) => ['year' => (int) $year, 'total' => Money::format(Totals::sumCents($group))])
            ->sortKeys()
            ->values()
            ->all();

        return [
            'generated_at' => now()->format(DateTimeInterface::ATOM),
            'vehicle' => new VehicleResource($vehicle),
            'records' => MaintenanceRecordResource::collection($records),
            'expenses' => [
                'total' => Money::format(Totals::sumCents($expenses)),
                'by_category' => Totals::byCategory($expenses),
                'by_year' => $byYear,
            ],
            'mileage_logs' => MileageLogResource::collection($vehicle->mileageLogs()->latestFirst()->get()),
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
