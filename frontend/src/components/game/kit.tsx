import { ArrowLeft, ChevronRight, Inbox } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { Breadcrumbs, type Crumb } from '@/components/ui/Breadcrumbs'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { paintVars } from '@/lib/colors'
import type { Tone } from '@/lib/status'

/**
 * Piezas del mundo «Diorama» para las pantallas del particular. Todo lo que pintan viene de la API: nada de puntos ni
 * niveles (regla 2). Los componentes de `components/ui` no se tocan; esto los compone.
 */

/**
 * Cabecera tipo HUD: un panel de cristal con migas, la ficha (`leading`), el título, la línea de estado, las insignias y
 * las acciones. Sustituye a `PageHeader` en las pantallas del particular.
 */
export function HudHeader({
  title,
  description,
  crumbs,
  back,
  leading,
  chips,
  actions,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  /** Enlace de vuelta (pantallas de segundo nivel sin migas). */
  back?: { to: string; label: string }
  leading?: ReactNode
  chips?: ReactNode
  actions?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <header className={cn('hud-panel mb-5 p-4 sm:p-5', className)}>
      {crumbs ? (
        <Breadcrumbs items={crumbs} className="mb-2" />
      ) : (
        back && (
          <Link to={back.to} className="mb-2 inline-flex min-h-12 w-fit items-center gap-1.5 text-sm font-bold text-fg-muted hover:text-fg lg:min-h-0">
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )
      )}
      {/* El bloque del título pide al menos 15 rem: si las acciones no caben a su lado, bajan a su propia línea en vez de aplastarlo */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_15rem] items-center gap-3.5 sm:gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-fg-warm md:text-3xl">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted md:text-base">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {chips && <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div>}
      {children}
    </header>
  )
}

/** Ficha cuadrada con la pintura real del vehículo (única parte de la interfaz donde vive ese color). */
export function PaintToken({ color, children, size = 'md', className }: { color: string | null; children: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      style={paintVars(color) as CSSProperties}
      className={cn('clay grid shrink-0 place-items-center rounded-xl', size === 'sm' ? 'size-9 [&_svg]:size-5' : size === 'md' ? 'size-12 [&_svg]:size-6' : 'size-16 rounded-2xl [&_svg]:size-8', className)}
    >
      {children}
    </span>
  )
}

/**
 * Panel con título de sección: sustituye a `Section` + `list-panel`. `flush` deja el contenido sin relleno (listas con
 * filas que ya llevan el suyo).
 */
export function GamePanel({
  title,
  description,
  action,
  icon,
  children,
  className,
  flush,
  id,
  as: As = 'section',
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
  id?: string
  as?: 'section' | 'div' | 'aside'
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <As id={id} aria-labelledby={headingId} className={cn('hud-panel min-w-0 overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink [&_svg]:size-4">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 id={headingId} className="truncate font-display text-base font-bold text-fg-warm md:text-lg">
              {title}
            </h2>
            {description && <p className="text-xs text-fg-muted">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2 text-sm">{action}</div>}
      </div>
      <div className={cn(flush ? 'pb-1' : 'px-4 pb-4 pt-1 sm:px-5 sm:pb-5')}>{children}</div>
    </As>
  )
}

/** Enlace de acción de una cabecera de panel («Ver la agenda →»). */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 font-bold text-accent-ink underline-offset-4 hover:underline">
      {children}
      <ChevronRight aria-hidden className="size-4" />
    </Link>
  )
}

/**
 * Cifra de un panel de cifras: etiqueta, número grande con tabulares y, opcionalmente, barra segmentada y nota. Si el dato
 * no existe (`value` null) dice por qué (`missing`) y ofrece la acción que lo resuelve; nunca un cero inventado.
 */
export function StatTile({
  label,
  value,
  unit,
  note,
  progress,
  tone = 'accent',
  progressLabel,
  missing,
  action,
  loading,
  className,
}: {
  label: string
  value: ReactNode | null
  unit?: ReactNode
  note?: ReactNode
  /** 0..1 */
  progress?: number | null
  tone?: Tone
  progressLabel?: string
  /** Motivo por el que falta el dato. */
  missing?: ReactNode
  action?: ReactNode
  loading?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 p-4', className)}>
      <p className="tag-label text-fg-muted">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : value !== null && value !== undefined ? (
        <div>
          <p className="tabular flex items-baseline gap-1.5 whitespace-nowrap text-2xl font-bold leading-8 text-fg-warm md:text-[1.75rem]">
            {value}
            {unit && <span className="text-sm font-medium text-fg-muted">{unit}</span>}
          </p>
          {progress !== undefined && progress !== null && <Progress value={progress} tone={tone} label={progressLabel ?? label} className="mt-2" />}
          {note && <p className="mt-1.5 text-xs text-fg-muted">{note}</p>}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          {missing ?? 'Sin datos todavía.'}
          {action && <span className="ml-1.5 inline-block">{action}</span>}
        </p>
      )}
    </div>
  )
}

/** Fila de cifras: varias `StatTile` en un panel, separadas por una línea fina. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('hud-panel grid overflow-hidden sm:grid-cols-3 sm:[&>*+*]:border-l sm:[&>*+*]:border-line max-sm:[&>*+*]:border-t max-sm:[&>*+*]:border-line', className)}>
      {children}
    </div>
  )
}

/**
 * Estado vacío con ilustración: una plataforma isométrica de maqueta con un bloque azul encima (el icono del asunto), el
 * título, la explicación y **una acción clara**.
 */
export function EmptyBoard({
  icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('hud-panel flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <span aria-hidden className="relative block h-28 w-40">
        <svg viewBox="0 0 160 112" className="absolute inset-0 size-full" fill="none">
          <ellipse cx="80" cy="98" rx="64" ry="11" fill="hsl(var(--shadow-color))" opacity="0.14" />
          <path d="M18 84 L80 108 L80 100 L18 76 Z" fill="var(--line-strong)" opacity="0.55" />
          <path d="M142 84 L80 108 L80 100 L142 76 Z" fill="var(--line-strong)" opacity="0.35" />
          <path d="M80 52 L142 76 L80 100 L18 76 Z" fill="var(--surface-2)" stroke="var(--line)" />
        </svg>
        <span className="absolute left-1/2 top-2.5 grid size-14 -translate-x-1/2 place-items-center rounded-control bg-accent text-on-accent shadow-[0_14px_20px_-8px_hsl(var(--shadow-color)/0.45)] [&_svg]:size-7">
          {icon ?? <Inbox />}
        </span>
      </span>
      <div className="max-w-md">
        <h2 className="font-display text-lg font-bold text-fg-warm">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}
