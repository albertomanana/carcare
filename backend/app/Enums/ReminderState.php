<?php

namespace App\Enums;

/** Estado calculado de un recordatorio pendiente (no se guarda). */
enum ReminderState: string
{
    use EnumHelpers;

    case Overdue = 'overdue';
    case Soon = 'soon';
    case Ok = 'ok';
    case Unknown = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::Overdue => 'Vencido',
            self::Soon => 'Próximo',
            self::Ok => 'Al día',
            self::Unknown => 'Sin datos',
        };
    }

    /** Gravedad para ordenar: overdue > soon > ok > unknown. */
    public function severity(): int
    {
        return match ($this) {
            self::Overdue => 3,
            self::Soon => 2,
            self::Ok => 1,
            self::Unknown => 0,
        };
    }
}
