<?php

namespace App\Http\Controllers;

use App\Http\Requests\Maintenance\MaintenanceIndexRequest;
use App\Http\Requests\Maintenance\MaintenanceRequest;
use App\Http\Resources\MaintenanceRecordResource;
use App\Models\MaintenanceRecord;
use App\Models\Vehicle;
use App\Services\MaintenanceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Historial de intervenciones (mantenimiento, reparaciones, averías…). */
class MaintenanceController extends Controller
{
    public function __construct(private readonly MaintenanceService $maintenance) {}

    /** Orden: service_date desc, desempate mileage desc. Filtros: type, zone, year, search, archived. */
    public function index(MaintenanceIndexRequest $request, Vehicle $vehicle): AnonymousResourceCollection
    {
        $search = trim((string) $request->query('search', ''));

        $records = $vehicle->maintenanceRecords()
            ->when($request->boolean('archived'), fn (Builder $q) => $q->whereNotNull('archived_at'), fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($request->filled('type'), fn (Builder $q) => $q->where('type', $request->query('type')))
            ->when($request->filled('zone'), fn (Builder $q) => $q->where('zone', $request->query('zone')))
            ->when($request->filled('year'), function (Builder $q) use ($request) {
                $year = (int) $request->query('year');
                $q->whereBetween('service_date', ["{$year}-01-01", "{$year}-12-31"]);
            })
            ->when($search !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('title', 'like', "%{$search}%")
                ->orWhere('workshop_name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")))
            ->latestFirst()
            ->with(MaintenanceRecordResource::eagerLoad())
            ->withCount('documents')
            ->paginate($this->perPage($request));

        return MaintenanceRecordResource::collection($records);
    }

    public function store(MaintenanceRequest $request, Vehicle $vehicle): JsonResponse
    {
        $record = $this->maintenance->create($vehicle, $request->validated());

        return (new MaintenanceRecordResource($record))->response()->setStatusCode(201);
    }

    public function show(MaintenanceRecord $maintenanceRecord): MaintenanceRecordResource
    {
        return new MaintenanceRecordResource($maintenanceRecord);
    }

    /** Si llega `items`, reemplaza todas las líneas. */
    public function update(MaintenanceRequest $request, MaintenanceRecord $maintenanceRecord): MaintenanceRecordResource
    {
        return new MaintenanceRecordResource($this->maintenance->update($maintenanceRecord, $request->validated()));
    }

    public function archive(MaintenanceRecord $maintenanceRecord): MaintenanceRecordResource
    {
        return new MaintenanceRecordResource($this->maintenance->archive($maintenanceRecord));
    }

    public function restore(MaintenanceRecord $maintenanceRecord): MaintenanceRecordResource
    {
        return new MaintenanceRecordResource($this->maintenance->restore($maintenanceRecord));
    }
}
