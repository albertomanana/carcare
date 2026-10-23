<?php

namespace App\Enums;

/** Categoría de gasto. */
enum ExpenseCategory: string
{
    use EnumHelpers;

    case Fuel = 'fuel';
    case Maintenance = 'maintenance';
    case Repair = 'repair';
    case Insurance = 'insurance';
    case Tax = 'tax';
    case Inspection = 'inspection';
    case Parking = 'parking';
    case Tolls = 'tolls';
    case Cleaning = 'cleaning';
    case Fines = 'fines';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Fuel => 'Combustible',
            self::Maintenance => 'Mantenimiento',
            self::Repair => 'Reparación',
            self::Insurance => 'Seguro',
            self::Tax => 'Impuestos',
            self::Inspection => 'ITV e inspecciones',
            self::Parking => 'Aparcamiento',
            self::Tolls => 'Peajes',
            self::Cleaning => 'Limpieza',
            self::Fines => 'Multas',
            self::Other => 'Otros',
        };
    }
}
