<?php

namespace App\Enums;

/** Servicios que un taller puede anunciar en el directorio (lista cerrada, contrato §3.13.2). */
enum WorkshopService: string
{
    use EnumHelpers;

    case Maintenance = 'maintenance';
    case Mechanics = 'mechanics';
    case Tyres = 'tyres';
    case Brakes = 'brakes';
    case Bodywork = 'bodywork';
    case Electrical = 'electrical';
    case Ac = 'ac';
    case PreItv = 'pre_itv';

    public function label(): string
    {
        return match ($this) {
            self::Maintenance => 'Mantenimiento y revisiones',
            self::Mechanics => 'Mecánica general',
            self::Tyres => 'Neumáticos',
            self::Brakes => 'Frenos',
            self::Bodywork => 'Chapa y pintura',
            self::Electrical => 'Electricidad y baterías',
            self::Ac => 'Aire acondicionado',
            self::PreItv => 'Pre‑ITV',
        };
    }
}
