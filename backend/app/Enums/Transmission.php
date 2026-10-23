<?php

namespace App\Enums;

/** Tipo de cambio. */
enum Transmission: string
{
    use EnumHelpers;

    case Manual = 'manual';
    case Automatic = 'automatic';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual',
            self::Automatic => 'Automático',
        };
    }
}
