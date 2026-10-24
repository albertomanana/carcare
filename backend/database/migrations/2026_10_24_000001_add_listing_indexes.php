<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índices para los listados que ordenan por fecha dentro de su padre (tarea 19, rendimiento).
 * Aditiva: no cambia columnas ni datos. Las migraciones ya ejecutadas no se tocan.
 *
 *  - work_orders (workspace_id, received_at): lista de órdenes y tablero, `ORDER BY received_at DESC`.
 *  - vehicles (workspace_id, archived_at, created_at): garaje y flota, activos por fecha de alta.
 *  - documents (vehicle_id, created_at): documentos del vehículo (desc) y su tramo en el diario.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->index(['workspace_id', 'received_at'], 'work_orders_workspace_received_index');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->index(['workspace_id', 'archived_at', 'created_at'], 'vehicles_workspace_archived_created_index');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->index(['vehicle_id', 'created_at'], 'documents_vehicle_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', fn (Blueprint $table) => $table->dropIndex('work_orders_workspace_received_index'));
        Schema::table('vehicles', fn (Blueprint $table) => $table->dropIndex('vehicles_workspace_archived_created_index'));
        Schema::table('documents', fn (Blueprint $table) => $table->dropIndex('documents_vehicle_created_index'));
    }
};
