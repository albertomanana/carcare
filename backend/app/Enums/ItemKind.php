<?php

namespace App\Enums;

/** Tipo de línea de una intervención u orden. */
enum ItemKind: string
{
    use EnumHelpers;

    case Part = 'part';
    case Labor = 'labor';
    case Fluid = 'fluid';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Part => 'Pieza',
            self::Labor => 'Mano de obra',
            self::Fluid => 'Líquido',
            self::Other => 'Otro',
        };
    }
}
