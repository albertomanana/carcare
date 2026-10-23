<?php

namespace App\Enums;

/** Estado de una orden de trabajo (columnas del tablero kanban). */
enum WorkOrderStatus: string
{
    use EnumHelpers;

    case Received = 'received';
    case Diagnosing = 'diagnosing';
    case WaitingParts = 'waiting_parts';
    case InProgress = 'in_progress';
    case Ready = 'ready';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Received => 'Recibido',
            self::Diagnosing => 'Diagnóstico',
            self::WaitingParts => 'Esperando piezas',
            self::InProgress => 'En reparación',
            self::Ready => 'Listo',
            self::Delivered => 'Entregado',
            self::Cancelled => 'Cancelado',
        };
    }

    /** delivered y cancelled son estados finales: la orden queda en solo lectura. */
    public function isFinal(): bool
    {
        return $this === self::Delivered || $this === self::Cancelled;
    }

    /** Pasar a estos estados libera el elevador salvo que se indique otro. */
    public function releasesBay(): bool
    {
        return in_array($this, [self::Ready, self::Delivered, self::Cancelled], true);
    }

    /** @return list<string> */
    public static function finalValues(): array
    {
        return [self::Delivered->value, self::Cancelled->value];
    }
}
