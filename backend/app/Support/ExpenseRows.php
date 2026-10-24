<?php

namespace App\Support;

use Illuminate\Contracts\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Support\Collection;

/**
 * Gastos como filas ligeras para agregados (resumen, dashboard, informe).
 *
 * Hidratar cada gasto como modelo y leer sus atributos con cast (fecha → Carbon, importe → decimal)
 * en cada filtro costaba más que la propia consulta: aquí cada fila se convierte una sola vez a
 * escalares (fecha 'Y-m-d', céntimos enteros) y los totales coinciden céntimo a céntimo con
 * {@see Totals} en MariaDB y SQLite.
 */
final class ExpenseRows
{
    private const COLUMNS = ['id', 'vehicle_id', 'category', 'amount', 'expense_date', 'mileage', 'fuel_quantity', 'fuel_unit', 'full_tank'];

    /**
     * @return Collection<int, object{id: int, vehicle_id: int, date: string, month: string, year: int, cents: int, category: string, mileage: ?int, quantity: ?int, unit: string, full: bool}>
     */
    public static function get(EloquentBuilder $query): Collection
    {
        return $query->toBase()->get(self::COLUMNS)->map(function (object $row) {
            $date = substr((string) $row->expense_date, 0, 10);

            return (object) [
                'id' => (int) $row->id,
                'vehicle_id' => (int) $row->vehicle_id,
                'date' => $date,
                'month' => substr($date, 0, 7),
                'year' => (int) substr($date, 0, 4),
                'cents' => Money::toCents($row->amount),
                'category' => (string) $row->category,
                'mileage' => $row->mileage === null ? null : (int) $row->mileage,
                // Cantidad de combustible en centésimas de unidad (null si no es un repostaje).
                'quantity' => $row->fuel_quantity === null ? null : Money::toCents($row->fuel_quantity),
                'unit' => (string) ($row->fuel_unit ?? 'l'),
                'full' => (bool) $row->full_tank,
            ];
        });
    }

    public static function sum(Collection $rows): int
    {
        return (int) $rows->sum('cents');
    }

    /** Filas con fecha entre $from y $to ('Y-m-d', ambos incluidos). */
    public static function between(Collection $rows, string $from, string $to): Collection
    {
        return $rows->filter(fn (object $r) => $r->date >= $from && $r->date <= $to)->values();
    }

    /**
     * Gasto por categoría, de mayor a menor importe (misma forma y orden que Totals::byCategory).
     *
     * @return list<array{category: string, total: string, count: int}>
     */
    public static function byCategory(Collection $rows): array
    {
        return $rows
            ->groupBy('category')
            ->map(fn (Collection $group, string $category) => [
                'category' => $category,
                'cents' => self::sum($group),
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
     * @param  list<string>  $months
     * @return list<array{month: string, total: string}>
     */
    public static function byMonth(Collection $rows, array $months): array
    {
        $sums = array_fill_keys($months, 0);
        foreach ($rows as $row) {
            if (array_key_exists($row->month, $sums)) {
                $sums[$row->month] += $row->cents;
            }
        }

        $result = [];
        foreach ($sums as $month => $cents) {
            $result[] = ['month' => $month, 'total' => Money::format($cents)];
        }

        return $result;
    }
}
