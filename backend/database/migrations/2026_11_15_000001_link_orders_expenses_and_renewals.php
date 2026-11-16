<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Apex Telemetry», Fase 4 (contrato §3.5.1 y §3.6.1).
 *
 *  - Una orden de taller nacida de una solicitud, al entregarse, deja una intervención en el vehículo del particular
 *    (y, por ADR‑0003, su gasto vinculado). `repair_request_id` es único: una solicitud nunca genera dos.
 *    `work_order_number` guarda el número («OT-2026-0036») aunque el taller borre después la orden.
 *  - Un gasto puede ser periódico (`recurrence_months`) y quedar unido al recordatorio de su próxima renovación.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->foreignId('repair_request_id')->nullable()->unique()->after('vehicle_id')
                ->constrained('repair_requests')->nullOnDelete();
            $table->string('work_order_number', 20)->nullable()->after('repair_request_id');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedTinyInteger('recurrence_months')->nullable()->after('full_tank');
            $table->foreignId('reminder_id')->nullable()->after('recurrence_months')
                ->constrained('reminders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reminder_id');
            $table->dropColumn('recurrence_months');
        });

        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('repair_request_id');
            $table->dropColumn('work_order_number');
        });
    }
};
