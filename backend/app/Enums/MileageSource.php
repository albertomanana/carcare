<?php

namespace App\Enums;

/** Origen de una lectura de kilometraje. */
enum MileageSource: string
{
    use EnumHelpers;

    case Manual = 'manual';
    case VehicleCreated = 'vehicle_created';
    case Maintenance = 'maintenance';
    case Expense = 'expense';
    case WorkOrder = 'work_order';
    case Reminder = 'reminder';

    public function label(): string
    {
        return match ($this) {
            self::Manual => 'Manual',
            self::VehicleCreated => 'Alta del vehículo',
            self::Maintenance => 'Intervención',
            self::Expense => 'Gasto',
            self::WorkOrder => 'Orden de trabajo',
            self::Reminder => 'Recordatorio',
        };
    }
}
