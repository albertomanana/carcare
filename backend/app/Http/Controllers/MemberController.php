<?php

namespace App\Http\Controllers;

use App\Enums\WorkspaceRole;
use App\Http\Requests\Workspace\StoreMemberRequest;
use App\Http\Requests\Workspace\UpdateMemberRequest;
use App\Http\Resources\MemberResource;
use App\Models\User;
use App\Models\Workspace;
use App\Services\WorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** /workspaces/{ws}/members: equipo del espacio y sus roles. */
class MemberController extends Controller
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    public function index(Workspace $workspace): AnonymousResourceCollection
    {
        return MemberResource::collection(
            $workspace->members()->orderBy('workspace_user.created_at')->orderBy('users.id')->get()
        );
    }

    public function store(StoreMemberRequest $request, Workspace $workspace): JsonResponse
    {
        $user = $this->workspaces->addMember(
            $workspace,
            $request->validated('email'),
            WorkspaceRole::from($request->validated('role')),
        );

        return (new MemberResource($this->member($workspace, $user)))->response()->setStatusCode(201);
    }

    public function update(UpdateMemberRequest $request, Workspace $workspace, User $user): MemberResource
    {
        $this->workspaces->changeRole($workspace, $request->user(), $user, WorkspaceRole::from($request->validated('role')));

        return new MemberResource($this->member($workspace, $user));
    }

    /** Un gerente puede quitar miembros; cualquiera puede salir por sí mismo. */
    public function destroy(Request $request, Workspace $workspace, User $user): Response
    {
        $this->workspaces->removeMember($workspace, $request->user(), $user);

        return $this->noContent();
    }

    private function member(Workspace $workspace, User $user): User
    {
        return $workspace->members()->whereKey($user->id)->firstOrFail();
    }
}
