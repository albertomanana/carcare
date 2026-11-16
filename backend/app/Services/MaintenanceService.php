<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Enums\RecordType;
use App\Enums\Zone;
use App\Models\Expense;
use App\Enums\ItemKind;
use App\Models\MaintenanceRecord;
use App\Models\RepairRequest;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Support\ActivityPhrase;
use App\Support\LineItems;
use App\Support\Money;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Intervenciones (mantenimiento, reparaciones, averías…) con sus líneas.
 * D3-A: en espacios personales una intervención con coste mantiene un gasto vinculado
 * en la misma transacción, para que los totales (que salen solo de `expenses`) no cuenten dos veces.
 */
class MaintenanceService
{
    private const FIELDS = [
        'type', 'zone', 'service_kind', 'title', 'description', 'service_date', 'mileage',
        'workshop_name', 'parts_cost', 'labor_cost', 'total_cost',
    ];

    public function __construct(
        private readonly MileageService $mileage,
        private readonly ActivityLogger $activity,
    ) {}

    public function create(Vehicle $vehicle, array $data): MaintenanceRecord
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $rows = LineItems::rows($data['items'] ?? []);

            $record = new MaintenanceRecord(Arr::only($data, self::FIELDS));
            $record->vehicle()->associate($vehicle);
            $record->currency = 'EUR';
            $this->normalizeCosts($record, $rows);
            $record->save();
            $record->items()->createMany($rows);

            $this->syncMileage($record, (bool) ($data['confirm_mileage_drop'] ?? false));
            $this->syncLinkedExpense($record);

            $this->activity->forVehicle($vehicle, 'maintenance.created', 'maintenance_record', $record->id,
                ActivityPhrase::of('registró', 'registraste', "la intervención «{$record->title}» en ".$vehicle->displayName()),
                ['type' => $record->type->value, 'zone' => $record->zone->value]);

