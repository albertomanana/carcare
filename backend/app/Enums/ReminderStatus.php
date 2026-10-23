<?php

namespace App\Enums;

/** Estado guardado de un recordatorio. */
enum ReminderStatus: string
{
    use EnumHelpers;

    case Pending = 'pending';
    case Done = 'done';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente',
            self::Done => 'Hecho',
            self::Dismissed => 'Descartado',
        };
    }
}
