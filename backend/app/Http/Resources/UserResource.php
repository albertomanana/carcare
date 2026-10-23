<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** @mixin \App\Models\User */
class UserResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'locale' => $this->locale ?? 'es',
            'created_at' => self::iso($this->created_at),
        ];
    }
}
