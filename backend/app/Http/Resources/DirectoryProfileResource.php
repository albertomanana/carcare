<?php

namespace App\Http\Resources;

use App\Models\WorkshopProfile;
use Illuminate\Http\Request;

/** Perfil del directorio de un taller (`DirectoryProfile`). `updated_at` es null si nunca se guardó. */
class DirectoryProfileResource extends ApiResource
{
    public function toArray(Request $request): array
    {
        /** @var WorkshopProfile $profile */
        $profile = $this->resource;

        return [
            'workspace_id' => $profile->workspace_id,
            'listed' => (bool) $profile->listed,
            'city' => $profile->city,
            'address' => $profile->address,
            'phone' => $profile->phone,
            'services' => array_values($profile->services ?? []),
            'opening_hours' => $profile->opening_hours,
            'updated_at' => $profile->exists ? self::iso($profile->updated_at) : null,
        ];
    }
}
