<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            // Numeración OT-AAAA-NNNN: (year, sequence) correlativo por espacio.
            $table->string('number', 20);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('sequence');
            $table->string('title', 120);
            $table->text('complaint')->nullable();
            $table->text('diagnosis')->nullable();
            $table->string('status', 20)->default('received');
            $table->string('priority', 10)->default('normal');
            $table->unsignedTinyInteger('bay')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('mileage_in')->nullable();
            // DEFAULT explícito: en MariaDB/MySQL sin explicit_defaults_for_timestamp, la primera columna
            // TIMESTAMP NOT NULL recibiría "ON UPDATE CURRENT_TIMESTAMP" y cada UPDATE pisaría la fecha.
            $table->timestamp('received_at')->useCurrent();
            $table->timestamp('promised_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(21);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            // Intervención creada al entregar la orden (la relación inversa se resuelve por esta FK).
            $table->foreignId('maintenance_record_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['workspace_id', 'number']);
            $table->unique(['workspace_id', 'year', 'sequence']);
            $table->index(['workspace_id', 'status']);
            $table->index(['workspace_id', 'bay']);
            $table->index(['workspace_id', 'delivered_at']);
            $table->index('vehicle_id');
        });

        Schema::create('work_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('name', 120);
            $table->string('part_number', 60)->nullable();
            $table->decimal('quantity', 8, 2);
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->decimal('total', 10, 2)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 50);
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id');
            $table->string('summary');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['workspace_id', 'created_at']);
            $table->index(['workspace_id', 'vehicle_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
        Schema::dropIfExists('work_order_items');
        Schema::dropIfExists('work_orders');
    }
};
