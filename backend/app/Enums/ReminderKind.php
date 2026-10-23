<?php

namespace App\Enums;

/** Tipo de recordatorio. Cada tipo tiene una zona por defecto (contrato §3.7). */
enum ReminderKind: string
{
    use EnumHelpers;

    case Itv = 'itv';
    case Insurance = 'insurance';
    case Tax = 'tax';
    case Oil = 'oil';
    case Service = 'service';
    case Tyres = 'tyres';
    case Brakes = 'brakes';
    case TimingBelt = 'timing_belt';
    case Battery = 'battery';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Itv => 'ITV',
            self::Insurance => 'Seguro',
            self::Tax => 'Impuesto de circulación',
            self::Oil => 'Cambio de aceite',
            self::Service => 'Revisión',
            self::Tyres => 'Neumáticos',
            self::Brakes => 'Frenos',
            self::TimingBelt => 'Correa de distribución',
            self::Battery => 'Batería',
            self::Custom => 'Personalizado',
        };
    }

    public function defaultZone(): Zone
    {
        return match ($this) {
            self::Oil, self::TimingBelt => Zone::Engine,
            self::Tyres => Zone::Tyres,
            self::Brakes => Zone::Brakes,
            self::Battery => Zone::Electrical,
            default => Zone::General,
        };
    }
}
