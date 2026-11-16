/**
 * Equipo del taller en la maqueta: cada persona es una figura única, en un solo sitio a la vez.
 * Lógica pura (sin React ni WebGL): se prueba con Vitest.
 *
 *  - El equipo son los miembros del espacio (`GET /members`). Sin esa lista (cargando o error), sale de las personas
 *    asignadas a las órdenes de los elevadores, para no dejar de dibujar a quien está trabajando.
 *  - Una persona «trabaja» si tiene alguna orden en diagnóstico o en reparación. Si tiene varias en elevadores, su
 *    figura va al elevador cuya orden cambió de estado más tarde (la que acaba de empezar); en los demás elevadores
 *    se ve una baliza «Técnico en el elevador N». Si solo las tiene fuera de elevador (en la espera), trabaja, pero
 *    su figura se queda en la zona del equipo.
 *  - Una orden en un elevador sin persona asignada (recibida, en diagnóstico o en reparación) lleva la baliza
 *    «En espera de técnico».
 *  - Quien no tiene ninguna orden en curso queda en la zona del equipo con la etiqueta «Sin orden en curso»:
 *    no sabemos si está en el taller (no hay fichaje), solo que no tiene ninguna orden en marcha.
 */
import type { Bay, WorkOrder, WorkspaceRole } from '@/api/types'
import type { WorkshopCrewMember } from '../../types'
import { ROLE_LABEL } from '@/lib/labels'
import { isBeingWorked } from '@/lib/mechanic'

export type CrewMember = WorkshopCrewMember

export type CrewTask = 'repair' | 'diagnose'

export interface CrewPlacement {
  member: CrewMember
  /** `working`: tiene una orden en diagnóstico o en reparación; `idle`: ninguna orden en curso. */
  status: 'working' | 'idle'
  /** Elevador donde está su figura (`working` con la orden en un elevador); null si no hay elevador. */
  bay: number | null
  /** Orden junto a la que está (o, sin elevador, la que tiene en curso). */
  orderId: number | null
  orderNumber: string | null
  task: CrewTask | null
  /** Otros elevadores con órdenes en curso asignadas a esta persona (su figura no está ahí). */
  otherBays: number[]
  /** Órdenes en curso suyas sin elevador (además de la de `orderId`). */
  offBay: number
}

export type BayBeacon = { kind: 'awaiting_tech' } | { kind: 'tech_elsewhere'; name: string; bay: number }

export interface CrewAssignment {
  /** Una entrada por persona, sin repetidos: primero quien trabaja (por elevador) y después el resto (por nombre). */
  people: CrewPlacement[]
  /** Baliza de cada elevador que la necesita (por número de elevador). */
  beacons: Map<number, BayBeacon>
}

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/** Estados en los que un coche en el elevador espera a alguien si nadie lo tiene asignado. */
const needsTech = (o: WorkOrder) => o.status === 'received' || isBeingWorked(o.status)

/**
 * @param bays elevadores con su orden.
 * @param offBay órdenes abiertas sin elevador (espera y entrega): una orden en reparación fuera del elevador también
 *   cuenta como «orden en curso» de su persona, aunque su figura no tenga un elevador al que ir.
 */
export function assignCrew(members: CrewMember[] | null | undefined, bays: Bay[], offBay: WorkOrder[] = []): CrewAssignment {
  const onBays = bays.flatMap((b) => (b.work_order ? [{ bay: b.number as number | null, order: b.work_order }] : []))
  const loose = offBay.filter((o) => o.bay == null).map((order) => ({ bay: null as number | null, order }))
  const all = [...onBays, ...loose]

  const pool = new Map<number, CrewMember>()
  if (members) for (const m of members) pool.set(m.id, m)
  else
    for (const { order } of all) {
      const who = order.assigned_to
      if (who && isBeingWorked(order.status) && !pool.has(who.id)) pool.set(who.id, { id: who.id, name: who.name, role: null })
    }

  // Órdenes en curso por persona
  const active = new Map<number, { bay: number | null; order: WorkOrder }[]>()
  const beacons = new Map<number, BayBeacon>()
  for (const entry of all) {
    const { bay, order: o } = entry
    const who = o.assigned_to
    if (!who || !pool.has(who.id)) {
      if (bay != null && needsTech(o)) beacons.set(bay, { kind: 'awaiting_tech' })
      continue
    }
    if (!isBeingWorked(o.status)) continue
    const list = active.get(who.id) ?? []
    list.push(entry)
    active.set(who.id, list)
  }

  const people: CrewPlacement[] = []
  for (const member of pool.values()) {
    const list = active.get(member.id)
    if (!list?.length) {
      people.push({ member, status: 'idle', bay: null, orderId: null, orderNumber: null, task: null, otherBays: [], offBay: 0 })
      continue
    }
    // Primero las de elevador (ahí está el coche), y entre ellas la que cambió de estado más tarde
    list.sort((a, b) => Number(a.bay == null) - Number(b.bay == null) || time(b.order.status_changed_at) - time(a.order.status_changed_at) || (a.bay ?? 0) - (b.bay ?? 0))
    const [here, ...rest] = list
    const otherBays: number[] = []
    for (const r of rest) {
      if (r.bay == null) continue
      otherBays.push(r.bay)
      if (here.bay != null) beacons.set(r.bay, { kind: 'tech_elsewhere', name: member.name, bay: here.bay })
    }
    people.push({
      member,
      status: 'working',
      bay: here.bay,
      orderId: here.order.id,
      orderNumber: here.order.number,
      task: here.order.status === 'in_progress' ? 'repair' : 'diagnose',
      otherBays: otherBays.sort((a, b) => a - b),
      offBay: rest.filter((r) => r.bay == null).length,
    })
  }

  people.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'working' ? -1 : 1
    if (a.bay != null && b.bay != null) return a.bay - b.bay
    if (a.bay != null || b.bay != null) return a.bay != null ? -1 : 1
    return a.member.name.localeCompare(b.member.name, 'es') || a.member.id - b.member.id
  })
  return { people, beacons }
}

/** Texto de una baliza (rótulo de la maqueta, vista 2D y lista HTML). */
export function beaconText(b: BayBeacon): string {
  return b.kind === 'awaiting_tech' ? 'En espera de técnico' : `${b.name}: está en el elevador ${b.bay}`
}

export function roleLabel(role: WorkspaceRole | null): string | null {
  return role ? ROLE_LABEL[role] : null
}

/** Qué está haciendo una persona, en una frase corta. */
export function crewStatusText(p: CrewPlacement): string {
  if (p.status === 'idle') return 'Sin orden en curso'
  const what = p.task === 'repair' ? 'Reparando' : 'Diagnosticando'
  const extra: string[] = []
  if (p.otherBays.length) extra.push(`también ${p.otherBays.length === 1 ? 'el' : 'los'} ${p.otherBays.join(', ')}`)
  if (p.offBay) extra.push(`${p.offBay} más sin elevador`)
  const more = extra.length ? ` (${extra.join('; ')})` : ''
  if (p.bay == null) return `${what} ${p.orderNumber ?? ''} sin elevador${more}`.replace('  ', ' ')
  return `${what} en el elevador ${p.bay}${more}`
}
