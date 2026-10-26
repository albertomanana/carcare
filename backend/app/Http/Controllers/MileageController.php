<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListRequest;
use App\Http\Requests\Vehicle\StoreMileageRequest;
use App\Http\Resources\MileageLogResource;
use App\Models\MileageLog;
use App\Models\Vehicle;
use App\Services\MileageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Lecturas de kilometraje (seguimiento diario). */
class MileageController extends Controller
{
    public function __construct(private readonly MileageService $mileage) {}

    /**
     * Desc por fecha y, a igual fecha, por km. Quien no ve gastos (mechanic) recibe las lecturas
     * `expense` sin `source_id` (contrato §3.4.1, regla 3).
     */
    public function index(ListRequest $request, Vehicle $vehicle): AnonymousResourceCollection
    {
        return MileageLogResource::collectionFor(
            $vehicle->mileageLogs()->latestFirst()->paginate($this->perPage($request)),
            $request->user()->can('manage', $vehicle),
        );
    }

    public function store(StoreMileageRequest $request, Vehicle $vehicle): JsonResponse
    {
        $log = $this->mileage->addManual($vehicle, $request->validated());

        return (new MileageLogResource($log))->response()->setStatusCode(201);
    }

    /** Solo lecturas manuales (409 si no); recalcula el km actual del vehículo. */
    public function destroy(MileageLog $mileageLog): Response
    {
        $this->mileage->deleteManual($mileageLog);

        return $this->noContent();
    }
}
