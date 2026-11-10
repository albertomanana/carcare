import { Archive, Clock, OctagonAlert } from "lucide-react";
import { Link } from "react-router";
import type { Vehicle } from "@/api/types";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Tilt } from "@/components/ui/Tilt";
import { paintVars } from "@/lib/colors";
import { formatKm, formatPlate, formatRelativeDate } from "@/lib/format";
import { WORK_ORDER_STATUS } from "@/lib/status";
import { BrandLogo } from "./BrandLogo";
import { VehicleThumb } from "./VehicleVisuals";

/**
 * Tarjeta del garaje / flota. Toda la tarjeta es un enlace a la ficha. Imagen + 3 líneas (5.5 del informe de UX):
 * nombre · matrícula, modelo · año, km y avisos. Píldora solo para lo vencido o próximo y para "Archivado" (R5);
 * la orden abierta y el cliente (taller) van como texto.
 */
export function VehicleCard({
  vehicle,
  to,
  showCustomer,
}: {
  vehicle: Vehicle;
  to: string;
  showCustomer?: boolean;
}) {
  const { stats } = vehicle;
  const subtitle = [
    vehicle.nickname ? `${vehicle.make} ${vehicle.model}` : vehicle.version,
    vehicle.year,
  ]
    .filter(Boolean)
    .join(" · ");
  const order = stats.open_work_order;
  return (
    <Tilt max={7} className="rounded-card">
    <Link
      to={to}
      style={paintVars(vehicle.color_hex) as CSSProperties}
      className="surface-card group flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line transition-colors duration-200 hover:border-line-strong"
    >
      {/* Carta de muestra: la pintura del coche con su nombre; debajo, el coche en la cabina */}
      <div className="lacquer flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{vehicle.display_name}</p>
          {subtitle && <p className="truncate text-sm opacity-80">{subtitle}</p>}
        </div>
        {/* decorativo: el nombre de la marca ya está en el texto */}
        <BrandLogo make={vehicle.make} className="mt-1 size-6 opacity-80" />
      </div>
      <div className="relative aspect-[16/8] overflow-hidden bg-[radial-gradient(110%_80%_at_50%_100%,color-mix(in_srgb,var(--paint)_16%,var(--surface-2)),var(--surface)_70%)] [&>*]:transition-transform [&>*]:duration-500 [&>*]:ease-out-soft group-hover:[&>*]:scale-[1.04]">
        <VehicleThumb
          vehicle={vehicle}
          className="absolute inset-0 h-full w-full min-h-0 rounded-none border-0 bg-transparent object-contain p-3"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="tag-label text-fg-muted">{vehicle.plate ? formatPlate(vehicle.plate) : "Sin matrícula"}</p>
        {showCustomer && (
          <p className="truncate text-sm text-fg-muted">
            {vehicle.customer?.name ?? "Sin cliente asignado"}
          </p>
        )}
        {showCustomer && order && (
          <p className="truncate text-sm text-fg-muted">
            {order.number} · {WORK_ORDER_STATUS[order.status].label}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-sm">
          <span className="text-fg tabular">
            {formatKm(vehicle.current_mileage, { empty: "Sin km" })}
            {vehicle.mileage_updated_at && (
              <span className="text-fg-subtle">
                {" "}
                · {formatRelativeDate(vehicle.mileage_updated_at)}
              </span>
            )}
          </span>
          {vehicle.archived_at && (
            <Badge tone="neutral" size="sm" icon={<Archive aria-hidden />}>
              Archivado
            </Badge>
          )}
          {stats.overdue_reminders > 0 && (
            <Badge tone="danger" size="sm" icon={<OctagonAlert aria-hidden />}>
              {stats.overdue_reminders}{" "}
              {stats.overdue_reminders === 1 ? "vencido" : "vencidos"}
            </Badge>
          )}
          {stats.soon_reminders > 0 && (
            <Badge tone="warning" size="sm" icon={<Clock aria-hidden />}>
              {stats.soon_reminders}{" "}
              {stats.soon_reminders === 1 ? "próximo" : "próximos"}
            </Badge>
          )}
        </div>
      </div>
    </Link>
    </Tilt>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div
      aria-hidden
      className="surface-card overflow-hidden rounded-card border border-line"
    >
      <div className="skeleton aspect-[16/9]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}
