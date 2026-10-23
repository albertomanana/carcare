<?php

namespace App\Models;

use App\Casts\DateOnly;
use App\Enums\ReminderKind;
use App\Enums\ReminderState;
use App\Enums\ReminderStatus;
use App\Enums\Zone;
use App\Support\Dates;
use Carbon\CarbonImmutable;
use Database\Factories\ReminderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

class Reminder extends Model
{
    /** @use HasFactory<ReminderFactory> */
    use HasFactory;

    /** Umbrales de "próximo" (contrato §3.7). */
    public const SOON_DAYS = 30;

    public const SOON_KM = 1000;

    protected $fillable = [
        'vehicle_id', 'title', 'kind', 'zone', 'notes', 'due_date', 'due_mileage', 'recurrence_months',
        'recurrence_km', 'starts_on', 'start_mileage', 'status', 'completed_at', 'completed_mileage',
    ];

    protected function casts(): array
    {
        return [
            'kind' => ReminderKind::class,
            'zone' => Zone::class,
            'status' => ReminderStatus::class,
            'due_date' => DateOnly::class,
            'due_mileage' => 'integer',
            'recurrence_months' => 'integer',
            'recurrence_km' => 'integer',
            'starts_on' => DateOnly::class,
            'start_mileage' => 'integer',
            'completed_at' => DateOnly::class,
            'completed_mileage' => 'integer',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function isPending(): bool
    {
        return $this->status === ReminderStatus::Pending;
    }

    /**
     * Estado calculado al serializar (no se guarda). Solo para pendientes.
     * Usa el kilometraje actual del vehículo: conviene tener la relación `vehicle` cargada.
     *
     * @return array{state: ?ReminderState, days_left: ?int, km_left: ?int, progress: ?float}
     */
    public function evaluate(?CarbonImmutable $today = null): array
    {
        if (! $this->isPending()) {
            return ['state' => null, 'days_left' => null, 'km_left' => null, 'progress' => null];
        }

        $today ??= CarbonImmutable::today();
        $current = $this->vehicle?->current_mileage;

        $daysLeft = $this->due_date ? Dates::daysBetween($today, $this->due_date) : null;
        $kmLeft = ($this->due_mileage !== null && $current !== null) ? $this->due_mileage - $current : null;

        $state = match (true) {
            ($daysLeft !== null && $daysLeft < 0) || ($kmLeft !== null && $kmLeft < 0) => ReminderState::Overdue,
            ($daysLeft !== null && $daysLeft <= self::SOON_DAYS) || ($kmLeft !== null && $kmLeft <= self::SOON_KM) => ReminderState::Soon,
            $this->due_date === null && $current === null => ReminderState::Unknown,
            default => ReminderState::Ok,
        };

        return [
            'state' => $state,
            'days_left' => $daysLeft,
            'km_left' => $kmLeft,
            'progress' => $this->progress($today, $current),
        ];
    }

    /** Fracción transcurrida según los intervalos del usuario (no es desgaste medido). */
    private function progress(CarbonImmutable $today, ?int $current): ?float
    {
        $ratios = [];

        if ($this->due_date && $this->starts_on) {
            $total = Dates::daysBetween($this->starts_on, $this->due_date);
            if ($total > 0) {
                $ratios[] = Dates::daysBetween($this->starts_on, $today) / $total;
            }
        }

        if ($this->due_mileage !== null && $this->start_mileage !== null && $current !== null) {
            $total = $this->due_mileage - $this->start_mileage;
            if ($total > 0) {
                $ratios[] = ($current - $this->start_mileage) / $total;
            }
        }

        return $ratios === [] ? null : round(max(0, max($ratios)), 4);
    }

    /**
     * Ordena por urgencia: overdue, soon, ok, unknown; luego por fecha y km.
     * Los no pendientes van al final, del más reciente al más antiguo.
     *
     * @param  Collection<int, Reminder>  $reminders
     * @return Collection<int, Reminder>
     */
    public static function sortByUrgency(Collection $reminders): Collection
    {
        return $reminders->sort(function (Reminder $a, Reminder $b) {
            if ($a->isPending() !== $b->isPending()) {
                return $a->isPending() ? -1 : 1;
            }
            if (! $a->isPending()) {
                return strcmp((string) $b->completed_at?->toDateString(), (string) $a->completed_at?->toDateString())
                    ?: $b->id <=> $a->id;
            }

            $sa = $a->evaluate()['state'];
            $sb = $b->evaluate()['state'];

            return $sb->severity() <=> $sa->severity()
                ?: strcmp($a->due_date?->toDateString() ?? '9999-12-31', $b->due_date?->toDateString() ?? '9999-12-31')
                ?: ($a->kmLeftForSorting() <=> $b->kmLeftForSorting())
                ?: $a->id <=> $b->id;
        })->values();
    }

    private function kmLeftForSorting(): int
    {
        return $this->evaluate()['km_left'] ?? PHP_INT_MAX;
    }
}
