<?php

use App\Http\Middleware\ForceJsonResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum en modo SPA: cookie de sesión + CSRF para peticiones del frontend.
        $middleware->statefulApi();
        $middleware->prependToGroup('api', ForceJsonResponse::class);
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Toda la API responde JSON con la forma { message, errors? } y sin trazas.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'No autenticado.'], 401);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], $e->status);
            }
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();
            $message = match ($status) {
                401 => 'No autenticado.',
                403 => 'No tienes permiso para esta acción.',
                404 => 'Recurso no encontrado.',
                405 => 'Método no permitido.',
                419 => 'La sesión ha caducado. Recarga la página e inténtalo de nuevo.',
                // 409 y 429 llevan mensajes propios en español desde los servicios.
                409, 429 => $e->getMessage() !== '' && $e->getMessage() !== 'Too Many Attempts.'
                    ? $e->getMessage()
                    : ($status === 409 ? 'La operación no es posible en el estado actual.' : 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'),
                default => $status >= 500 ? 'Error interno del servidor.' : ($e->getMessage() ?: 'Error en la petición.'),
            };

            return response()->json(['message' => $message], $status, $e->getHeaders());
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            // Cualquier otro error no previsto: se registra en el log, pero nunca se exponen trazas ni SQL.
            if ($request->is('api/*') && ! $e instanceof HttpResponseException) {
                return response()->json(['message' => 'Error interno del servidor.'], 500);
            }
        });
    })->create();
