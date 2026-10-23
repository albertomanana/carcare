<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/** 409: la operación choca con el estado actual del recurso. El mensaje se muestra tal cual. */
class ConflictException extends HttpException
{
    public function __construct(string $message)
    {
        parent::__construct(409, $message);
    }
}
