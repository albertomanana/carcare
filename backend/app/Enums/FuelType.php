<?php

namespace App\Enums;

/** Combustible del vehículo. */
enum FuelType: string
{
    use EnumHelpers;

    case Gasoline = 'gasoline';
    case Diesel = 'diesel';
    case Hybrid = 'hybrid';
    case PluginHybrid = 'plugin_hybrid';
    case Electric = 'electric';
    case Lpg = 'lpg';
    case Cng = 'cng';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Gasoline => 'Gasolina',
            self::Diesel => 'Diésel',
            self::Hybrid => 'Híbrido',
            self::PluginHybrid => 'Híbrido enchufable',
            self::Electric => 'Eléctrico',
            self::Lpg => 'GLP',
            self::Cng => 'GNC',
            self::Other => 'Otro',
        };
    }
}
