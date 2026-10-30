<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * E16 · Directorio de talleres y solicitudes de reparación (contrato §3.13, ADR‑0007). Aditiva:
 *  - `workshop_profiles`: datos públicos del taller en el directorio (1:1 con el espacio de taller).
 *  - `repair_requests`: la solicitud, con la copia fija del coche en las columnas `vehicle_*`.
 *  - `repair_quotes`: versiones inmutables del presupuesto, con las líneas en una columna JSON.
 *  - `vehicles.source_vehicle_id`: enlace interno de la copia del taller al coche del particular
 *    (no sale en el JSON; se pone a null si el particular borra el coche).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('listed')->default(false);
            $table->string('city', 80)->nullable();
            $table->string('address', 160)->nullable();
            $table->string('phone', 30)->nullable();
            $table->json('services')->nullable();
            $table->string('opening_hours', 200)->nullable();
            $table->timestamps();

            $table->index(['listed', 'city']);
        });

        Schema::create('repair_requests', function (Blueprint $table) {
            $table->id();
            // Las dos partes: el espacio personal que la envía (y su owner) y el taller destinatario.
            $table->foreignId('requester_workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('requester_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('workshop_workspace_id')->constrained('workspaces')->cascadeOnDelete();
            // Coche del particular: null si lo borra (la copia fija se conserva).
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('pending');

            // Copia fija del coche al enviar: lo único que el taller ve de él.
            $table->string('vehicle_make', 60);
            $table->string('vehicle_model', 80);
            $table->unsignedSmallInteger('vehicle_year')->nullable();
            $table->string('vehicle_fuel_type', 20)->nullable();
            $table->string('vehicle_body_type', 20)->nullable();
            $table->char('vehicle_color_hex', 7)->nullable();
            $table->string('vehicle_plate', 15)->nullable();

            $table->string('title', 120);
            $table->text('description');
            $table->string('zone', 20)->nullable();
            $table->date('preferred_date');
            $table->unsignedInteger('mileage');
            $table->string('contact_phone', 30)->nullable();
            $table->boolean('share_history')->default(false);
            $table->string('reject_reason', 500)->nullable();

            // Columnas internas de la conversión (§3.13.6): no salen en el JSON.
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained()->nullOnDelete();

            $table->timestamp('responded_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['requester_workspace_id', 'created_at']);
            $table->index(['workshop_workspace_id', 'status']);
            $table->index(['workshop_workspace_id', 'created_at']);
            // Límite anti‑spam (5 en 24 h por usuario) y pareja abierta vehículo‑taller.
            $table->index(['requester_user_id', 'created_at']);
            $table->index(['vehicle_id', 'workshop_workspace_id', 'status']);
        });

        Schema::create('repair_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('repair_request_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('version');
            $table->string('status', 20)->default('sent');
            // Líneas inmutables: [{kind, name, part_number, quantity, unit_price, total}].
            $table->json('items');
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax_rate', 5, 2);
            $table->decimal('tax_amount', 10, 2);
            $table->decimal('total', 10, 2);
            $table->unsignedTinyInteger('valid_days');
            $table->date('valid_until');
            $table->text('note')->nullable();
            $table->string('client_reason', 500)->nullable();
            // DEFAULT explícito: ver la nota de received_at en la migración de órdenes (MariaDB).
            $table->timestamp('sent_at')->useCurrent();
            $table->timestamp('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['repair_request_id', 'version']);
            $table->index(['repair_request_id', 'status']);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('source_vehicle_id')->nullable()->after('customer_id')
                ->constrained('vehicles')->nullOnDelete();
            $table->index(['workspace_id', 'source_vehicle_id']);
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropIndex(['workspace_id', 'source_vehicle_id']);
            $table->dropConstrainedForeignId('source_vehicle_id');
        });

        Schema::dropIfExists('repair_quotes');
        Schema::dropIfExists('repair_requests');
        Schema::dropIfExists('workshop_profiles');
    }
};
