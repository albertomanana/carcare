<?php

namespace App\Enums;

/** Utilidades comunes a los enums respaldados por string. */
trait EnumHelpers
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
