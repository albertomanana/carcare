<?php

namespace App\Http\Requests\Workspace;

use App\Enums\WorkspaceRole;
use App\Http\Requests\ApiRequest;
use Illuminate\Validation\Rule;

/** PATCH /workspaces/{ws}/members/{user}: `{ role }`. */
class UpdateMemberRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'role' => ['required', Rule::enum(WorkspaceRole::class)],
        ];
    }
}
