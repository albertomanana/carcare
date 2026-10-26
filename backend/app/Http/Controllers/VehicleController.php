<?php

namespace App\Http\Controllers;

use App\Http\Requests\PeriodRequest;
use App\Http\Requests\Vehicle\VehicleIndexRequest;
use App\Http\Requests\Vehicle\VehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use App\Models\Workspace;
use App\Services\JournalService;
use App\Services\ReportService;
use App\Services\SummaryService;
use App\Services\VehicleService;
use App\Services\ZoneService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Vehículos del espacio y sus vistas derivadas (resumen, zonas, diario, informe). */
class VehicleController extends Controller
{
    public function __construct(private readonly VehicleService $vehicles) {}

    public function index(VehicleIndexRequest $request, Workspace $workspace): AnonymousResourceCollection
    {
        $search = trim((string) $request->query('search', ''));

        $query = $workspace->vehicles()
            ->when($request->boolean('archived'), fn (Builder $q) => $q->whereNotNull('archived_at'), fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($request->filled('customer_id'), fn (Builder $q) => $q->where('customer_id', (int) $request->query('customer_id')))
            ->when($search !== '', function (Builder $q) use ($search) {
                $like = '%'.$search.'%';
                $plate = '%'.VehicleRequest::normalizePlate($search).'%';
                $q->where(fn (Builder $w) => $w
                    ->where('make', 'like', $like)
                    ->orWhere('model', 'like', $like)
                    ->orWhere('nickname', 'like', $like)
                    ->orWhere('plate', 'like', $plate)
                    ->orWhere('vin', 'like', $like)
                    ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', $like)));
            });

        match ($request->query('sort', 'recent')) {
            'name' => $query->orderByRaw('COALESCE(nickname, make) asc')->orderBy('model')->orderBy('id'),
            'mileage' => $query->orderByDesc('current_mileage')->orderByDesc('id'),
            default => $query->orderByDesc('created_at')->orderByDesc('id'),
        };

        return VehicleResource::collection(
            $query->with(VehicleResource::eagerLoad())->withCount(VehicleResource::eagerCount())
                ->paginate($this->perPage($request))
        );
    }

    public function store(VehicleRequest $request, Workspace $workspace): JsonResponse
    {
        $vehicle = $this->vehicles->create($workspace, $request->validated());

        return (new VehicleResource($vehicle))->response()->setStatusCode(201);
    }

    public function show(Vehicle $vehicle): VehicleResource
    {
        return new VehicleResource($vehicle);
    }

    public function update(VehicleRequest $request, Vehicle $vehicle): VehicleResource
    {
        return new VehicleResource($this->vehicles->update($vehicle, $request->validated()));
    }

    public function archive(Vehicle $vehicle): VehicleResource
    {
        return new VehicleResource($this->vehicles->archive($vehicle));
    }

    public function restore(Vehicle $vehicle): VehicleResource
    {
        return new VehicleResource($this->vehicles->restore($vehicle));
    }

    /** Solo vehículos archivados (409 si no); borra en cascada su historial y archivos. */
    public function destroy(Vehicle $vehicle): Response
    {
        $this->vehicles->delete($vehicle);

        return $this->noContent();
    }

    /** Resumen y analítica del vehículo. Periodo por defecto: año en curso hasta hoy. */
    public function summary(PeriodRequest $request, Vehicle $vehicle, SummaryService $summaries): JsonResponse
    {
        [$from, $to] = $request->period(fn (CarbonImmutable $to) => $to->startOfYear());

        return $this->data($summaries->forVehicle($vehicle, $from, $to));
    }

    /** Las 10 zonas en el orden del enum (estado según los intervalos del usuario, no medido). */
    public function zones(Vehicle $vehicle, ZoneService $zones): JsonResponse
    {
        return $this->data($zones->forVehicle($vehicle));
    }

    /** Diario día a día. Periodo por defecto: últimos 30 días (hoy incluido). */
    public function journal(PeriodRequest $request, Vehicle $vehicle, JournalService $journal): JsonResponse
    {
        [$from, $to] = $request->period(fn (CarbonImmutable $to) => $to->subDays(29));

        return $this->data($journal->forVehicle($vehicle, $from, $to));
    }

    /** Las lecturas de gastos llegan sin `source_id` para quien no ve gastos (contrato §3.4.1). */
    public function report(Request $request, Vehicle $vehicle, ReportService $reports): JsonResponse
    {
        return $this->data($reports->forVehicle($vehicle, $request->user()->can('manage', $vehicle)));
    }
}
