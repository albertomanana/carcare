<?php

namespace App\Http\Controllers\Workshop;

use App\Enums\WorkOrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkOrder\ChangeStatusRequest;
use App\Http\Requests\WorkOrder\WorkOrderIndexRequest;
use App\Http\Requests\WorkOrder\WorkOrderRequest;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkOrder;
use App\Models\Workspace;
use App\Services\WorkOrderService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Órdenes de trabajo del taller y elevadores. */
class WorkOrderController extends Controller
{
    /** El tablero kanban pide todas las órdenes abiertas de una vez. */
    public const MAX_PER_PAGE = 200;

    public function __construct(private readonly WorkOrderService $orders) {}

    public function index(WorkOrderIndexRequest $request, Workspace $workspace): AnonymousResourceCollection
    {
        $statuses = $request->statuses();
        $search = trim((string) $request->query('search', ''));

        $orders = WorkOrder::query()
            ->where('workspace_id', $workspace->id)
            ->when($statuses !== null, function (Builder $q) use ($statuses) {
                $wanted = in_array('open', $statuses, true)
                    ? array_values(array_unique([...array_diff($statuses, ['open']), ...array_diff(WorkOrderStatus::values(), WorkOrderStatus::finalValues())]))
                    : $statuses;
                $q->whereIn('status', $wanted);
            })
            ->when($request->filled('vehicle_id'), fn (Builder $q) => $q->where('vehicle_id', (int) $request->query('vehicle_id')))
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', (int) $request->query('customer_id')))
            ->when($request->filled('assigned_to'), fn (Builder $q) => $q->where('assigned_to', (int) $request->query('assigned_to')))
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('number', 'like', "%{$search}%")
                ->orWhere('title', 'like', "%{$search}%")
                ->orWhereHas('vehicle', fn (Builder $v) => $v->where('plate', 'like', '%'.strtoupper(str_replace([' ', '-'], '', $search)).'%'))
                ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$search}%"))))
            ->with(WorkOrder::RESOURCE_RELATIONS)
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($request, self::MAX_PER_PAGE));

        return WorkOrderResource::collection($orders);
    }

    /** status = received, received_at = ahora, cliente copiado del vehículo. */
    public function store(WorkOrderRequest $request, Workspace $workspace): JsonResponse
    {
        $order = $this->orders->create($workspace, $request->payload());

        return (new WorkOrderResource($order))->response()->setStatusCode(201);
    }

    public function show(WorkOrder $workOrder): WorkOrderResource
    {
        return new WorkOrderResource($workOrder);
    }

    /** 409 si está entregada o cancelada. */
    public function update(WorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        return new WorkOrderResource($this->orders->update($workOrder, $request->payload()));
    }

    /** Solo en received o cancelled (409 si no). */
    public function destroy(WorkOrder $workOrder): Response
    {
        $this->orders->delete($workOrder);

        return $this->noContent();
    }

    /** Cambio de estado del tablero; `bay` opcional (null libera el elevador). */
    public function status(ChangeStatusRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        return new WorkOrderResource(
            $this->orders->changeStatus($workOrder, $request->status(), $request->bayProvided(), $request->bay())
        );
    }

    /** Elevadores 1…bays_count con su orden abierta. */
    public function bays(Workspace $workspace): JsonResponse
    {
        return $this->data(
            $this->orders->bays($workspace)->map(fn (array $bay) => [
                'number' => $bay['number'],
                'work_order' => $bay['work_order'] ? new WorkOrderResource($bay['work_order']) : null,
            ])->values()->all()
        );
    }
}
