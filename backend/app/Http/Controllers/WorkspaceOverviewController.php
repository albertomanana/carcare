<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListRequest;
use App\Http\Requests\PeriodRequest;
use App\Http\Requests\Reminder\ReminderIndexRequest;
use App\Http\Resources\ActivityResource;
use App\Http\Resources\ReminderResource;
use App\Models\Activity;
use App\Models\Reminder;
use App\Models\Workspace;
use App\Services\AnalyticsService;
use App\Services\DashboardService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Pagination\LengthAwarePaginator;

/** Vistas de conjunto de un espacio: dashboard, actividad, agenda de recordatorios y analítica. */
class WorkspaceOverviewController extends Controller
{
    public function dashboard(Request $request, Workspace $workspace, DashboardService $dashboards): JsonResponse
    {
        return $this->data($dashboards->forWorkspace($workspace, $request->user()));
    }

    /** Actividad del espacio, de la más reciente a la más antigua (`?vehicle_id=` opcional). */
    public function activity(ListRequest $request, Workspace $workspace): AnonymousResourceCollection
    {
        $activities = Activity::query()
            ->where('workspace_id', $workspace->id)
            ->when($request->filled('vehicle_id'), fn ($q) => $q->where('vehicle_id', (int) $request->query('vehicle_id')))
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ActivityResource::collection($activities);
    }

    /**
     * Agenda: recordatorios pendientes de los vehículos activos del espacio, con su VehicleRef,
     * ordenados por urgencia (el estado se calcula al vuelo, por eso se pagina en memoria).
     */
    public function reminders(ReminderIndexRequest $request, Workspace $workspace, DashboardService $dashboards): AnonymousResourceCollection
    {
        $reminders = $dashboards->pendingReminders($workspace);

        if ($request->filled('state')) {
            $state = $request->query('state');
            $reminders = $reminders->filter(fn (Reminder $r) => $r->evaluate()['state']?->value === $state)->values();
        }

        $perPage = $this->perPage($request);
        $page = max(1, (int) $request->query('page', '1'));
        $paginator = new LengthAwarePaginator(
            $reminders->forPage($page, $perPage)->map(fn (Reminder $r) => (new ReminderResource($r))->withVehicle())->values(),
            $reminders->count(),
            $perPage,
            $page,
            ['path' => $request->url()],
        );

        return ReminderResource::collection($paginator);
    }

    /** Solo manage (el mecánico recibe 403). Por defecto, los últimos 12 meses. */
    public function analytics(PeriodRequest $request, Workspace $workspace, AnalyticsService $analytics): JsonResponse
    {
        [$from, $to] = $request->period(fn (CarbonImmutable $to) => $to->startOfMonth()->subMonths(11));

        return $this->data($analytics->forWorkspace($workspace, $from, $to));
    }
}
