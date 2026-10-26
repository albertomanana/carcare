<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Migración de datos (tarea 27, contrato §3.4.1, regla 2: "nunca huérfano").
 *
 * Hasta el 26/10/2026, borrar un recordatorio completado con km dejaba su lectura (`source = reminder`)
 * con un `source_id` que ya no apuntaba a nada, y esa lectura no se podía borrar. Ahora se borran juntos;
 * las huérfanas que ya existan pasan a `manual`, sin `source_id` y con la nota "Recordatorio eliminado":
 * siguen contando para el km actual (no cambia ningún km) y se pueden borrar como cualquier lectura manual.
 *
 * Solo toca lecturas `reminder` cuyo recordatorio no existe (o no es del mismo vehículo). No borra nada.
 */
return new class extends Migration
{
    public const NOTE = 'Recordatorio eliminado';

    public function up(): void
    {
        DB::table('mileage_logs')
            ->where('source', 'reminder')
            ->whereNotExists(fn (Builder $q) => $q->selectRaw('1')
                ->from('reminders')
                ->whereColumn('reminders.id', 'mileage_logs.source_id')
                ->whereColumn('reminders.vehicle_id', 'mileage_logs.vehicle_id'))
            ->update([
                'source' => 'manual',
                'source_id' => null,
                'note' => self::NOTE,
                'updated_at' => now(),
            ]);
    }

    /** Irreversible a propósito: no se sabe a qué recordatorio pertenecía cada lectura. */
    public function down(): void {}
};
