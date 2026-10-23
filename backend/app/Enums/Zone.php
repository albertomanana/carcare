<?php

namespace App\Enums;

/** Zonas del vehículo (las que se iluminan en el modelo 3D). El orden de los casos es el orden del contrato. */
enum Zone: string
{
    use EnumHelpers;

    case Engine = 'engine';
    case Transmission = 'transmission';
    case Brakes = 'brakes';
    case Tyres = 'tyres';
    case Suspension = 'suspension';
    case Electrical = 'electrical';
    case Body = 'body';
    case Interior = 'interior';
    case Exhaust = 'exhaust';
    case General = 'general';

    public function label(): string
    {
        return match ($this) {
            self::Engine => 'Motor',
            self::Transmission => 'Transmisión',
            self::Brakes => 'Frenos',
            self::Tyres => 'Neumáticos',
            self::Suspension => 'Suspensión y dirección',
            self::Electrical => 'Eléctrico y batería',
            self::Body => 'Carrocería',
            self::Interior => 'Interior y climatización',
            self::Exhaust => 'Escape',
            self::General => 'General',
        };
    }
}
