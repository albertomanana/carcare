<?php

namespace App\Enums;

/** Unidad de combustible o carga. */
enum FuelUnit: string
{
    use EnumHelpers;

    case L = 'l';
    case Kwh = 'kwh';
    case Kg = 'kg';

    public function label(): string
    {
        return match ($this) {
            self::L => 'Litros',
            self::Kwh => 'kWh',
            self::Kg => 'Kilogramos',
        };
    }
}
