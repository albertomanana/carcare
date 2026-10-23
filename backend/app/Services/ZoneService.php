<?php

namespace App\Services;

use App\Enums\ReminderState;
use App\Enums\Zone;
use App\Http\Resources\MaintenanceRecordRefResource;
use App\Http\Resources\ReminderResource;
use App\Models\Reminder;
use App\Models\Vehicle;

/**
 * Estado de las 10 zonas del vehículo (alimenta el mapa 3D, contrato §3.8).
 * Es el estado SEGÚN LOS INTERVALOS DEL USUARIO, no un desgaste medido.
 */
class ZoneService
{
    /** @return list<array<string, mixed>> */
    public function forVehicle(Vehicle $vehicle): array
    {
        $pending = $vehicle->pendingReminders()->get()->each(fn (Reminder $r) => $r->setRelation('vehicle', $vehicle));
        $records = $vehicle->maintenanceRecords()->active()->latestFirst()->get();

        $zones = [];
        foreach (Zone::cases() as $zone) {
            $reminders = Reminder::sortByUrgency($pending->filter(fn (Reminder $r) => $r->zone === $zone));
            $zoneRecords = $records->filter(fn ($r) => $r->zone === $zone)->values();

            if ($reminders->isNotEmpty()) {
                $state = $reminders
                    ->map(fn (Reminder $r) => $r->evaluate()['state'])
                    ->sortByDesc(fn (ReminderState $s) => $s->severity())
                    ->first();
                $basis = 'reminders';
            } else {
                $state = ReminderState::Unknown;
                $basis = $zoneRecords->isNotEmpty() ? 'records' : 'none';
            }

            $zones[] = [
                'zone' => $zone->value,
                'label' => $zone->label(),
                'state' => $state->value,
                'basis' => $basis,
                'last_record' => $zoneRecords->first() ? new MaintenanceRecordRefResource($zoneRecords->first()) : null,
                'records_count' => $zoneRecords->count(),
                'next_reminder' => $reminders->first() ? new ReminderResource($reminders->first()) : null,
            ];
        }

        return $zones;
    }
}
