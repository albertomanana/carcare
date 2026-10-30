<?php

namespace App\Http\Resources;

use App\Models\Workspace;
use Illuminate\Http\Request;

/** Taller dentro de una solicitud (`DirectoryWorkshopRef`): datos actuales, aunque ya no esté en el directorio. */
class DirectoryWorkshopRefResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var Workspace $workshop */
        $workshop = $this->resource;

        return [
            'id' => $workshop->id,
            'name' => $workshop->name,
            'city' => $workshop->workshopProfile?->city,
            'phone' => $workshop->workshopProfile?->phone,
        ];
    }
}
