import {
  CalendarClock,
  Car,
  ChartColumn,
  ClipboardList,
  House,
  Inbox,
  type LucideIcon,
  Settings,
  SquareKanban,
  Store,
  Users,
  Warehouse,
  UsersRound,
} from 'lucide-react'
import type { WorkspaceContextValue } from '@/features/workspace/workspace-context'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Qué hay en la sección, en una frase: tooltip con la barra estrecha, hoja "Más" del móvil y paleta. */
  description?: string
  /** Otras palabras con las que se busca en la paleta (nombres antiguos incluidos: "centro de control", "taller 3d"). */
  keywords?: string
  /** true ⇒ activo solo en coincidencia exacta. */
  end?: boolean
  /** Otras rutas que también marcan la sección como activa (la ficha de un vehículo pertenece al Garaje). */
  also?: string[]
  /** En la barra inferior móvil (máx. 3 + "Registrar" + "Más"). */
  mobile?: boolean
  /** Texto corto para la barra inferior cuando el nombre no cabe. */
  mobileLabel?: string
}

/** Grupo de la barra lateral. Sin `label`, el grupo va arriba sin encabezado. */
export interface NavGroup {
  id: string
  label: string | null
  items: NavItem[]
}

/**
 * Secciones del espacio, agrupadas por tarea (10/11/2026, "más intuitiva"): el taller tenía 9 entradas planas. Ninguna
 * lleva a una pantalla vacía (hallazgo C2): Analítica solo sale para quien puede verla (`manage`).
 * 11/11/2026: en el taller, "Inicio" y "Taller" se fusionan en una sola portada, "Taller" (la maqueta con su HUD), en `base`; `/taller` redirige.
 */
export function navGroups(ctx: WorkspaceContextValue | null): NavGroup[] {
  if (!ctx) return [{ id: 'cuenta', label: null, items: [SETTINGS_ITEM] }]
  const { base, isWorkshop } = ctx
  const canManage = ctx.can('manage')
  if (isWorkshop) {
    return [
      {
        id: 'dia',
        label: 'Día a día',
        items: [
          {
            to: base,
            label: 'Taller',
            icon: Warehouse,
            end: true,
            mobile: true,
            description: 'La maqueta del taller con sus elevadores, la flota y lo que va tarde',
            keywords: 'inicio centro de control panel resumen taller 3d elevadores nave maqueta flota',
          },
          {
            to: `${base}/ordenes`,
            label: 'Órdenes',
            icon: SquareKanban,
            mobile: true,
            description: 'El tablero de trabajos, de la entrada a la entrega',
            keywords: 'tablero kanban ot trabajos',
          },
          {
            to: `${base}/solicitudes`,
            label: 'Solicitudes',
            icon: Inbox,
            description: 'Reparaciones que te piden particulares desde CarCare',
            keywords: 'peticiones presupuestos particulares',
          },
        ],
      },
      {
        id: 'clientes',
        label: 'Clientes y vehículos',
        items: [
          { to: `${base}/clientes`, label: 'Clientes', icon: UsersRound, mobile: true, description: 'Fichas de clientes con sus vehículos y órdenes' },
          {
            to: `${base}/garaje`,
            label: 'Vehículos',
            icon: Car,
            also: [`${base}/vehiculos`],
            description: 'Todos los vehículos que atiende el taller',
            keywords: 'flota coches matrícula',
          },
          {
            to: `${base}/agenda`,
            label: 'Agenda',
            icon: CalendarClock,
            description: 'ITV, revisiones y avisos de los vehículos de tus clientes',
            keywords: 'agenda de flota recordatorios vencimientos',
          },
        ],
      },
      {
        id: 'gestion',
        label: 'Gestión',
        items: [
          { to: `${base}/equipo`, label: 'Equipo', icon: Users, description: 'Quién trabaja en el taller y con qué permisos', keywords: 'mecánicos roles invitar' },
          ...(canManage
            ? [{ to: `${base}/analitica`, label: 'Analítica', icon: ChartColumn, description: 'Importes de las órdenes entregadas y tiempos en el taller', keywords: 'ingresos estadísticas' }]
            : []),
        ],
      },
    ]
  }
  return [
    {
      id: 'coche',
      label: null,
      items: [
        { to: base, label: 'Inicio', icon: House, end: true, mobile: true, description: 'Lo que toca y las cifras del mes' },
        {
          to: `${base}/garaje`,
          label: 'Garaje',
          icon: Car,
          mobile: true,
          also: [`${base}/vehiculos`],
          description: 'Tus vehículos y la ficha de cada uno',
          keywords: 'coches vehículos',
        },
        { to: `${base}/agenda`, label: 'Agenda', icon: CalendarClock, mobile: true, description: 'Revisiones, ITV y seguros, por fecha o por kilómetros', keywords: 'recordatorios avisos' },
        ...(canManage ? [{ to: `${base}/analitica`, label: 'Analítica', icon: ChartColumn, description: 'Cuánto gastas y en qué', keywords: 'gastos estadísticas' }] : []),
      ],
    },
    {
      id: 'talleres',
      label: 'Talleres',
      items: [
        { to: `${base}/talleres`, label: 'Buscar taller', icon: Store, description: 'Talleres de CarCare a los que pedir una reparación', keywords: 'directorio talleres presupuesto' },
        { to: `${base}/solicitudes`, label: 'Mis solicitudes', icon: Inbox, description: 'Las reparaciones que has pedido y sus presupuestos', keywords: 'solicitudes presupuestos' },
      ],
    },
  ]
}

/** Todas las secciones en orden, sin grupos (barra inferior y paleta). */
export function navItems(ctx: WorkspaceContextValue | null): NavItem[] {
  return navGroups(ctx).flatMap((g) => g.items)
}

/** ¿Está activa la sección? Igual que NavLink (prefijo de ruta o exacta con `end`) más sus rutas `also`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  const under = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
  if (item.end ? path === item.to : under(item.to)) return true
  return !!item.also?.some(under)
}

export const SETTINGS_ITEM: NavItem = { to: '/app/ajustes', label: 'Ajustes', icon: Settings, description: 'Tu cuenta, el tema y tus espacios' }
export const ORDERS_ICON = ClipboardList
