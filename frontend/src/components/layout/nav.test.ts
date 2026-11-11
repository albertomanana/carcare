import { describe, expect, it } from 'vitest'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'
import { isNavItemActive, navGroups, navItems } from './nav'

const ctx = (isWorkshop: boolean, manage = true) =>
  ({ base: '/app/3', isWorkshop, isPersonal: !isWorkshop, can: (a: string) => a !== 'manage' || manage }) as unknown as WorkspaceContextValue

describe('navGroups', () => {
  it('el taller agrupa sus secciones por tarea, con los nombres nuevos', () => {
    const groups = navGroups(ctx(true))
    expect(groups.map((g) => g.label)).toEqual(['Día a día', 'Clientes y vehículos', 'Gestión'])
    expect(groups[0].items.map((i) => i.label)).toEqual(['Inicio', 'Órdenes', 'Taller', 'Solicitudes'])
    expect(navItems(ctx(true)).every((i) => i.description)).toBe(true)
  })

  it('sin permiso de gestión no sale Analítica', () => {
    expect(navItems(ctx(true, false)).map((i) => i.label)).not.toContain('Analítica')
  })

  it('el particular lleva tres secciones en la barra inferior', () => {
    expect(navItems(ctx(false)).filter((i) => i.mobile).map((i) => i.label)).toEqual(['Inicio', 'Garaje', 'Agenda'])
  })

  it('la paleta encuentra las secciones por su nombre antiguo', () => {
    const items = navItems(ctx(true))
    expect(items.find((i) => i.keywords?.includes('centro de control'))?.label).toBe('Inicio')
    expect(items.find((i) => i.keywords?.includes('taller 3d'))?.label).toBe('Taller')
  })
})

describe('isNavItemActive', () => {
  const [inicio, garaje] = navItems(ctx(false))

  it('Inicio solo en su ruta exacta', () => {
    expect(isNavItemActive(inicio, '/app/3')).toBe(true)
    expect(isNavItemActive(inicio, '/app/3/')).toBe(true)
    expect(isNavItemActive(inicio, '/app/3/garaje')).toBe(false)
  })

  it('la ficha de un vehículo y sus formularios marcan Garaje', () => {
    expect(isNavItemActive(garaje, '/app/3/garaje')).toBe(true)
    expect(isNavItemActive(garaje, '/app/3/vehiculos/12/gastos')).toBe(true)
    expect(isNavItemActive(garaje, '/app/3/vehiculos/nuevo')).toBe(true)
    expect(isNavItemActive(garaje, '/app/3/vehiculosx')).toBe(false)
  })
})
