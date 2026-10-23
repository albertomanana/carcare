<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Services\WorkspaceService;
use Illuminate\Http\Request;

/** `Me`: el usuario autenticado y sus espacios de trabajo (con su rol en cada uno). */
class MeResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var User $user */
        $user = $this->resource;

        return [
            'user' => new UserResource($user),
            'workspaces' => WorkspaceResource::collection(app(WorkspaceService::class)->forUser($user)),
        ];
    }
}
