<?php

namespace App\Support;

/**
 * Frase de actividad con el autor según el tipo de espacio (contrato §3.12, hallazgo M5 de UX):
 *  - `workshop`: empieza por el nombre de quien lo hizo ⇒ "Ana registró 54.000 km en Kia Sportage".
 *  - `personal`: segunda persona y sin nombre (solo hay una persona) ⇒ "Anotaste 54.000 km en Kia Sportage".
 *
 * ActivityLogger elige la forma al guardar, porque es quien sabe en qué espacio se registra.
 */
final class ActivityPhrase
{
    /**
     * @param  string  $verb  Tercera persona, tras el nombre: "registró".
     * @param  string  $you  Segunda persona, al principio de la frase: "Anotaste".
     * @param  string  $rest  Lo que sigue al verbo: "54.000 km en Kia Sportage".
     */
    private function __construct(
        public readonly string $verb,
        public readonly string $you,
        public readonly string $rest,
    ) {}

    public static function of(string $verb, string $you, string $rest): self
    {
        return new self($verb, $you, $rest);
    }

    public function render(bool $personal, string $actor): string
    {
        return $personal
            ? self::capitalize($this->you).' '.$this->rest
            : $actor.' '.$this->verb.' '.$this->rest;
    }

    private static function capitalize(string $text): string
    {
        return mb_strtoupper(mb_substr($text, 0, 1)).mb_substr($text, 1);
    }
}