            return $record->refresh();
        });
    }

    /** PATCH: si llega `items`, reemplaza todas las líneas. */
    public function update(MaintenanceRecord $record, array $data): MaintenanceRecord
    {
        return DB::transaction(function () use ($record, $data) {
            $record->fill(Arr::only($data, self::FIELDS));

            $rows = null;
            if (array_key_exists('items', $data)) {
                $rows = LineItems::rows($data['items'] ?? []);
                $record->items()->delete();
                $record->items()->createMany($rows);
            }

            $this->normalizeCosts($record, $rows ?? []);
            $record->save();

            if (! $record->isArchived()) {
                $this->syncMileage($record, (bool) ($data['confirm_mileage_drop'] ?? false));
            }
            $this->syncLinkedExpense($record);

            $this->activity->forVehicle($record->vehicle, 'maintenance.updated', 'maintenance_record', $record->id,
                ActivityPhrase::of('editó', 'editaste', "la intervención «{$record->title}» de ".$record->vehicle->displayName()));

            return $record->refresh();
        });
    }

    /** Archivar retira el gasto vinculado; restaurar lo recrea (D3-A). */
    public function archive(MaintenanceRecord $record): MaintenanceRecord
    {
        if ($record->isArchived()) {
            return $record;
        }

        return DB::transaction(function () use ($record) {
            $record->forceFill(['archived_at' => now()])->save();
            $this->syncLinkedExpense($record);

            $this->activity->forVehicle($record->vehicle, 'maintenance.archived', 'maintenance_record', $record->id,
                ActivityPhrase::of('archivó', 'archivaste', "la intervención «{$record->title}» de ".$record->vehicle->displayName()));

            return $record;
        });
    }

    public function restore(MaintenanceRecord $record): MaintenanceRecord
    {
        if (! $record->isArchived()) {
            return $record;
        }

        return DB::transaction(function () use ($record) {
            $record->forceFill(['archived_at' => null])->save();
            $this->syncLinkedExpense($record);

            $this->activity->forVehicle($record->vehicle, 'maintenance.updated', 'maintenance_record', $record->id,
                ActivityPhrase::of('restauró', 'restauraste', "la intervención «{$record->title}» de ".$record->vehicle->displayName()));

            return $record;
        });
    }

    /**
     * Intervención creada al entregar una orden de trabajo (contrato §3.11). Se ejecuta dentro
     * de la transacción de la entrega. No crea lectura de km (ya la creó la orden con mileage_in)
     * ni gasto (en talleres la cifra económica es la facturación).
     */
    public function createFromWorkOrder(WorkOrder $order): MaintenanceRecord
    {
        $order->loadMissing(['items', 'vehicle', 'workspace']);

        $record = new MaintenanceRecord([
            'type' => RecordType::Repair,
            'zone' => Zone::General,
            'title' => $order->title,
            'description' => $order->diagnosis,
            'service_date' => ($order->delivered_at ?? now())->toDateString(),
            'mileage' => $order->mileage_in,
            'workshop_name' => $order->workspace->name,
            'total_cost' => $order->total,
            'currency' => 'EUR',
        ]);
        $record->vehicle()->associate($order->vehicle);
        $record->save();

        $record->items()->createMany($order->items->map(fn ($item) => [
            'kind' => $item->kind,
            'name' => $item->name,
            'part_number' => $item->part_number,
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'total' => $item->total,
            'position' => $item->position,
        ])->all());

        return $record;
    }

    /**
     * Fase 4 (contrato §3.5.1): la orden entregada nació de una solicitud ⇒ deja en el vehículo del particular una
     * intervención con lo facturado (líneas, piezas, mano de obra y total con IVA) y, por D3-A, su gasto vinculado.
     * Idempotente: `repair_request_id` es único, así que una solicitud nunca genera dos. No copia el diagnóstico ni
     * la lectura de km de la recepción: el kilometraje del particular solo cambia con sus propias lecturas.
     * Devuelve null si la orden no viene de una solicitud o el particular ya no tiene ese vehículo.
     */
    public function createFromDeliveredRequest(WorkOrder $order): ?MaintenanceRecord
    {
        $request = RepairRequest::query()->where('work_order_id', $order->id)->first();
        $vehicle = $request?->vehicle;
        if ($request === null || $vehicle === null) {
            return null;
        }

        $existing = MaintenanceRecord::query()->where('repair_request_id', $request->id)->first();
        if ($existing !== null) {
            return $existing;
        }

        $order->loadMissing(['items', 'workspace']);
        $labor = 0;
        $parts = 0;
        foreach ($order->items as $item) {
            $kind = $item->kind instanceof ItemKind ? $item->kind : ItemKind::tryFrom((string) $item->kind);
            if ($kind === ItemKind::Labor) {
                $labor += Money::toCents($item->total);
            } else {
                $parts += Money::toCents($item->total);
            }
        }
        $record = new MaintenanceRecord([
            'type' => RecordType::Repair,
            'zone' => $request->zone ?? Zone::General,
            'title' => $order->title,
            'service_date' => ($order->delivered_at ?? now())->toDateString(),
            'mileage' => null,
            'workshop_name' => $order->workspace->name,
            'parts_cost' => $order->items->isEmpty() ? null : Money::format($parts),
            'labor_cost' => $order->items->isEmpty() ? null : Money::format($labor),
            'total_cost' => $order->total,
            'currency' => 'EUR',
            'repair_request_id' => $request->id,
            'work_order_number' => $order->number,
        ]);
        $record->vehicle()->associate($vehicle);
        $record->save();

        $record->items()->createMany($order->items->map(fn ($item) => [
            'kind' => $item->kind,
            'name' => $item->name,
            'part_number' => $item->part_number,
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'total' => $item->total,
            'position' => $item->position,
        ])->all());

        $this->syncLinkedExpense($record);

        $this->activity->logWithoutUser($vehicle->workspace_id, 'maintenance.created', 'maintenance_record', $record->id,
            "{$order->workspace->name} entregó {$vehicle->displayName()}: la orden {$order->number} quedó en su historial y en sus gastos",
            $vehicle->id, ['type' => $record->type->value, 'zone' => $record->zone->value, 'source' => 'work_order']);

        return $record->refresh();
    }

    /**
     * Al CREAR sin total_cost, se deriva de los datos del propio usuario: piezas + mano de obra o,
     * si no, la suma de las líneas con precio. Al EDITAR se respeta lo enviado: `total_cost: null`
     * significa "sin coste" (y elimina el gasto vinculado, contrato §3.5); si no se envía, no cambia.
     */
    private function normalizeCosts(MaintenanceRecord $record, array $rows): void
    {
        foreach (['parts_cost', 'labor_cost', 'total_cost'] as $field) {
            $record->{$field} = Money::normalize($record->{$field});
        }

        if ($record->total_cost !== null || $record->exists) {
            return;
        }

        if ($record->parts_cost !== null || $record->labor_cost !== null) {
            $record->total_cost = Money::format(Money::toCents($record->parts_cost) + Money::toCents($record->labor_cost));
        } elseif (($sum = LineItems::sumCents($rows)) !== null) {
            $record->total_cost = Money::format($sum);
        }
    }

    private function syncMileage(MaintenanceRecord $record, bool $confirmed): void
    {
        $this->mileage->syncForSource(
            $record->vehicle,
            MileageSource::Maintenance,
            $record->id,
            $record->mileage,
            $record->service_date?->toDateString(),
            $confirmed,
        );
    }

    /** D3-A: crea, actualiza o elimina el gasto vinculado según el coste y el estado. */
    public function syncLinkedExpense(MaintenanceRecord $record): void
    {
        $vehicle = $record->vehicle;
        if (! $vehicle->workspace->isPersonal()) {
            return;
        }

        $cents = Money::toCents($record->total_cost);

        if ($record->isArchived() || $cents <= 0) {
            Expense::query()->where('maintenance_record_id', $record->id)->delete();

            return;
        }

        Expense::query()->updateOrCreate(
            ['maintenance_record_id' => $record->id],
            [
                'vehicle_id' => $vehicle->id,
                'category' => $record->type->expenseCategory(),
                'description' => $record->title,
                'amount' => Money::format($cents),
                'currency' => 'EUR',
                'expense_date' => $record->service_date,
                'mileage' => $record->mileage,
                'fuel_quantity' => null,
                'fuel_unit' => null,
                'full_tank' => null,
            ],
        );
    }
}
