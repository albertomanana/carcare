<?php

namespace App\Services;

use App\Enums\MileageSource;
use App\Enums\Priority;
use App\Enums\WorkOrderStatus;
use App\Exceptions\ConflictException;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Support\LineItems;
use App\Support\Money;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Órdenes de trabajo del taller (contrato §3.11): numeración sin huecos, totales con IVA,
 * elevadores con una sola orden abierta y entrega ⇒ intervención en el historial.
 */
class WorkOrderService
{
    private const FIELDS = [
        'title', 'complaint', 'diagnosis', 'priority', 'bay', 'assigned_to', 'mileage_in', 'promised_at', 'tax_rate',
    ];

    public function __construct(
        private readonly MileageService $mileage,
        private readonly MaintenanceService $maintenance,
        private readonly ActivityLogger $activity,
    ) {}

    public function create(Workspace $workspace, array $data): WorkOrder
    {
        return DB::transaction(function () use ($workspace, $data) {
            // Bloqueo del espacio: serializa numeración y asignación de elevadores entre peticiones concurrentes.
            $this->lock($workspace);

            $vehicle = Vehicle::query()->where('workspace_id', $workspace->id)->findOrFail($data['vehicle_id']);
            $year = (int) now()->year;
            $sequence = (int) WorkOrder::query()
                ->where('workspace_id', $workspace->id)
                ->where('year', $year)
                ->max('sequence') + 1;

            $order = new WorkOrder(Arr::only($data, self::FIELDS));
            $order->fill([
                'workspace_id' => $workspace->id,
                'vehicle_id' => $vehicle->id,
                'customer_id' => $vehicle->customer_id,
                'number' => sprintf('OT-%d-%04d', $year, $sequence),
                'year' => $year,
                'sequence' => $sequence,
                'status' => WorkOrderStatus::Received,
                'priority' => $data['priority'] ?? Priority::Normal->value,
                'received_at' => now(),
                'tax_rate' => Money::normalize($data['tax_rate'] ?? $workspace->taxRate()),
            ]);

            if ($order->bay !== null) {
                $this->ensureBayIsFree($workspace, $order->bay);
            }

            $rows = LineItems::rows($data['items'] ?? []);
            $this->applyTotals($order, $rows);
            $order->save();
            $order->items()->createMany($rows);

            $this->syncMileage($order, $vehicle);

            $this->activity->log($workspace->id, 'work_order.created', 'work_order', $order->id,
                ActivityLogger::actor()." abrió la orden {$order->number} para ".$this->vehicleLabel($vehicle),
                $vehicle->id, ['status' => $order->status->value]);

            return $order->refresh();
        });
    }

    /** PATCH: 409 si la orden está entregada o cancelada. Si llega `items`, reemplaza las líneas. */
    public function update(WorkOrder $order, array $data): WorkOrder
    {
        $this->ensureEditable($order);

        return DB::transaction(function () use ($order, $data) {
            $workspace = $order->workspace;
            $this->lock($workspace);

            if (isset($data['vehicle_id']) && (int) $data['vehicle_id'] !== $order->vehicle_id) {
                $newVehicle = Vehicle::query()->where('workspace_id', $workspace->id)->findOrFail($data['vehicle_id']);
                $this->mileage->removeForSource($order->vehicle, MileageSource::WorkOrder, $order->id);
                $order->vehicle()->associate($newVehicle);
                $order->customer_id = $newVehicle->customer_id;
            }

            $order->fill(Arr::only($data, self::FIELDS));
            if (array_key_exists('tax_rate', $data)) {
                $order->tax_rate = Money::normalize($data['tax_rate'] ?? $workspace->taxRate());
            }
            if ($order->isDirty('bay') && $order->bay !== null) {
                $this->ensureBayIsFree($workspace, $order->bay, $order->id);
            }

            if (array_key_exists('items', $data)) {
                $rows = LineItems::rows($data['items'] ?? []);
                $order->items()->delete();
                $order->items()->createMany($rows);
            }

            $this->applyTotals($order, $order->items()->get()->all());
            $order->save();

            $this->syncMileage($order, $order->vehicle);

            $this->activity->log($workspace->id, 'work_order.updated', 'work_order', $order->id,
                ActivityLogger::actor()." editó la orden {$order->number}", $order->vehicle_id);

            return $order->refresh();
        });
    }

