<?php

namespace App\Services;

use App\Enums\ExpenseCategory;
use App\Enums\FuelUnit;
use App\Enums\MileageSource;
use App\Exceptions\ConflictException;
use App\Models\Expense;
use App\Models\Vehicle;
use App\Support\ActivityPhrase;
use App\Support\Money;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    private const FIELDS = [
        'category', 'description', 'amount', 'expense_date', 'mileage', 'fuel_quantity', 'fuel_unit', 'full_tank',
    ];

    public const LINKED_MESSAGE = 'Este gasto se gestiona desde su intervención.';

    public function __construct(
        private readonly MileageService $mileage,
        private readonly ActivityLogger $activity,
    ) {}

    public function create(Vehicle $vehicle, array $data): Expense
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $expense = new Expense(Arr::only($data, self::FIELDS));
            $expense->vehicle()->associate($vehicle);
            $expense->currency = 'EUR';
            $this->normalize($expense, $vehicle, $data);
            $expense->save();

            $this->syncMileage($expense, (bool) ($data['confirm_mileage_drop'] ?? false));

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
