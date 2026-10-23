<?php

namespace App\Http\Resources;

use DateTimeInterface;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Base de los recursos de la API: las colecciones paginadas devuelven exactamente
 * { data, meta: { current_page, last_page, per_page, total } } (sin `links`).
 */
abstract class ApiResource extends JsonResource
{
    protected static function newCollection($resource): ApiResourceCollection
    {
        return new ApiResourceCollection($resource, static::class);
    }

    /**
     * 200 siempre: el 201 lo fija explícitamente el controlador en los `store`. Laravel, por defecto,
     * respondería 201 a cualquier GET de un modelo con `wasRecentlyCreated` (p. ej. el usuario recién registrado).
     */
    public function toResponse($request)
    {
        return parent::toResponse($request)->setStatusCode(200);
    }

    /** Instante ISO 8601 con zona, o null. */
    protected static function iso(?DateTimeInterface $value): ?string
    {
        return $value?->format(DateTimeInterface::ATOM);
    }

    /** Fecha 'YYYY-MM-DD', o null. */
    protected static function date(?DateTimeInterface $value): ?string
    {
        return $value?->format('Y-m-d');
    }
}
