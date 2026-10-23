<?php

namespace App\Enums;

/** Servicio concreto de una intervención (permite 'desde el último cambio de aceite…'). */
enum ServiceKind: string
{
    use EnumHelpers;

    case Oil = 'oil';
    case Service = 'service';
    case Itv = 'itv';
    case Tyres = 'tyres';
    case Brakes = 'brakes';
    case TimingBelt = 'timing_belt';
    case Battery = 'battery';
    case Filters = 'filters';
    case Ac = 'ac';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Oil => 'Cambio de aceite',
            self::Service => 'Revisión',
            self::Itv => 'ITV',
            self::Tyres => 'Neumáticos',
            self::Brakes => 'Frenos',
            self::TimingBelt => 'Correa de distribución',
            self::Battery => 'Batería',
            self::Filters => 'Filtros',
            self::Ac => 'Aire acondicionado',
            self::Other => 'Otro',
        };
    }
}
