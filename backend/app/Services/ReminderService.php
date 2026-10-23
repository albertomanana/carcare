<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Enums\ReminderKind;
use App\Enums\ReminderStatus;
use App\Exceptions\ConflictException;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Support\Dates;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Recordatorios y vencimientos (contrato §3.7). El estado (overdue/soon/ok/unknown) y el
 * progreso se calculan al serializar (Reminder::evaluate); aquí van las transiciones.
 */
class ReminderService
{
    private const FIELDS = [
        'title', 'kind', 'zone', 'notes', 'due_date', 'due_mileage', 'recurrence_months', 'recurrence_km',
    ];

    public function __construct(
        private readonly MileageService $mileage,
        private readonly ActivityLogger $activity,
    ) {}

    public function create(Vehicle $vehicle, array $data): Reminder
    {
        $reminder = new Reminder(Arr::only($data, self::FIELDS));
        $reminder->vehicle()->associate($vehicle);
        $reminder->zone ??= ReminderKind::from($data['kind'])->defaultZone();
        $reminder->status = ReminderStatus::Pending;
        $reminder->starts_on = today();
        $reminder->start_mileage = $vehicle->current_mileage;
        $reminder->save();

        $this->activity->forVehicle($vehicle, 'reminder.created', 'reminder', $reminder->id,
            ActivityLogger::actor()." creó el recordatorio «{$reminder->title}» para ".$vehicle->displayName());

        return $reminder->refresh();
    }

    public function update(Reminder $reminder, array $data): Reminder
    {
        $reminder->fill(Arr::only($data, self::FIELDS));

        // Si cambia el tipo y no se indica zona, se recoloca en la zona por defecto del nuevo tipo.
        if ($reminder->isDirty('kind') && ! array_key_exists('zone', $data)) {
            $reminder->zone = $reminder->kind->defaultZone();
        }

        if ($reminder->due_date === null && $reminder->due_mileage === null) {
            throw ValidationException::withMessages([
                'due_date' => ['Indica una fecha límite o un kilometraje límite.'],
            ]);
        }

        $reminder->save();

        return $reminder;
    }

    public function delete(Reminder $reminder): void
    {
        $reminder->delete();
    }

    /**
     * Marca como hecho y, si hay recurrencia (y create_next ≠ false), crea el siguiente
     * contando desde la fecha y el km en que se completó.
     *
     * @return array{completed: Reminder, next: ?Reminder}
     */
    public function complete(Reminder $reminder, array $data): array
    {
        $this->ensurePending($reminder);

        return DB::transaction(function () use ($reminder, $data) {
            $vehicle = $reminder->vehicle;
            $completedAt = $data['completed_at'];
            $mileage = isset($data['mileage']) ? (int) $data['mileage'] : null;

            if ($mileage !== null) {
                $this->mileage->record($vehicle, $mileage, $completedAt, MileageSource::Reminder, $reminder->id,
                    confirmed: (bool) ($data['confirm_mileage_drop'] ?? false));
                $vehicle->refresh();
            }

            $reminder->forceFill([
                'status' => ReminderStatus::Done,
                'completed_at' => $completedAt,
                'completed_mileage' => $mileage,
            ])->save();

            $next = null;
            $hasRecurrence = $reminder->recurrence_months || $reminder->recurrence_km;
            if ($hasRecurrence && ($data['create_next'] ?? true) !== false) {
                $next = $this->createNext($reminder, $vehicle);
            }

            $this->activity->forVehicle($vehicle, 'reminder.completed', 'reminder', $reminder->id,
                ActivityLogger::actor()." completó el recordatorio «{$reminder->title}» de ".$vehicle->displayName(),
                ['next_id' => $next?->id]);

            return ['completed' => $reminder->refresh(), 'next' => $next?->refresh()];
        });
    }

    public function dismiss(Reminder $reminder): Reminder
    {
        $this->ensurePending($reminder);

        $reminder->forceFill(['status' => ReminderStatus::Dismissed])->save();

        $this->activity->forVehicle($reminder->vehicle, 'reminder.dismissed', 'reminder', $reminder->id,
            ActivityLogger::actor()." descartó el recordatorio «{$reminder->title}» de ".$reminder->vehicle->displayName());

        return $reminder;
    }

    private function createNext(Reminder $done, Vehicle $vehicle): ?Reminder
    {
        $startMileage = $done->completed_mileage ?? $vehicle->current_mileage;
        $dueDate = $done->recurrence_months
            ? Dates::date($done->completed_at)->addMonthsNoOverflow($done->recurrence_months)
            : null;
        $dueMileage = ($done->recurrence_km && $startMileage !== null) ? $startMileage + $done->recurrence_km : null;

        // Sin fecha ni km límite no hay recordatorio válido que crear.
        if ($dueDate === null && $dueMileage === null) {
            return null;
        }

        return Reminder::create([
            'vehicle_id' => $vehicle->id,
            'title' => $done->title,
            'kind' => $done->kind,
            'zone' => $done->zone,
            'notes' => $done->notes,
            'due_date' => $dueDate,
            'due_mileage' => $dueMileage,
            'recurrence_months' => $done->recurrence_months,
            'recurrence_km' => $done->recurrence_km,
            'starts_on' => $done->completed_at,
            'start_mileage' => $startMileage,
            'status' => ReminderStatus::Pending,
        ]);
    }

    private function ensurePending(Reminder $reminder): void
    {
        if (! $reminder->isPending()) {
            throw new ConflictException('Este recordatorio ya no está pendiente.');
        }
    }
}
