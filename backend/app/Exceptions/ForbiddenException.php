<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * 403 con un mensaje propio que se muestra tal cual (p. ej. "El cliente no comparte su historial con el
 * taller.", §3.13.7). El resto de 403 de la API dicen siempre "No tienes permiso para esta acción.".
 */
class ForbiddenException extends HttpException
{
    public function __construct(string $message)
    {
        parent::__construct(403, $message);
    }
}
