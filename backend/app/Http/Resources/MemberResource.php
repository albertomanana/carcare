<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Miembro de un espacio: usuario cargado desde Workspace::members() (con pivote). */
class MemberResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'user' => [
                'id' => $this->id,
                'name' => $this->name,
                'email' => $this->email,
            ],
            'role' => $this->pivot->role,
            'joined_at' => self::iso($this->pivot->created_at),
        ];
    }
}
