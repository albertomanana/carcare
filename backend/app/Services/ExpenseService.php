<?php

namespace App\Services;

use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
use App\Enums\MileageSource;
use App\Exceptions\ConflictException;
use App\Models\Expense;
use App\Models\MaintenanceRecord;
use App\Models\Reminder;
use App\Models\Vehicle;
use App\Support\ActivityPhrase;
use App\Support\Money;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExpenseService
{
    private const FIELDS = [
        'category', 'description', 'amount', 'expense_date', 'mileage', 'fuel_quantity', 'fuel_unit', 'full_tank',
        'recurrence_months',
    ];

    public const LINKED_MESSAGE = 'Este gasto se gestiona desde su intervención.';

    public function __construct(
        private readonly MileageService $mileage,
        private readonly ActivityLogger $activity,
        private readonly MaintenanceService $maintenance,
        private readonly ReminderService $reminders,
    ) {}

    public function create(Vehicle $vehicle, array $data): Expense
    {
        if (isset($data['maintenance_record_id']) || isset($data['record'])) {
            return $this->createThroughRecord($vehicle, $data);
        }

        return DB::transaction(function () use ($vehicle, $data) {
            $expense = new Expense(Arr::only($data, self::FIELDS));
            $expense->vehicle()->associate($vehicle);
            $expense->currency = 'EUR';
            $this->normalize($expense, $vehicle, $data);
            $expense->save();

            $this->syncMileage($expense, (bool) ($data['confirm_mileage_drop'] ?? false));
            $this->syncRenewal($expense, $data);

            $this->activity->forVehicle($vehicle, 'expense.created', 'expense', $expense->id,
                ActivityPhrase::of('añadió', 'añadiste', 'un gasto de '.Money::human($expense->amount)
                    ." ({$expense->category->label()}) en ".$vehicle->displayName()),
                ['category' => $expense->category->value, 'amount' => $expense->amount]);

            return $expense->refresh();
        });
    }

    public function update(Expense $expense, array $data): Expense
    {
        $this->ensureNotLinked($expense);

        return DB::transaction(function () use ($expense, $data) {
            $expense->fill(Arr::only($data, self::FIELDS));
            $this->normalize($expense, $expense->vehicle, $data);
            $expense->save();

            $this->syncMileage($expense, (bool) ($data['confirm_mileage_drop'] ?? false));
            $this->syncRenewal($expense, $data);

            $this->activity->forVehicle($expense->vehicle, 'expense.updated', 'expense', $expense->id,
                ActivityPhrase::of('editó', 'editaste', 'un gasto de '.Money::human($expense->amount)
                    ." ({$expense->category->label()}) en ".$expense->vehicle->displayName()));

            return $expense->refresh();
        });
    }

    public function delete(Expense $expense): void
    {
        $this->ensureNotLinked($expense);

        DB::transaction(function () use ($expense) {
            $vehicle = $expense->vehicle;
            $this->mileage->removeForSource($vehicle, MileageSource::Expense, $expense->id);
            $expense->delete();

            $this->activity->forVehicle($vehicle, 'expense.deleted', 'expense', $expense->id,
                ActivityPhrase::of('eliminó', 'eliminaste', 'un gasto de '.Money::human($expense->amount)
                    ." ({$expense->category->label()}) de ".$vehicle->displayName()));
        });
    }

    /**
     * Reparaciones, mantenimientos y modificaciones (§3.6.1): el gasto se asocia a una intervención que aún no tenía
     * coste (`maintenance_record_id`) o crea la intervención en el mismo paso (`record`). En los dos casos el gasto pasa
     * a gestionarlo la intervención (D3-A): hay un solo apunte, nunca dos.
     */
    private function createThroughRecord(Vehicle $vehicle, array $data): Expense
    {
        if (! $vehicle->workspace->isPersonal()) {
            throw ValidationException::withMessages(['record' => ['En un taller los gastos no se asocian a intervenciones.']]);
        }

        return DB::transaction(function () use ($vehicle, $data) {
            $amount = Money::normalize($data['amount']);

            if (isset($data['maintenance_record_id'])) {
                $record = MaintenanceRecord::query()->where('vehicle_id', $vehicle->id)->active()->find($data['maintenance_record_id']);
                if ($record === null) {
                    throw ValidationException::withMessages(['maintenance_record_id' => ['Esa intervención no es de este vehículo.']]);
                }
                if (Money::toCents($record->total_cost) > 0) {
                    throw new ConflictException('Esa intervención ya tiene su gasto.');
                }
                $record = $this->maintenance->update($record, ['total_cost' => $amount]);
            } else {
                $category = ExpenseCategory::from($data['category']);
                $record = $this->maintenance->create($vehicle, [
                    'type' => $data['record']['type'] ?? $category->recordType()->value,
                    'zone' => $data['record']['zone'] ?? 'general',
                    'title' => $data['record']['title'],
                    'description' => $data['description'] ?? null,
                    'workshop_name' => $data['record']['workshop_name'] ?? null,
                    'service_date' => $data['expense_date'],
                    'mileage' => $data['mileage'] ?? null,
                    'total_cost' => $amount,
                    'confirm_mileage_drop' => (bool) ($data['confirm_mileage_drop'] ?? false),
                ]);
            }

            return Expense::query()->where('maintenance_record_id', $record->id)->firstOrFail();
        });
    }

    /**
     * Gasto periódico (§3.6.1): la próxima renovación es un recordatorio, no un gasto futuro (el dinero aún no se ha
     * pagado). Si el vehículo ya tiene pendiente uno del mismo tipo (seguro, impuesto) se reutiliza; si no, se crea.
     * Al quitar la periodicidad el gasto se suelta del recordatorio, que sigue siendo del usuario.
     */
    private function syncRenewal(Expense $expense, array $data): void
    {
        // Sin periodicidad (se quitó, o la categoría ya no la admite): el gasto se suelta de su recordatorio
        if ($expense->recurrence_months === null) {
            if ($expense->reminder_id !== null) {
                $expense->reminder_id = null;
                $expense->save();
            }

            return;
        }

        if (! array_key_exists('recurrence_months', $data) && ! array_key_exists('next_due_date', $data)) {
            return;
        }

        $due = $data['next_due_date'] ?? $expense->expense_date->addMonthsNoOverflow($expense->recurrence_months)->toDateString();
        if ($due <= $expense->expense_date->toDateString()) {
            throw ValidationException::withMessages(['next_due_date' => ['La próxima renovación tiene que ser posterior a la fecha del gasto.']]);
        }

        $vehicle = $expense->vehicle;
        $kind = $expense->category->reminderKind();
        $title = match ($expense->category) {
            ExpenseCategory::Insurance => 'Renovar el seguro',
            ExpenseCategory::Tax => 'Impuesto de circulación',
            ExpenseCategory::Parking => 'Renovar el aparcamiento',
            default => 'Renovar: '.mb_substr($expense->description ?: 'cuota', 0, 100),
        };

        $pending = Reminder::query()->where('vehicle_id', $vehicle->id)->where('status', 'pending');
        $reminder = ($expense->reminder_id !== null ? (clone $pending)->find($expense->reminder_id) : null)
            ?? ($kind->value === 'custom'
                ? (clone $pending)->where('kind', 'custom')->where('title', $title)->first()
                : (clone $pending)->where('kind', $kind->value)->orderBy('due_date')->first());

        $reminder = $reminder !== null
            ? $this->reminders->update($reminder, ['due_date' => $due, 'recurrence_months' => $expense->recurrence_months])
            : $this->reminders->create($vehicle, ['title' => $title, 'kind' => $kind->value, 'due_date' => $due, 'recurrence_months' => $expense->recurrence_months]);

        $expense->reminder_id = $reminder->id;
        $expense->save();
    }

    private function ensureNotLinked(Expense $expense): void
    {
        if ($expense->isLinked()) {
            throw new ConflictException(self::LINKED_MESSAGE);
        }
    }

    /** Los datos de repostaje solo tienen sentido en combustible; si no, se guardan null. */
    private function normalize(Expense $expense, Vehicle $vehicle, array $data): void
    {
        $expense->amount = Money::normalize($expense->amount);
        if (! $expense->category->isRecurring()) {
            $expense->recurrence_months = null;
        }

        if ($expense->category !== ExpenseCategory::Fuel) {
            $expense->fuel_quantity = null;
            $expense->fuel_unit = null;
            $expense->full_tank = null;

            return;
        }

        $expense->fuel_quantity = Money::normalize($expense->fuel_quantity);
        if ($expense->fuel_unit === null) {
            $expense->fuel_unit = $vehicle->isElectric() ? FuelUnit::Kwh : FuelUnit::L;
        }
    }

    private function syncMileage(Expense $expense, bool $confirmed): void
    {
        $this->mileage->syncForSource(
            $expense->vehicle,
            MileageSource::Expense,
            $expense->id,
            $expense->mileage,
            $expense->expense_date?->toDateString(),
            $confirmed,
        );
    }
}
