<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/** Utilidades de fechas sin hora (inmunes a cambios de horario de verano). */
final class Dates
{
    /** Días naturales de $from a $to (negativo si $to es anterior). */
    public static function daysBetween(DateTimeInterface|string $from, DateTimeInterface|string $to): int
    {
        $a = strtotime(self::ymd($from).' 00:00:00 UTC');
        $b = strtotime(self::ymd($to).' 00:00:00 UTC');

        return intdiv($b - $a, 86400);
    }

    public static function ymd(DateTimeInterface|string $date): string
    {
        return $date instanceof DateTimeInterface ? $date->format('Y-m-d') : substr($date, 0, 10);
    }

    public static function date(DateTimeInterface|string $date): CarbonImmutable
    {
        return CarbonImmutable::parse(self::ymd($date))->startOfDay();
    }

    /** '2026-03-12' → '12/03/2026' para mensajes en español. */
    public static function human(DateTimeInterface|string $date): string
    {
        return self::date($date)->format('d/m/Y');
    }

    /**
     * Meses 'YYYY-MM' desde $from hasta $to (ambos incluidos).
     *
     * @return list<string>
     */
    public static function months(DateTimeInterface|string $from, DateTimeInterface|string $to): array
    {
        $cursor = self::date($from)->startOfMonth();
        $end = self::date($to)->startOfMonth();
        $months = [];
        while ($cursor <= $end) {
            $months[] = $cursor->format('Y-m');
            $cursor = $cursor->addMonth();
        }

        return $months;
    }
}
