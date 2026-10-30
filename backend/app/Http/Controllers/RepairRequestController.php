<?php

namespace App\Http\Controllers;

use App\Http\Requests\RepairRequest\AcceptRepairRequestRequest;
use App\Http\Requests\RepairRequest\QuoteDecisionRequest;
use App\Http\Requests\RepairRequest\RejectRepairRequestRequest;
use App\Http\Requests\RepairRequest\RepairQuoteRequest;
use App\Http\Requests\RepairRequest\RepairRequestIndexRequest;
use App\Http\Requests\RepairRequest\StoreRepairRequestRequest;
use App\Http\Requests\RepairRequest\UpdateRepairRequestRequest;
use App\Http\Resources\RepairRequestResource;
use App\Models\RepairRequest;
use App\Models\Workspace;
use App\Services\RepairRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Solicitudes de reparación (contrato §3.13). La autorización va en la ruta: `RepairRequestPolicy`
 * (tercero ⇒ 404; la otra parte o el mecánico ⇒ 403) y `WorkspacePolicy` para el listado y el alta.
 */
class RepairRequestController extends Controller
{
    public function __construct(private readonly RepairRequestService $requests) {}

    /** En personal, las enviadas; en un taller, las recibidas. */
    public function index(RepairRequestIndexRequest $request, Workspace $workspace): AnonymousResourceCollection
    {
        return RepairRequestResource::collection($this->requests->list(
            $workspace, $request->statuses(), $request->workOrderId(), $this->perPage($request),
        ));
    }

    /** 201 con status = pending. 429 a partir de la 6.ª en 24 h; 409 si la pareja vehículo‑taller ya tiene una abierta. */
    public function store(StoreRepairRequestRequest $request, Workspace $workspace): JsonResponse
    {
        $created = $this->requests->create($workspace, $request->user(), $request->vehicle(), $request->workshop(), $request->payload());

        return (new RepairRequestResource($created))->response()->setStatusCode(201);
    }

    public function show(RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($repairRequest);
    }

    /** Dar o retirar el consentimiento del historial (409 si está cerrada). */
    public function update(UpdateRepairRequestRequest $request, RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->updateShareHistory($repairRequest, $request->boolean('share_history')));
    }

    public function cancel(RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->cancel($repairRequest));
    }

    public function accept(AcceptRepairRequestRequest $request, RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->accept($repairRequest, $request->quote()));
    }

    public function reject(RejectRepairRequestRequest $request, RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->reject($repairRequest, $request->validated('reason')));
    }

    /** 201 con la versión nueva la primera en `quotes`. */
    public function sendQuote(RepairQuoteRequest $request, RepairRequest $repairRequest): JsonResponse
    {
        $updated = $this->requests->sendQuote($repairRequest, $request->validated());

        return (new RepairRequestResource($updated))->response()->setStatusCode(201);
    }

    /** Conversión en orden (§3.13.6): status = converted y work_order. */
    public function acceptQuote(QuoteDecisionRequest $request, RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->acceptQuote($repairRequest, $request->quoteId()));
    }

    /** La solicitud vuelve a `accepted`. */
    public function rejectQuote(QuoteDecisionRequest $request, RepairRequest $repairRequest): RepairRequestResource
    {
        return new RepairRequestResource($this->requests->rejectQuote($repairRequest, $request->quoteId(), $request->reason()));
    }

    /** `{ data: SharedHistoryEntry[] }` · 403 si `history_available = false`. */
    public function history(RepairRequest $repairRequest): JsonResponse
    {
        return $this->data($this->requests->history($repairRequest)->values()->all());
    }
}