    /**
     * Cambio de estado (tablero kanban). ready fija completed_at; delivered fija delivered_at y crea,
     * en la misma transacción, la intervención en el historial del vehículo.
     */
    public function changeStatus(WorkOrder $order, WorkOrderStatus $status, bool $bayProvided, ?int $bay): WorkOrder
    {
        $this->ensureEditable($order);

        return DB::transaction(function () use ($order, $status, $bayProvided, $bay) {
            $workspace = $order->workspace;
            $this->lock($workspace);
            $previous = $order->status;

            $newBay = match (true) {
                $status->isFinal() => null, // una orden cerrada nunca ocupa elevador
                $bayProvided => $bay,
                $status->releasesBay() && $status !== $previous => null,
                default => $order->bay,
            };
            if ($newBay !== null && $newBay !== $order->bay) {
                $this->ensureBayIsFree($workspace, $newBay, $order->id);
            }

            $order->status = $status;
            $order->bay = $newBay;

            if ($status !== $previous) {
                match ($status) {
                    WorkOrderStatus::Ready => $order->completed_at = now(),
                    WorkOrderStatus::Delivered => $order->completed_at ??= now(),
                    WorkOrderStatus::Cancelled => null,
                    default => $order->completed_at = null,
                };
            }

            if ($status === WorkOrderStatus::Delivered) {
                $order->delivered_at = now();
                $order->save();
                $record = $this->maintenance->createFromWorkOrder($order);
                $order->maintenance_record_id = $record->id;
            }

            $order->save();

            if ($status !== $previous) {
                $this->activity->log($workspace->id, 'work_order.status_changed', 'work_order', $order->id,
                    ActivityLogger::actor()." movió {$order->number} a «{$status->label()}»",
                    $order->vehicle_id, ['from' => $previous->value, 'to' => $status->value]);
            } elseif ($order->wasChanged('bay')) {
                $where = $order->bay ? "al elevador {$order->bay}" : 'fuera de los elevadores';
                $this->activity->log($workspace->id, 'work_order.updated', 'work_order', $order->id,
                    ActivityLogger::actor()." movió {$order->number} {$where}", $order->vehicle_id);
            }

            return $order->refresh();
        });
    }

    /** Solo órdenes recibidas o canceladas. */
    public function delete(WorkOrder $order): void
    {
        if (! in_array($order->status, [WorkOrderStatus::Received, WorkOrderStatus::Cancelled], true)) {
            throw new ConflictException('Solo se pueden eliminar órdenes en estado «Recibido» o «Cancelado».');
        }

        DB::transaction(function () use ($order) {
            $this->mileage->removeForSource($order->vehicle, MileageSource::WorkOrder, $order->id);
            $order->delete();
        });
    }

    /**
     * Elevadores 1…bays_count con su orden abierta (si la hay).
     *
     * @return Collection<int, array{number: int, work_order: ?WorkOrder}>
     */
    public function bays(Workspace $workspace): Collection
    {
        $orders = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->open()
            ->whereNotNull('bay')
            ->with(WorkOrder::RESOURCE_RELATIONS)
            ->orderBy('id')
            ->get();

        return $this->baysFrom($workspace, $orders);
    }

    /**
     * Elevadores a partir de órdenes abiertas ya cargadas (el dashboard las reutiliza).
     *
     * @param  Collection<int, WorkOrder>  $openOrders
     * @return Collection<int, array{number: int, work_order: ?WorkOrder}>
     */
    public function baysFrom(Workspace $workspace, Collection $openOrders): Collection
    {
        $byBay = $openOrders->filter(fn (WorkOrder $o) => $o->bay !== null)->keyBy('bay');

        return collect(range(1, $workspace->baysCount()))
            ->map(fn (int $n) => ['number' => $n, 'work_order' => $byBay->get($n)]);
    }

    private function ensureEditable(WorkOrder $order): void
    {
        if ($order->isFinal()) {
            $state = $order->status === WorkOrderStatus::Delivered ? 'entregada' : 'cancelada';
            throw new ConflictException("La orden {$order->number} está {$state} y ya no admite cambios.");
        }
    }

    /** Un elevador solo puede tener una orden abierta. */
    private function ensureBayIsFree(Workspace $workspace, int $bay, ?int $exceptOrderId = null): void
    {
        $occupant = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->open()
            ->where('bay', $bay)
            ->when($exceptOrderId, fn ($q) => $q->whereKeyNot($exceptOrderId))
            ->first();

        if ($occupant) {
            throw new ConflictException("El elevador {$bay} está ocupado por {$occupant->number}");
        }
    }

    /** subtotal = Σ líneas; IVA = subtotal × tipo / 100 (half-up a céntimos); total = subtotal + IVA. */
    private function applyTotals(WorkOrder $order, array $rows): void
    {
        $subtotal = LineItems::sumCents($rows) ?? 0;
        $tax = Money::percentOf($subtotal, $order->tax_rate);

        $order->subtotal = Money::format($subtotal);
        $order->tax_amount = Money::format($tax);
        $order->total = Money::format($subtotal + $tax);
    }

    /** mileage_in genera lectura (source=work_order). En talleres se acepta aunque sea menor. */
    private function syncMileage(WorkOrder $order, Vehicle $vehicle): void
    {
        $this->mileage->syncForSource(
            $vehicle,
            MileageSource::WorkOrder,
            $order->id,
            $order->mileage_in,
            $order->received_at->toDateString(),
            confirmed: true,
        );
    }

    private function lock(Workspace $workspace): void
    {
        Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();
    }

    private function vehicleLabel(Vehicle $vehicle): string
    {
        return $vehicle->displayName().($vehicle->plate ? " ({$vehicle->plate})" : '');
    }
}
