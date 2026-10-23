import {
  CalendarClock,
  Car,
  ChartColumn,
  ClipboardList,
  Gauge,
  type LucideIcon,
  MonitorSmartphone,
  Settings,
  SquareKanban,
  Users,
  Warehouse,
  UsersRound,
} from 'lucide-react'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** true ⇒ activo solo en coincidencia exacta. */
  end?: boolean
  /** En la barra inferior móvil (máx. 4). */
  mobile?: boolean
}

export function navItems(ctx: WorkspaceContextValue | null): NavItem[] {
  if (!ctx) return [{ to: '/app/ajustes', label: 'Ajustes', icon: Settings }]
  const { base, isWorkshop } = ctx
  const canManage = ctx.can('manage')
  if (isWorkshop) {
    return [
      { to: base, label: 'Centro de control', icon: MonitorSmartphone, end: true, mobile: true },
      { to: `${base}/ordenes`, label: 'Órdenes', icon: SquareKanban, mobile: true },
      { to: `${base}/clientes`, label: 'Clientes', icon: UsersRound, mobile: true },
      { to: `${base}/garaje`, label: 'Vehículos', icon: Car },
      { to: `${base}/taller`, label: 'Taller 3D', icon: Warehouse },
      { to: `${base}/agenda`, label: 'Agenda de flota', icon: CalendarClock },
      { to: `${base}/equipo`, label: 'Equipo', icon: Users },
      ...(canManage ? [{ to: `${base}/analitica`, label: 'Facturación', icon: ChartColumn }] : []),
    ]
  }
  return [
    { to: base, label: 'Cabina', icon: Gauge, end: true, mobile: true },
    { to: `${base}/garaje`, label: 'Garaje', icon: Car, mobile: true },
    { to: `${base}/agenda`, label: 'Agenda', icon: CalendarClock, mobile: true },
    ...(canManage ? [{ to: `${base}/analitica`, label: 'Analítica', icon: ChartColumn }] : []),
  ]
}

export const SETTINGS_ITEM: NavItem = { to: '/app/ajustes', label: 'Ajustes', icon: Settings }
export const ORDERS_ICON = ClipboardList
