<?php

namespace App\Enums;

/** Tipo de intervención. */
enum RecordType: string
{
    use EnumHelpers;

    case Maintenance = 'maintenance';
    case Repair = 'repair';
    case Breakdown = 'breakdown';
    case Inspection = 'inspection';
    case Tyres = 'tyres';
    case Bodywork = 'bodywork';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Maintenance => 'Mantenimiento',
            self::Repair => 'Reparación',
            self::Breakdown => 'Avería',
            self::Inspection => 'Inspección',
            self::Tyres => 'Neumáticos',
            self::Bodywork => 'Carrocería',
            self::Other => 'Otro',
        };
    }

    /** Categoría del gasto vinculado que genera una intervención con coste (D3-A). */
    public function expenseCategory(): ExpenseCategory
    {
        return match ($this) {
            self::Repair, self::Breakdown, self::Bodywork => ExpenseCategory::Repair,
            self::Inspection => ExpenseCategory::Inspection,
            default => ExpenseCategory::Maintenance,
        };
    }
}
