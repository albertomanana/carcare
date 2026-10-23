<?php

namespace App\Services;

use App\Enums\ReminderState;
use App\Enums\WorkOrderStatus;
use App\Enums\WorkspaceRole;
use App\Http\Resources\ActivityResource;
use App\Http\Resources\ApiResourceCollection;
use App\Http\Resources\ReminderResource;
use App\Http\Resources\VehicleResource;
use App\Http\Resources\WorkOrderResource;
use App\Models\Activity;
use App\Models\Expense;
use App\Models\Reminder;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Support\Dates;
use App\Support\Money;
use App\Support\Totals;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Dashboards del espacio: cabina del particular y centro de control del taller. */
class DashboardService
{
    public function __construct(private readonly WorkOrderService $workOrders) {}

    public function forWorkspace(Workspace $workspace, User $user): array
    {
        return $workspace->isWorkshop()
            ? $this->workshop($workspace, $user->roleIn($workspace))
            : $this->personal($workspace);
    }

    public function personal(Workspace $workspace): array
    {
        $today = CarbonImmutable::today();
        $months = Dates::months($today->startOfMonth()->subMonths(11), $today);
        $expenses = Expense::query()
            ->whereIn('vehicle_id', $workspace->vehicles()->select('id'))
            ->where('expense_date', '>=', $months[0].'-01')
            ->get();

        $reminders = $this->pendingReminders($workspace);

        return [
            'type' => 'personal',
            'vehicles' => VehicleResource::collection(
                $workspace->vehicles()->active()
                    ->with(VehicleResource::eagerLoad())->withCount(VehicleResource::eagerCount())
                    ->orderBy('created_at')->orderBy('id')->get()
            ),
            'spend' => [
                'month' => Money::format(Totals::sumCents($expenses->filter(fn ($e) => $e->expense_date->format('Y-m') === $today->format('Y-m')))),
                'year' => Money::format(Totals::sumCents($expenses->filter(fn ($e) => $e->expense_date->year === $today->year))),
                'by_month' => Totals::byMonth($expenses, $months, fn ($e) => $e->expense_date->format('Y-m')),
            ],
            'reminders' => [
                'overdue' => $this->countState($reminders, ReminderState::Overdue),
                'soon' => $this->countState($reminders, ReminderState::Soon),
                'upcoming' => ReminderResource::agenda($reminders->take(5)),
            ],
            'recent_activity' => $this->recentActivity($workspace),
        ];
    }

    /** El rol mechanic no ve facturación: revenue = null. */
    public function workshop(Workspace $workspace, ?WorkspaceRole $role): array
    {
        $today = CarbonImmutable::today();
        $orders = WorkOrder::query()->where('workspace_id', $workspace->id);
        $reminders = $this->pendingReminders($workspace);

        $byStatus = (clone $orders)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'type' => 'workshop',
            'counts' => [
                'vehicles' => $workspace->vehicles()->active()->count(),
                'customers' => $workspace->customers()->count(),
                'open_orders' => (clone $orders)->open()->count(),
                'late_orders' => (clone $orders)->late()->count(),
                'overdue_reminders' => $this->countState($reminders, ReminderState::Overdue),
            ],
            'orders_by_status' => collect(WorkOrderStatus::cases())
                ->mapWithKeys(fn (WorkOrderStatus $s) => [$s->value => (int) ($byStatus[$s->value] ?? 0)])
                ->all(),
            'bays' => $this->workOrders->bays($workspace)->map(fn (array $bay) => [
                'number' => $bay['number'],
                'work_order' => $bay['work_order'] ? new WorkOrderResource($bay['work_order']) : null,
            ])->all(),
            'due_today' => WorkOrderResource::collection(
                (clone $orders)->open()
                    ->whereBetween('promised_at', [$today->startOfDay(), $today->endOfDay()])
                    ->with(WorkOrder::RESOURCE_RELATIONS)->orderBy('promised_at')->get()
            ),
            'late' => WorkOrderResource::collection(
                (clone $orders)->late()->with(WorkOrder::RESOURCE_RELATIONS)->orderBy('promised_at')->get()
            ),
            'revenue' => $role === WorkspaceRole::Mechanic ? null : $this->revenue($workspace, $today),
            'fleet_alerts' => ReminderResource::agenda(
                $reminders->filter(fn (Reminder $r) => in_array($r->evaluate()['state'], [ReminderState::Overdue, ReminderState::Soon], true))->take(10)
            ),
            'recent_activity' => $this->recentActivity($workspace),
        ];
    }

    /** Facturación = total de las órdenes entregadas, por fecha de entrega. */
    private function revenue(Workspace $workspace, CarbonImmutable $today): array
    {
        $months = Dates::months($today->startOfMonth()->subMonths(11), $today);
        $delivered = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->where('status', WorkOrderStatus::Delivered->value)
            ->where('delivered_at', '>=', CarbonImmutable::parse($months[0].'-01')->startOfDay())
            ->get(['id', 'total', 'delivered_at']);

        return [
            'month' => Money::format(Totals::sumCents($delivered->filter(fn ($o) => $o->delivered_at->format('Y-m') === $today->format('Y-m')), 'total')),
            'year' => Money::format(Totals::sumCents($delivered->filter(fn ($o) => $o->delivered_at->year === $today->year), 'total')),
            'by_month' => Totals::byMonth($delivered, $months, fn ($o) => $o->delivered_at->format('Y-m'), 'total'),
        ];
    }

    /** Recordatorios pendientes de los vehículos activos del espacio, por urgencia. */
    public function pendingReminders(Workspace $workspace): Collection
    {
        return Reminder::sortByUrgency(
            Reminder::query()
                ->where('status', 'pending')
                ->whereIn('vehicle_id', $workspace->vehicles()->active()->select('id'))
                ->with('vehicle')
                ->get()
        );
    }

    private function countState(Collection $reminders, ReminderState $state): int
    {
        return $reminders->filter(fn (Reminder $r) => $r->evaluate()['state'] === $state)->count();
    }

    private function recentActivity(Workspace $workspace): ApiResourceCollection
    {
        return ActivityResource::collection(
            Activity::query()->where('workspace_id', $workspace->id)->with('user')
                ->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get()
        );
    }
}
