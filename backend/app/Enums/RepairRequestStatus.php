<?php

namespace App\Enums;

/**
 * Estado de una solicitud de reparación (contrato §3.13.4).
 * Abiertas: pending, accepted y quoted. Finales: rejected, cancelled y converted.
 */
enum RepairRequestStatus: string
{
    use EnumHelpers;

    case Pending = 'pending';
    case Accepted = 'accepted';
    case Quoted = 'quoted';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case Converted = 'converted';

    public function isOpen(): bool
    {
        return in_array($this, self::open(), true);
    }

    /** @return list<self> */
    public static function open(): array
    {
        return [self::Pending, self::Accepted, self::Quoted];
    }

    /** @return list<string> */
    public static function openValues(): array
    {
        return array_map(fn (self $s) => $s->value, self::open());
    }
}
