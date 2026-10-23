<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** Referencia breve a un cliente (CustomerRef). @mixin \App\Models\Customer */
class CustomerRefResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
        ];
    }
}
