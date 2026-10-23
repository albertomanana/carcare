/**
 * Qué puede hacer quien mira la lista del equipo con cada miembro (espejo de WorkspaceService en el
 * backend, que es quien decide de verdad):
 *  - gestionar miembros requiere manage (propietario o gerente);
 *  - dar o quitar «propietario» solo lo hace un propietario;
 *  - el último propietario no se puede quitar ni cambiar de rol (409);
 *  - cualquiera puede salir por sí mismo (salvo el último propietario).
 */
import type { ID, Member, WorkspaceRole } from '@/api/types'

export interface MemberPermissions {
  /** Roles que se pueden elegir para este miembro (incluido el actual). Con uno o ninguno no hay menú. */
  roles: WorkspaceRole[]
  canRemove: boolean
  /** Etiqueta visible cuando el miembro está protegido ('Único propietario'). */
  protectedLabel: string | null
  protectedReason: string | null
}

export function memberPermissions({
  actorRole,
  actorId,
  member,
  ownersCount,
}: {
  actorRole: WorkspaceRole
  actorId: ID | null
  member: Member
  ownersCount: number
}): MemberPermissions {
  const isSelf = actorId === member.user.id
  const lastOwner = member.role === 'owner' && ownersCount <= 1
  const actorOwner = actorRole === 'owner'
  const actorManages = actorOwner || actorRole === 'manager'

  let roles: WorkspaceRole[] = []
  if (actorManages && !lastOwner) {
    if (actorOwner) roles = ['owner', 'manager', 'mechanic']
    else if (member.role !== 'owner') roles = ['manager', 'mechanic']
  }

  let canRemove = false
  if (lastOwner) canRemove = false
  else if (isSelf) canRemove = true
  else canRemove = actorManages && (member.role !== 'owner' || actorOwner)

  return {
    roles,
    canRemove,
    protectedLabel: lastOwner ? 'Único propietario' : null,
    protectedReason: lastOwner ? 'No se puede quitar ni cambiar el rol del último propietario: nombra antes a otro propietario.' : null,
  }
}
