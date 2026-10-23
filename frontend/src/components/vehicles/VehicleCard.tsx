import { Archive, ClipboardList, Gauge, OctagonAlert, Clock, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import type { Vehicle } from '@/api/types'
import { Badge, Plate, StatusPill } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatKm, formatRelativeDate } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { VehicleThumb } from './VehicleVisuals'

/** Tarjeta del garaje / flota. Toda la tarjeta es un enlace a la ficha. */
export function VehicleCard({ vehicle, to, showCustomer }: { vehicle: Vehicle; to: string; showCustomer?: boolean }) {
  const { stats } = vehicle
  const subtitle = [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' · ')
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface transition-[border-color,transform,background-color] duration-200 ease-out-soft',
        'hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2/60',
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-gradient-to-b from-surface-2 to-surface">
        <VehicleThumb vehicle={vehicle} className="absolute inset-0 h-full w-full min-h-0 rounded-none border-0 bg-transparent object-contain p-3" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {vehicle.archived_at && (
            <Badge tone="neutral" icon={<Archive aria-hidden />}>
              Archivado
            </Badge>
          )}
          {stats.open_work_order && <StatusPill status={WORK_ORDER_STATUS[stats.open_work_order.status]} label={`${stats.open_work_order.number} · ${WORK_ORDER_STATUS[stats.open_work_order.status].label}`} />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-lg font-semibold tracking-tight text-fg-warm">{vehicle.display_name}</h3>
            <Plate value={vehicle.plate} className="mt-0.5 shrink-0" />
          </div>
          <p className="truncate text-sm text-fg-muted">{subtitle}</p>
        </div>
        {showCustomer && (
          <p className="flex items-center gap-1.5 text-sm text-fg-muted">
            <UserRound aria-hidden className="size-4 shrink-0 text-fg-subtle" />
            <span className="truncate">{vehicle.customer?.name ?? 'Sin cliente asignado'}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-fg">
            <Gauge aria-hidden className="size-4 text-fg-subtle" />
            <span className="tabular">{formatKm(vehicle.current_mileage, { empty: 'Sin km' })}</span>
            {vehicle.mileage_updated_at && <span className="text-xs text-fg-subtle">· {formatRelativeDate(vehicle.mileage_updated_at)}</span>}
          </span>
        </div>
        {(stats.overdue_reminders > 0 || stats.soon_reminders > 0 || showCustomer) && (
          <div className="flex flex-wrap gap-1.5">
            {stats.overdue_reminders > 0 && (
              <Badge tone="danger" icon={<OctagonAlert aria-hidden />}>
                {stats.overdue_reminders} {stats.overdue_reminders === 1 ? 'vencido' : 'vencidos'}
              </Badge>
            )}
            {stats.soon_reminders > 0 && (
              <Badge tone="warning" icon={<Clock aria-hidden />}>
                {stats.soon_reminders} {stats.soon_reminders === 1 ? 'próximo' : 'próximos'}
              </Badge>
            )}
            {showCustomer && !stats.open_work_order && (
              <Badge tone="neutral" icon={<ClipboardList aria-hidden />}>
                Sin orden abierta
              </Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

export function VehicleCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="skeleton aspect-[16/9]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  )
}
