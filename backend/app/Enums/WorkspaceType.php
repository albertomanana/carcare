<?php

namespace App\Enums;

/** Tipo de espacio de trabajo (ADR-0002). */
enum WorkspaceType: string
{
    use EnumHelpers;

    case Personal = 'personal';
    case Workshop = 'workshop';

    public function label(): string
    {
        return match ($this) {
            self::Personal => 'Particular',
            self::Workshop => 'Taller',
        };
    }
}
