<?php

namespace App\Enums;

/**
 * Rol de un miembro dentro de un espacio de trabajo y sus capacidades (contrato §2).
 *   view/operate: todos · manage: owner y manager · own: solo owner.
 */
enum WorkspaceRole: string
{
    use EnumHelpers;

    case Owner = 'owner';
    case Manager = 'manager';
    case Mechanic = 'mechanic';

    public const VIEW = 'view';
    public const OPERATE = 'operate';
    public const MANAGE = 'manage';
    public const OWN = 'own';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Propietario',
            self::Manager => 'Gerente',
            self::Mechanic => 'Mecánico',
        };
    }

    public function allows(string $capability): bool
    {
        return match ($capability) {
            self::VIEW, self::OPERATE => true,
            self::MANAGE => $this === self::Owner || $this === self::Manager,
            self::OWN => $this === self::Owner,
            default => false,
        };
    }
}
