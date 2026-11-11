import { Archive, CarFront, Clock, OctagonAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { Vehicle } from '@/api/types'
import { PaintToken } from '@/components/game/kit'
import { Chip } from '@/components/ui/Hud'
import { paintVars } from '@/lib/colors'
import { formatKm, formatPlate, formatRelativeDate } from '@/lib/format'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { plural } from '@/lib/text'
import { BrandLogo } from './BrandLogo'
import { VehicleThumb } from './VehicleVisuals'

/**
 * Tarjeta del garaje / flota (mundo «Diorama»): una ficha que sube al pasar el ratón. Arriba, la ficha de pintura con el
 * nombre y la matrícula; en medio, la miniatura estática del coche sobre una plataforma (nunca un WebGL por tarjeta);
 * abajo, los km y lo vencido o próximo con icono y texto. Toda la tarjeta es un enlace a la ficha.
 */
export function VehicleCard({ vehicle, to, showCustomer }: { vehicle: Vehicle; to: string; showCustomer?: boolean }) {
  const { stats } = vehicle
  const subtitle = [vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : vehicle.version, vehicle.year].filter(Boolean).join(' · ')
  const order = stats.open_work_order
  return (
    <Link to={to} style={paintVars(vehicle.color_hex) as CSSProperties} className="surface-card lift group flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line">
      <div className="flex items-center gap-3 p-4 pb-2">
        <PaintToken color={vehicle.color_hex} size="md">
          <CarFront />
        </PaintToken>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight text-fg-warm">{vehicle.display_name}</p>
          <p className="truncate text-sm text-fg-muted">
            <span className="tag-label">{vehicle.plate ? formatPlate(vehicle.plate) : 'Sin matrícula'}</span>
            {subtitle && <span> · {subtitle}</span>}
          </p>
        </div>
        {/* decorativo: el nombre de la marca ya está en el texto */}
        <BrandLogo make={vehicle.make} className="size-6 shrink-0 text-fg-subtle opacity-80" />
      </div>
      <div className="relative mx-3 aspect-[16/8] overflow-hidden rounded-xl bg-[radial-gradient(90%_60%_at_50%_100%,color-mix(in_srgb,var(--accent)_10%,var(--surface-2)),var(--surface-2)_75%)] [&>*]:transition-transform [&>*]:duration-500 [&>*]:ease-out-soft group-hover:[&>*]:scale-[1.04]">
        <VehicleThumb vehicle={vehicle} className="absolute inset-0 h-full w-full min-h-0 rounded-none border-0 bg-transparent object-contain p-3" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 pt-3">
        {showCustomer && <p className="truncate text-sm text-fg-muted">{vehicle.customer?.name ?? 'Sin cliente asignado'}</p>}
        {showCustomer && order && (
          <p className="truncate text-sm text-fg-muted">
            {order.number} · {WORK_ORDER_STATUS[order.status].label}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1 text-sm">
          <span className="tabular font-bold text-fg">
            {formatKm(vehicle.current_mileage, { empty: 'Sin km' })}
            {vehicle.mileage_updated_at && <span className="font-normal text-fg-subtle"> · {formatRelativeDate(vehicle.mileage_updated_at)}</span>}
          </span>
          {vehicle.archived_at && (
            <Chip icon={<Archive aria-hidden />}>Archivado</Chip>
          )}
          {stats.overdue_reminders > 0 && (
            <Chip tone="danger" icon={<OctagonAlert aria-hidden />}>
              {plural(stats.overdue_reminders, 'vencido', 'vencidos')}
            </Chip>
          )}
          {stats.soon_reminders > 0 && (
            <Chip tone="warning" icon={<Clock aria-hidden />}>
              {plural(stats.soon_reminders, 'próximo', 'próximos')}
            </Chip>
          )}
        </div>
      </div>
    </Link>
  )
}

export function VehicleCardSkeleton() {
  return (
    <div aria-hidden className="surface-card overflow-hidden rounded-card border border-line">
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="skeleton size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton mx-3 aspect-[16/8] rounded-xl" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-1/3 rounded" />
      </div>
    </div>
  )
}
