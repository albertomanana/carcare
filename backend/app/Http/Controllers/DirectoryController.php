<?php

namespace App\Http\Controllers;

use App\Http\Requests\Directory\DirectoryIndexRequest;
use App\Http\Requests\Directory\DirectoryProfileRequest;
use App\Http\Resources\DirectoryProfileResource;
use App\Http\Resources\DirectoryWorkshopResource;
use App\Models\Workspace;
use App\Services\DirectoryService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Directorio de talleres (§3.13.2): búsqueda, ficha pública y perfil que edita el owner. */
class DirectoryController extends Controller
{
    public function __construct(private readonly DirectoryService $directory) {}

    /** GET /workshops: solo `listed = true`, por nombre. */
    public function index(DirectoryIndexRequest $request): AnonymousResourceCollection
    {
        return DirectoryWorkshopResource::collection(
            $this->directory->search($request->user(), $request->search(), $request->service(), $this->perPage($request))
        );
    }

    /** GET /workshops/{id}: 404 si no existe, no es un taller o no está en el directorio (policy). */
    public function show(DirectoryIndexRequest $request, Workspace $workshop): DirectoryWorkshopResource
    {
        return new DirectoryWorkshopResource($this->directory->show($request->user(), $workshop));
    }

    /** GET /workspaces/{ws}/directory-profile (solo talleres). */
    public function profile(Workspace $workspace): DirectoryProfileResource
    {
        return new DirectoryProfileResource($this->directory->profile($workspace));
    }

    /** PUT /workspaces/{ws}/directory-profile: solo el owner. */
    public function updateProfile(DirectoryProfileRequest $request, Workspace $workspace): DirectoryProfileResource
    {
        return new DirectoryProfileResource($this->directory->update($workspace, $request->payload()));
    }
}
