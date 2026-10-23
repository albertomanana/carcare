<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/** GET /api/v1/health: comprobación de vida para el frontend y los scripts de arranque. */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['status' => 'ok']);
    }
}
