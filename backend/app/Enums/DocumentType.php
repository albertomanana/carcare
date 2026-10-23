<?php

namespace App\Enums;

/** Tipo de documento. */
enum DocumentType: string
{
    use EnumHelpers;

    case Invoice = 'invoice';
    case Insurance = 'insurance';
    case Itv = 'itv';
    case Registration = 'registration';
    case Manual = 'manual';
    case Photo = 'photo';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Invoice => 'Factura',
            self::Insurance => 'Seguro',
            self::Itv => 'ITV',
            self::Registration => 'Permiso de circulación',
            self::Manual => 'Manual',
            self::Photo => 'Foto',
            self::Other => 'Otro',
        };
    }
}
