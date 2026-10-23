<?php

namespace App\Support;

/** Formato legible de kilometraje para mensajes: 84200 → '84.200 km'. */
final class Km
{
    public static function human(?int $km): string
    {
        return number_format((int) $km, 0, ',', '.').' km';
    }
}
