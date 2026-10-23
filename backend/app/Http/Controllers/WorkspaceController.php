<?php

namespace App\Http\Controllers;

use App\Http\Requests\Workspace\StoreWorkspaceRequest;
use App\Http\Requests\Workspace\UpdateWorkspaceRequest;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use App\Services\WorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** /workspaces: espacios del usuario (personal + talleres). */
class WorkspaceController extends Controller
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return WorkspaceResource::collection($this->workspaces->forUser($request->user()));
    }

    /** Siempre crea un taller; quien lo crea es su owner. */
    public function store(StoreWorkspaceRequest $request): JsonResponse
    {
        $workspace = $this->workspaces->createWorkshop($request->user(), $request->validated('name'));

        return (new WorkspaceResource($workspace))->response()->setStatusCode(201);
    }

    public function show(Workspace $workspace): WorkspaceResource
    {
        return new WorkspaceResource($workspace);
    }

    public function update(UpdateWorkspaceRequest $request, Workspace $workspace): WorkspaceResource
    {
        return new WorkspaceResource($this->workspaces->update($workspace, $request->validated()));
    }

    /** Solo talleres y solo su owner (409 en el espacio personal). */
    public function destroy(Workspace $workspace): Response
    {
        $this->workspaces->delete($workspace);

        return $this->noContent();
    }
}
