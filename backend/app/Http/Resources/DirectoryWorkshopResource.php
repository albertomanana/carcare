<?php

namespace App\Http\Resources;

use App\Models\Workspace;
use Illuminate\Http\Request;

/**
 * Taller del directorio (`DirectoryWorkshop`): el nombre del espacio y lo que publica su owner.
 * `is_member` (atributo calculado por DirectoryService) permite a la SPA ocultar "Solicitar".
 */
class DirectoryWorkshopResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var Workspace $workshop */
        $workshop = $this->resource;
        $profile = $workshop->workshopProfile;

        return [
            'id' => $workshop->id,
            'name' => $workshop->name,
            'city' => (string) $profile?->city,
            'address' => $profile?->address,
            'phone' => $profile?->phone,
            'services' => array_values($profile?->services ?? []),
            'opening_hours' => $profile?->opening_hours,
            'is_member' => (bool) $workshop->getAttribute('is_member'),
        ];
    }
}
