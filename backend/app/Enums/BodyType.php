<?php

namespace App\Enums;

/** Carrocería: también decide la forma del modelo 3D y de la silueta 2D. */
enum BodyType: string
{
    use EnumHelpers;

    case Hatchback = 'hatchback';
    case Sedan = 'sedan';
    case Wagon = 'wagon';
    case Suv = 'suv';
    case Coupe = 'coupe';
    case Convertible = 'convertible';
    case Minivan = 'minivan';
    case Van = 'van';
    case Pickup = 'pickup';

    public function label(): string
    {
        return match ($this) {
            self::Hatchback => 'Compacto',
            self::Sedan => 'Berlina',
            self::Wagon => 'Familiar',
            self::Suv => 'SUV',
            self::Coupe => 'Coupé',
            self::Convertible => 'Descapotable',
            self::Minivan => 'Monovolumen',
            self::Van => 'Furgoneta',
            self::Pickup => 'Pick-up',
        };
    }
}
