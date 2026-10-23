<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ApiResourceCollection extends AnonymousResourceCollection
{
    /** Sustituye links/meta de Laravel por el PageMeta del contrato. */
    public function paginationInformation(Request $request, array $paginated, array $default): array
    {
        return [
            'meta' => [
                'current_page' => $paginated['current_page'],
                'last_page' => $paginated['last_page'],
                'per_page' => (int) $paginated['per_page'],
                'total' => $paginated['total'],
            ],
        ];
    }
}
