<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * E16 (contrato §3.13.8, ADR‑0007): tabla `notifications` estándar de Laravel (canal `database`),
 * generada con `make:notifications-table`. Es polimórfica y no tiene clave foránea: AccountService
 * borra las notificaciones del usuario al borrar su cuenta. Aditiva.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
