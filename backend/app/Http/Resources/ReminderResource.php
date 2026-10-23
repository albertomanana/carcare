<?php

namespace App\Http\Resources;

use App\Models\Reminder;
use Illuminate\Http\Request;

/**
 * Recordatorio con su estado calculado (state, days_left, km_left, progress).
 * `vehicle` (VehicleRef) solo se incluye en agendas y dashboards: ver withVehicle().
 *
 * @mixin Reminder
 */
class ReminderResource extends ApiResource
{
    private bool $includeVehicle = false;

    public function withVehicle(bool $include = true): static
    {
        $this->includeVehicle = $include;

        return $this;
    }

    /** Colección de recordatorios con su VehicleRef (agenda del espacio, dashboards). */
    public static function agenda(iterable $reminders): array
    {
        $items = [];
        foreach ($reminders as $reminder) {
            $items[] = (new static($reminder))->withVehicle();
        }

        return $items;
    }

    public function toArray(Request $request): array
    {
        /** @var Reminder $reminder */
        $reminder = $this->resource;
        $evaluation = $reminder->evaluate();

        $data = [
            'id' => $reminder->id,
            'vehicle_id' => $reminder->vehicle_id,
        ];

        if ($this->includeVehicle) {
            $data['vehicle'] = new VehicleRefResource($reminder->vehicle);
        }

        return $data + [
            'title' => $reminder->title,
            'kind' => $reminder->kind->value,
            'zone' => $reminder->zone->value,
            'notes' => $reminder->notes,
            'due_date' => self::date($reminder->due_date),
            'due_mileage' => $reminder->due_mileage,
            'recurrence_months' => $reminder->recurrence_months,
            'recurrence_km' => $reminder->recurrence_km,
            'starts_on' => self::date($reminder->starts_on),
            'start_mileage' => $reminder->start_mileage,
            'status' => $reminder->status->value,
            'completed_at' => self::date($reminder->completed_at),
            'completed_mileage' => $reminder->completed_mileage,
            'state' => $evaluation['state']?->value,
            'days_left' => $evaluation['days_left'],
            'km_left' => $evaluation['km_left'],
            'progress' => $evaluation['progress'],
            'created_at' => self::iso($reminder->created_at),
        ];
    }
}
