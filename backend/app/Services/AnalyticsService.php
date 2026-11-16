<?php

namespace App\Services;

use App\Enums\WorkOrderStatus;
use App\Http\Resources\CustomerRefResource;
use App\Http\Resources\ExpenseResource;
use App\Http\Resources\VehicleRefResource;
use App\Models\Expense;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Support\Dates;
use App\Support\Money;
use App\Support\Totals;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Analítica del espacio (permiso manage).
 * Particular: gasto total (solo de `expenses`, D3-A). Taller: facturación de órdenes entregadas.
 */
class AnalyticsService
{
    public function forWorkspace(Workspace $workspace, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $months = Dates::months($from, $to);

        return $workspace->isWorkshop()
            ? $this->workshop($workspace, $from, $to, $months)
            : $this->personal($workspace, $from, $to, $months);
    }

    /**
     * Detalle de un mes (contrato §4.1): total, comparación con el mes anterior y los cargos uno a uno.
     * Particular: los gastos del mes, cada uno con su vehículo y su origen. Taller: las órdenes entregadas ese mes.
     */
    public function month(Workspace $workspace, CarbonImmutable $month): array
    {
        $from = $month->startOfMonth();
        $to = $from->endOfMonth();
        $prevFrom = $from->subMonthNoOverflow()->startOfMonth();
        $prevTo = $prevFrom->endOfMonth();

        if ($workspace->isWorkshop()) {
            $delivered = fn (CarbonImmutable $a, CarbonImmutable $b) => WorkOrder::query()
                ->where('workspace_id', $workspace->id)
                ->where('status', WorkOrderStatus::Delivered->value)
                ->whereBetween('delivered_at', [$a->startOfDay(), $b->endOfDay()]);
            $orders = $delivered($from, $to)->with(['vehicle', 'customer'])->orderByDesc('delivered_at')->orderByDesc('id')->get();
            $total = Totals::sumCents($orders, 'total');
            $previous = Totals::sumCents($delivered($prevFrom, $prevTo)->get(['id', 'total']), 'total');
            $byCategory = [];
            $expenses = [];
            $orderRows = $orders->map(fn (WorkOrder $o) => [
                'id' => $o->id,
                'number' => $o->number,
                'title' => $o->title,
                'total' => $o->total,
                'delivered_at' => $o->delivered_at->toIso8601String(),
                'vehicle' => new VehicleRefResource($o->vehicle),
                'customer' => $o->customer === null ? null : new CustomerRefResource($o->customer),
            ])->all();
        } else {
            $inMonth = fn (CarbonImmutable $a, CarbonImmutable $b) => Expense::query()
                ->whereIn('vehicle_id', $workspace->vehicles()->select('id'))
                ->whereBetween('expense_date', [$a->toDateString(), $b->toDateString()]);
            $rows = $inMonth($from, $to)->with(['vehicle', ...ExpenseResource::eagerLoad()])->orderByDesc('expense_date')->orderByDesc('id')->get();
            $total = Totals::sumCents($rows);
            $previous = Totals::sumCents($inMonth($prevFrom, $prevTo)->get(['id', 'amount']));
            $byCategory = Totals::byCategory($rows);
            $expenses = $rows->map(fn (Expense $e) => (new ExpenseResource($e))->withVehicle())->all();
            $orderRows = [];
        }

        return [
            'month' => $from->format('Y-m'),
            'total' => Money::format($total),
            'previous' => ['month' => $prevFrom->format('Y-m'), 'total' => Money::format($previous)],
            'change_pct' => $previous === 0 ? null : round(($total - $previous) / $previous * 100, 1),
            'by_category' => $byCategory,
            'expenses' => $expenses,
            'orders' => $orderRows,
        ];
    }

    private function personal(Workspace $workspace, CarbonImmutable $from, CarbonImmutable $to, array $months): array
    {
        $expenses = Expense::query()
            ->whereIn('vehicle_id', $workspace->vehicles()->select('id'))
            ->whereBetween('expense_date', [$from->toDateString(), $to->toDateString()])
            ->with('vehicle')
            ->get();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'total' => Money::format(Totals::sumCents($expenses)),
            'by_month' => Totals::byMonth($expenses, $months, fn (Expense $e) => $e->expense_date->format('Y-m')),
            'by_vehicle' => $this->byVehicle($expenses, 'amount'),
            'by_category' => Totals::byCategory($expenses),
            'workshop' => null,
        ];
    }

    private function workshop(Workspace $workspace, CarbonImmutable $from, CarbonImmutable $to, array $months): array
    {
        $orders = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->where('status', WorkOrderStatus::Delivered->value)
            ->whereBetween('delivered_at', [$from->startOfDay(), $to->endOfDay()])
            ->with(['vehicle', 'customer'])
            ->get();

        $total = Totals::sumCents($orders, 'total');
        $count = $orders->count();
        $avgHours = $count > 0
            ? $orders->avg(fn (WorkOrder $o) => $o->received_at->diffInMinutes($o->delivered_at) / 60)
            : null;

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'total' => Money::format($total),
            'by_month' => Totals::byMonth($orders, $months, fn (WorkOrder $o) => $o->delivered_at->format('Y-m'), 'total'),
            'by_vehicle' => $this->byVehicle($orders, 'total'),
            'by_category' => [],
            'workshop' => [
                'orders_delivered' => $count,
                'avg_ticket' => $count > 0 ? Money::format(intdiv($total * 2 + $count, $count * 2)) : null,
                'avg_days_in_shop' => $avgHours === null ? null : round($avgHours / 24, 1),
                'by_customer' => $orders->whereNotNull('customer_id')
                    ->groupBy('customer_id')
                    ->map(fn (Collection $group) => [
                        'customer' => new CustomerRefResource($group->first()->customer),
                        'cents' => Totals::sumCents($group, 'total'),
                        'orders' => $group->count(),
                    ])
                    ->sortByDesc('cents')
                    ->map(fn (array $row) => [
                        'customer' => $row['customer'],
                        'total' => Money::format($row['cents']),
                        'orders' => $row['orders'],
                    ])
                    ->values()
                    ->all(),
            ],
        ];
    }

    /** Total por vehículo, de mayor a menor. */
    private function byVehicle(Collection $items, string $field): array
    {
        return $items->groupBy('vehicle_id')
            ->map(fn (Collection $group) => [
                'vehicle' => new VehicleRefResource($group->first()->vehicle),
                'cents' => Totals::sumCents($group, $field),
            ])
            ->sortByDesc('cents')
            ->map(fn (array $row) => ['vehicle' => $row['vehicle'], 'total' => Money::format($row['cents'])])
            ->values()
            ->all();
    }
}
