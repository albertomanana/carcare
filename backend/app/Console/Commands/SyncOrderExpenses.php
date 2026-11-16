<?php

namespace App\Console\Commands;

use App\Enums\WorkOrderStatus;
use App\Models\RepairRequest;
use App\Models\WorkOrder;
use App\Services\MaintenanceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Pone al día las órdenes entregadas antes de la Fase 4 (contrato §3.5.1): por cada orden ya entregada que nació de
 * una solicitud, deja en el vehículo del particular su intervención y su gasto vinculado. Es idempotente: una
 * solicitud nunca genera dos intervenciones, así que se puede repetir sin miedo.
 */
class SyncOrderExpenses extends Command
{
    protected $signature = 'carcare:sync-order-expenses {--dry-run : Solo cuenta lo que haría, sin escribir}';

    protected $description = 'Crea la intervención y el gasto del particular para las órdenes de taller ya entregadas que nacieron de una solicitud';

    public function handle(MaintenanceService $maintenance): int
    {
        $requests = RepairRequest::query()
            ->whereNotNull('work_order_id')
            ->whereNotNull('vehicle_id')
            ->whereDoesntHave('maintenanceRecord')
            ->get();

        $created = 0;
        foreach ($requests as $request) {
            $order = WorkOrder::query()->find($request->work_order_id);
            if ($order === null || $order->status !== WorkOrderStatus::Delivered) {
                continue;
            }
            if (! $this->option('dry-run')) {
                DB::transaction(fn () => $maintenance->createFromDeliveredRequest($order));
            }
            $created++;
            $this->line("  {$order->number} → solicitud #{$request->id}");
        }

        $this->info($this->option('dry-run')
            ? "Se crearían {$created} intervenciones con su gasto."
            : "Creadas {$created} intervenciones con su gasto.");

        return self::SUCCESS;
    }
}
