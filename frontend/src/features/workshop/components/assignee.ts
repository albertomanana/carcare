/**
 * Filtro «Mis órdenes» de la pantalla Órdenes (E12‑8), guardado en la URL.
 *
 *  - `?mias=1` / `?mias=0` fuerzan el atajo; sin el parámetro vale lo que toque por rol:
 *    activado para el mecánico, desactivado para propietario y gerente.
 *  - `?mecanico=ID` filtra por otra persona. Solo lo usan quienes ven el selector «Mecánico»
 *    (propietario y gerente); si apunta a uno mismo equivale a «Mis órdenes».
 *
 * El filtro real lo hace la API con `assigned_to` (contrato §3.11).
 */
import type { ID, WorkspaceRole } from '@/api/types'

export interface AssigneeParams {
  mias: string | null
  mecanico: string | null
}

export interface AssigneeContext {
  userId: ID | null
  role: WorkspaceRole
  /** Si quien mira tiene el selector «Mecánico» (propietario y gerente). */
  canPickMechanic: boolean
}

export interface AssigneeFilter {
  /** Valor para `assigned_to` de la API; null = todas. */
  assignedTo: ID | null
  /** true si el filtro es «Mis órdenes». */
  mine: boolean
}

export type AssigneeChoice = 'mine' | 'all' | ID

/** «Mis órdenes» viene activado por defecto solo para el mecánico. */
export function mineByDefault(role: WorkspaceRole): boolean {
  return role === 'mechanic'
}

function toId(value: string | null): ID | null {
  if (!value || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return n > 0 ? n : null
}

export function resolveAssignee(params: AssigneeParams, ctx: AssigneeContext): AssigneeFilter {
  const other = ctx.canPickMechanic ? toId(params.mecanico) : null
  if (other !== null) return { assignedTo: other, mine: other === ctx.userId }
  const wantsMine = params.mias === '1' ? true : params.mias === '0' ? false : mineByDefault(ctx.role)
  if (wantsMine && ctx.userId !== null) return { assignedTo: ctx.userId, mine: true }
  return { assignedTo: null, mine: false }
}

/** Cambios de URL para una elección. Lo que coincide con el valor por defecto del rol no se escribe. */
export function assigneePatch(choice: AssigneeChoice, ctx: AssigneeContext): AssigneeParams {
  const byDefault = mineByDefault(ctx.role)
  if (choice === 'mine' || (typeof choice === 'number' && choice === ctx.userId)) return { mecanico: null, mias: byDefault ? null : '1' }
  if (choice === 'all') return { mecanico: null, mias: byDefault ? '0' : null }
  return { mecanico: String(choice), mias: null }
}
