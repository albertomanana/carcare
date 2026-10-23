<?php

namespace App\Casts;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Fecha sin hora. Se guarda siempre como 'Y-m-d' (el cast 'date' de Eloquent guarda
 * 'Y-m-d 00:00:00', que en SQLite rompe las comparaciones de texto con 'Y-m-d').
 *
 * @implements CastsAttributes<CarbonImmutable|null, mixed>
 */
class DateOnly implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonImmutable
    {
        return $value === null ? null : CarbonImmutable::parse(substr((string) $value, 0, 10))->startOfDay();
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof DateTimeInterface
            ? $value->format('Y-m-d')
            : CarbonImmutable::parse((string) $value)->format('Y-m-d');
    }
}
