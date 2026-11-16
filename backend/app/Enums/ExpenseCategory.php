<?php

namespace App\Enums;

/** Categoría de gasto. */
enum ExpenseCategory: string
{
    use EnumHelpers;

    case Fuel = 'fuel';
    case Maintenance = 'maintenance';
    case Repair = 'repair';
    case Modification = 'modification';
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
            self::Modification => 'Modificaciones',
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

    /** Gastos que se repiten y tienen renovación: admiten periodicidad (contrato §3.6.1). */
    public function isRecurring(): bool
    {
        return in_array($this, [self::Insurance, self::Tax, self::Parking, self::Other], true);
    }

    /** Gastos que pueden asociarse a una intervención o crearla en el mismo paso (contrato §3.6.1). */
    public function allowsRecord(): bool
    {
        return in_array($this, [self::Maintenance, self::Repair, self::Modification, self::Inspection], true);
    }

    /** Tipo de la intervención que se crea desde un gasto de esta categoría. */
    public function recordType(): RecordType
    {
        return match ($this) {
            self::Repair => RecordType::Repair,
            self::Modification => RecordType::Modification,
            self::Inspection => RecordType::Inspection,
            default => RecordType::Maintenance,
        };
    }

    /** Recordatorio con el que se sigue la renovación de un gasto periódico. */
    public function reminderKind(): ReminderKind
    {
        return match ($this) {
            self::Insurance => ReminderKind::Insurance,
            self::Tax => ReminderKind::Tax,
            default => ReminderKind::Custom,
        };
    }
}
