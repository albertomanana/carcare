<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Base de los controladores de la API. Los controladores son delgados: la autorización va en
 * la ruta (`can:` → policies), la validación en Form Requests y las reglas en app/Services.
 */
abstract class Controller
{
    public const PER_PAGE = 25;

    public const MAX_PER_PAGE = 100;

    /** `per_page` del contrato: 25 por defecto, recortado a 1…$max. */
    protected function perPage(Request $request, int $max = self::MAX_PER_PAGE): int
    {
        $perPage = (int) $request->query('per_page', (string) self::PER_PAGE);

        return max(1, min($perPage, $max));
    }

    /** `{ data: ... }` para cargas que no son un único modelo (dashboards, resúmenes, zonas…). */
    protected function data(mixed $payload, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $payload], $status);
    }

    protected function noContent(): Response
    {
        return response()->noContent();
    }
}
