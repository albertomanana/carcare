<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tiempos de la orden de trabajo (contrato §3.11.1): desde cuándo está en su estado actual, cuánto lleva acumulado
 * en «En reparación» y el tiempo de mano de obra que estimó el taller. Son la fuente del cronómetro del taller 3D.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->timestamp('status_changed_at')->nullable()->after('delivered_at');
            $table->unsignedInteger('repair_seconds')->default(0)->after('status_changed_at');
            $table->unsignedSmallInteger('estimated_minutes')->nullable()->after('repair_seconds');
        });

        // Órdenes anteriores: el último cambio de estado registrado en la actividad; si no hay ninguno, la recepción.
        $lastChange = DB::table('activities')
            ->where('entity_type', 'work_order')
            ->where('action', 'work_order.status_changed')
            ->groupBy('entity_id')
            ->selectRaw('entity_id, MAX(created_at) as changed_at')
            ->pluck('changed_at', 'entity_id');

        DB::table('work_orders')->orderBy('id')->select(['id', 'received_at'])->chunkById(200, function ($orders) use ($lastChange) {
            foreach ($orders as $order) {
                DB::table('work_orders')->where('id', $order->id)->update([
                    'status_changed_at' => $lastChange[$order->id] ?? $order->received_at,
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropColumn(['status_changed_at', 'repair_seconds', 'estimated_minutes']);
        });
    }
};
