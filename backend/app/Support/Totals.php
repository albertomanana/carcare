<?php

namespace App\Support;

use App\Models\Expense;
use Illuminate\Support\Collection;

/**
 * Agregados de dinero calculados en PHP sobre colecciones ya filtradas:
 * céntimos enteros (sin float) e idéntico resultado en MariaDB y SQLite.
 */
final class Totals
{
    /** @param  Collection<int, mixed>  $items */
    public static function sumCents(Collection $items, string $field = 'amount'): int
    {
        return (int) $items->sum(fn ($item) => Money::toCents(data_get($item, $field)));
    }

    /**
     * Gasto por categoría, de mayor a menor importe.
     *
     * @param  Collection<int, Expense>  $expenses
     * @return list<array{category: string, total: string, count: int}>
     */
    public static function byCategory(Collection $expenses): array
    {
        return $expenses
            ->groupBy(fn (Expense $e) => $e->category->value)
            ->map(fn (Collection $group, string $category) => [
                'category' => $category,
                'cents' => self::sumCents($group),
                'count' => $group->count(),
            ])
            ->sortBy([['cents', 'desc'], ['category', 'asc']])
            ->map(fn (array $row) => [
                'category' => $row['category'],
                'total' => Money::format($row['cents']),
                'count' => $row['count'],
            ])
            ->values()
            ->all();
    }

    /**
     * Total por mes 'YYYY-MM' para la lista de meses dada, incluidos los meses a 0.
     *
     * @param  Collection<int, mixed>  $items
     * @param  list<string>  $months
     * @param  callable(mixed): ?string  $monthOf  devuelve 'YYYY-MM' de cada elemento
     * @return list<array{month: string, total: string}>
     */
    public static function byMonth(Collection $items, array $months, callable $monthOf, string $field = 'amount'): array
    {
        $sums = array_fill_keys($months, 0);
        foreach ($items as $item) {
            $month = $monthOf($item);
            if ($month !== null && array_key_exists($month, $sums)) {
                $sums[$month] += Money::toCents(data_get($item, $field));
            }
        }

        $rows = [];
        foreach ($sums as $month => $cents) {
            $rows[] = ['month' => $month, 'total' => Money::format($cents)];
        }

        return $rows;
    }
}
