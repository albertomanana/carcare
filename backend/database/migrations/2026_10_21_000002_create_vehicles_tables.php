<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vehículos y todo lo que cuelga de ellos. Las tablas hijas NO guardan user_id:
 * la propiedad se resuelve recurso → vehículo → espacio → miembros (ADR-0002).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('nickname', 60)->nullable();
            $table->string('make', 60);
            $table->string('model', 80);
            $table->string('version', 80)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('fuel_type', 20)->nullable();
            $table->string('transmission', 20)->nullable();
            $table->string('engine', 60)->nullable();
            $table->string('body_type', 20)->nullable();
            $table->char('color_hex', 7)->nullable();
            $table->string('plate', 15)->nullable();
            $table->string('vin', 17)->nullable();
            $table->date('purchase_date')->nullable();
            $table->unsignedInteger('purchase_mileage')->nullable();
            $table->unsignedInteger('current_mileage')->nullable();
            $table->date('mileage_updated_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'archived_at']);
            $table->index(['workspace_id', 'plate']);
            $table->index(['workspace_id', 'vin']);
        });

        Schema::create('mileage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->date('recorded_at');
            $table->unsignedInteger('mileage');
            $table->string('source', 20); // manual | vehicle_created | maintenance | expense | work_order | reminder
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'recorded_at', 'mileage']);
            $table->index(['source', 'source_id']);
        });

        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('zone', 20);
            $table->string('service_kind', 20)->nullable();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->date('service_date');
            $table->unsignedInteger('mileage')->nullable();
            $table->string('workshop_name', 120)->nullable();
            $table->decimal('parts_cost', 10, 2)->nullable();
            $table->decimal('labor_cost', 10, 2)->nullable();
            $table->decimal('total_cost', 10, 2)->nullable();
            $table->char('currency', 3)->default('EUR');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'service_date']);
            $table->index(['vehicle_id', 'zone']);
            $table->index(['vehicle_id', 'service_kind']);
        });

        // Líneas de intervención. Las órdenes de trabajo tienen su propia tabla gemela
        // (work_order_items) para conservar FKs reales con borrado en cascada.
        Schema::create('maintenance_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_record_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10); // part | labor | fluid | other
            $table->string('name', 120);
            $table->string('part_number', 60)->nullable();
            $table->decimal('quantity', 8, 2);
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->decimal('total', 10, 2)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            // Gasto vinculado a una intervención (D3-A): único y gestionado desde ella.
            $table->foreignId('maintenance_record_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->string('category', 20);
            $table->string('description')->nullable();
            $table->decimal('amount', 10, 2);
            $table->char('currency', 3)->default('EUR');
            $table->date('expense_date');
            $table->unsignedInteger('mileage')->nullable();
            $table->decimal('fuel_quantity', 8, 2)->nullable();
            $table->string('fuel_unit', 5)->nullable();
            $table->boolean('full_tank')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'expense_date']);
            $table->index(['vehicle_id', 'category']);
        });

        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('kind', 20);
            $table->string('zone', 20);
            $table->text('notes')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedInteger('due_mileage')->nullable();
            $table->unsignedSmallInteger('recurrence_months')->nullable();
            $table->unsignedInteger('recurrence_km')->nullable();
            $table->date('starts_on');
            $table->unsignedInteger('start_mileage')->nullable();
            $table->string('status', 20)->default('pending');
            $table->date('completed_at')->nullable();
            $table->unsignedInteger('completed_mileage')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'status']);
            $table->index(['status', 'due_date']);
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('maintenance_record_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->string('document_type', 20);
            $table->string('disk', 20)->default('local');
            $table->string('path');
            $table->string('original_filename');
            $table->string('mime_type', 100);
            $table->unsignedInteger('size');
            $table->date('expires_at')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
        Schema::dropIfExists('reminders');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('maintenance_items');
        Schema::dropIfExists('maintenance_records');
        Schema::dropIfExists('mileage_logs');
        Schema::dropIfExists('vehicles');
    }
};
