<?php

namespace App\Enums;

/** Prioridad de una orden de trabajo. */
enum Priority: string
{
    use EnumHelpers;

    case Low = 'low';
    case Normal = 'normal';
    case High = 'high';
    case Urgent = 'urgent';

    public function label(): string
    {
        return match ($this) {
            self::Low => 'Baja',
            self::Normal => 'Normal',
            self::High => 'Alta',
            self::Urgent => 'Urgente',
        };
    }
}
