import { describe, expect, it } from 'vitest'
import { assigneePatch, resolveAssignee, type AssigneeContext } from './assignee'

const mechanic: AssigneeContext = { userId: 7, role: 'mechanic', canPickMechanic: false }
const manager: AssigneeContext = { userId: 3, role: 'manager', canPickMechanic: true }
const owner: AssigneeContext = { userId: 1, role: 'owner', canPickMechanic: true }
const none = { mias: null, mecanico: null }

describe('resolveAssignee («Mis órdenes»)', () => {
  it('el mecánico ve sus órdenes por defecto', () => {
    expect(resolveAssignee(none, mechanic)).toEqual({ assignedTo: 7, mine: true })
  })

  it('el mecánico puede ver las de todos con ?mias=0', () => {
    expect(resolveAssignee({ mias: '0', mecanico: null }, mechanic)).toEqual({ assignedTo: null, mine: false })
  })

  it('propietario y gerente ven todas por defecto y las suyas con ?mias=1', () => {
    expect(resolveAssignee(none, owner)).toEqual({ assignedTo: null, mine: false })
    expect(resolveAssignee(none, manager)).toEqual({ assignedTo: null, mine: false })
    expect(resolveAssignee({ mias: '1', mecanico: null }, manager)).toEqual({ assignedTo: 3, mine: true })
  })

  it('?mecanico filtra por otra persona solo si quien mira tiene el selector', () => {
    expect(resolveAssignee({ mias: null, mecanico: '7' }, owner)).toEqual({ assignedTo: 7, mine: false })
    expect(resolveAssignee({ mias: null, mecanico: '1' }, owner)).toEqual({ assignedTo: 1, mine: true })
    // El mecánico no tiene selector: un ?mecanico antiguo en la URL no le cambia el filtro
    expect(resolveAssignee({ mias: null, mecanico: '3' }, mechanic)).toEqual({ assignedTo: 7, mine: true })
  })

  it('ignora valores que no son un id', () => {
    expect(resolveAssignee({ mias: null, mecanico: 'abc' }, owner)).toEqual({ assignedTo: null, mine: false })
    expect(resolveAssignee({ mias: 'x', mecanico: '0' }, mechanic)).toEqual({ assignedTo: 7, mine: true })
  })

  it('sin usuario no hay «Mis órdenes»', () => {
    expect(resolveAssignee(none, { ...mechanic, userId: null })).toEqual({ assignedTo: null, mine: false })
  })
})

describe('assigneePatch (URL)', () => {
  it('no escribe en la URL lo que ya es el valor por defecto del rol', () => {
    expect(assigneePatch('mine', mechanic)).toEqual({ mecanico: null, mias: null })
    expect(assigneePatch('all', owner)).toEqual({ mecanico: null, mias: null })
  })

  it('escribe lo que se aparta del valor por defecto', () => {
    expect(assigneePatch('all', mechanic)).toEqual({ mecanico: null, mias: '0' })
    expect(assigneePatch('mine', manager)).toEqual({ mecanico: null, mias: '1' })
  })

  it('elegirse a uno mismo en el selector equivale a «Mis órdenes»', () => {
    expect(assigneePatch(3, manager)).toEqual({ mecanico: null, mias: '1' })
    expect(assigneePatch(7, manager)).toEqual({ mecanico: '7', mias: null })
  })

  it('ida y vuelta: lo que se escribe se vuelve a leer igual', () => {
    for (const ctx of [mechanic, manager, owner]) {
      for (const choice of ['mine', 'all', 9] as const) {
        const params = assigneePatch(choice, ctx)
        const filter = resolveAssignee(params, ctx)
        if (choice === 'mine') expect(filter).toEqual({ assignedTo: ctx.userId, mine: true })
        else if (choice === 'all') expect(filter).toEqual({ assignedTo: null, mine: false })
        else if (ctx.canPickMechanic) expect(filter).toEqual({ assignedTo: 9, mine: false })
      }
    }
  })
})
