<?php

namespace App\Support;

/**
 * Aritmética de dinero en céntimos enteros: nunca float para importes.
 * En JSON el dinero viaja como string con 2 decimales ('1234.50').
 */
final class Money
{
    /** Convierte '12.5', '12.50', 12, 12.5 (o lo que devuelva SUM en MySQL/SQLite) a céntimos. */
    public static function toCents(string|int|float|null $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        if (is_int($value)) {
            return $value * 100;
        }

        if (is_float($value)) {
            return (int) round($value * 100);
        }

        $value = trim($value);
        if (! preg_match('/^(-?)(\d*)(?:\.(\d*))?$/', $value, $m)) {
            return (int) round(((float) $value) * 100);
        }

        $decimals = $m[3] ?? '';
        $cents = (int) ($m[2] === '' ? '0' : $m[2]) * 100 + (int) str_pad(substr($decimals, 0, 2), 2, '0');
        // Redondeo half-up si llegan más de 2 decimales.
        if (strlen($decimals) > 2 && (int) $decimals[2] >= 5) {
            $cents++;
        }

        return $m[1] === '-' ? -$cents : $cents;
    }

    /** 123450 → '1234.50' */
    public static function format(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $cents = abs($cents);

        return $sign.intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    /** Normaliza cualquier importe a string de 2 decimales; null se mantiene. */
    public static function normalize(string|int|float|null $value): ?string
    {
        return $value === null || $value === '' ? null : self::format(self::toCents($value));
    }

    /** cantidad × precio unitario, redondeo half-up a céntimos. null si no hay precio. */
    public static function lineTotal(string|int|float $quantity, string|int|float|null $unitPrice): ?int
    {
        if ($unitPrice === null || $unitPrice === '') {
            return null;
        }

        // La cantidad también tiene 2 decimales: se trabaja en centésimas.
        $product = self::toCents($quantity) * self::toCents($unitPrice);

        return intdiv($product + 50, 100);
    }

    /** Porcentaje de un importe (p. ej. IVA '21.00'), redondeo half-up a céntimos. */
    public static function percentOf(int $cents, string|int|float $rate): int
    {
        return intdiv($cents * self::toCents($rate) + 5000, 10000);
    }

    /** Formato legible en español para frases de actividad: 1234.5 → '1.234,50 €'. */
    public static function human(string|int|float|null $value): string
    {
        $cents = self::toCents($value);

        return number_format($cents / 100, 2, ',', '.').' €';
    }
}
