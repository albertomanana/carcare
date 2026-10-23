<?php

namespace App\Support;

/**
 * Normaliza las líneas (`LineItemInput`) de intervenciones y órdenes:
 * cantidades y precios a 2 decimales y `total = cantidad × precio` calculado en el servidor.
 */
final class LineItems
{
    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    public static function rows(array $items): array
    {
        $rows = [];
        foreach (array_values($items) as $position => $item) {
            $unitPrice = Money::normalize($item['unit_price'] ?? null);
            $total = Money::lineTotal((string) $item['quantity'], $unitPrice);

            $rows[] = [
                'kind' => $item['kind'],
                'name' => $item['name'],
                'part_number' => $item['part_number'] ?? null,
                'quantity' => Money::normalize($item['quantity']),
                'unit_price' => $unitPrice,
                'total' => $total === null ? null : Money::format($total),
                'position' => $position,
            ];
        }

        return $rows;
    }

    /**
     * Suma de los totales de las líneas en céntimos; null si ninguna tiene precio.
     *
     * @param  iterable<array<string, mixed>|object>  $rows
     */
    public static function sumCents(iterable $rows): ?int
    {
        $sum = null;
        foreach ($rows as $row) {
            $total = is_array($row) ? ($row['total'] ?? null) : $row->total;
            if ($total !== null) {
                $sum = ($sum ?? 0) + Money::toCents($total);
            }
        }

        return $sum;
    }
}
