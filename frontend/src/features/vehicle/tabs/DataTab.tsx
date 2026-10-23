import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Plate } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, DataList } from '@/components/ui/Card'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { formatDate, formatDateTime, formatKm, formatRelativeDate } from '@/lib/format'
import { BODY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'
import { useVehicleOutlet } from '../vehicle-outlet'

const EMPTY = 'Sin indicar'

type Row = { label: ReactNode; value: ReactNode; empty?: boolean }

function row(label: string, value: ReactNode | null | undefined): Row {
  const empty = value === null || value === undefined || value === ''
  return { label, value: empty ? EMPTY : value, empty }
}

/** Ficha técnica: todos los datos guardados del vehículo; lo que falta se dice («Sin indicar»). */
export default function DataTab() {
  const { vehicle: v } = useVehicleOutlet()
  const ctx = useWorkspace()
  const canEdit = ctx.can('operate') && !v.archived_at
  const driven = v.current_mileage !== null && v.purchase_mileage !== null && v.current_mileage >= v.purchase_mileage ? v.current_mileage - v.purchase_mileage : null

  const identity: Row[] = [
    row('Marca', v.make),
    row('Modelo', v.model),
    row('Versión', v.version),
    row('Año', v.year),
    row('Apodo', v.nickname),
    row('Matrícula', v.plate ? <Plate value={v.plate} /> : null),
    row('Número de bastidor (VIN)', v.vin ? <span className="break-all font-mono text-[13px] tracking-wide">{v.vin}</span> : null),
  ]
  const mechanics: Row[] = [
    row('Combustible', v.fuel_type ? FUEL_LABEL[v.fuel_type] : null),
    row('Cambio', v.transmission ? TRANSMISSION_LABEL[v.transmission] : null),
    row('Motor', v.engine),
    row('Carrocería', v.body_type ? BODY_LABEL[v.body_type] : null),
    row(
      'Color',
      v.color_hex ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-4 rounded-full border border-line-strong" style={{ backgroundColor: v.color_hex }} />
          <span className="font-mono text-[13px] uppercase">{v.color_hex}</span>
        </span>
      ) : null,
    ),
  ]
  const usage: Row[] = [
    row('Fecha de compra', v.purchase_date ? `${formatDate(v.purchase_date, 'long')} (${formatRelativeDate(v.purchase_date)})` : null),
    row('Kilómetros al comprarlo', v.purchase_mileage !== null ? <span className="tabular">{formatKm(v.purchase_mileage)}</span> : null),
    row(
      'Kilómetros actuales',
      v.current_mileage !== null ? (
        <span className="tabular">
          {formatKm(v.current_mileage)}
          {v.mileage_updated_at && <span className="text-fg-muted"> · lectura del {formatDate(v.mileage_updated_at)}</span>}
        </span>
      ) : null,
    ),
    {
      label: 'Recorridos desde la compra',
      value: driven !== null ? <span className="tabular">{formatKm(driven)}</span> : 'Faltan los km de compra o los actuales para calcularlo',
      empty: driven === null,
    },
  ]
  const record: Row[] = [
    ...(ctx.isWorkshop
      ? [
          row(
            'Cliente',
            v.customer ? (
              <Link to={`${ctx.base}/clientes/${v.customer.id}`} className="text-accent-ink hover:underline">
                {v.customer.name}
              </Link>
            ) : null,
          ),
        ]
      : []),
    row('Historial', plural(v.stats.records_count, 'intervención', 'intervenciones')),
    row(
      'Recordatorios pendientes',
      v.stats.pending_reminders
        ? `${plural(v.stats.pending_reminders, 'recordatorio', 'recordatorios')}${v.stats.overdue_reminders ? ` · ${plural(v.stats.overdue_reminders, 'vencido', 'vencidos')}` : ''}`
        : 'Ninguno',
    ),
    row('Alta en CarCare', formatDateTime(v.created_at)),
    row('Última modificación', formatDateTime(v.updated_at)),
    ...(v.archived_at ? [row('Archivado', formatDateTime(v.archived_at))] : []),
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted">Datos tal como los guardaste. Lo que no indicaste aparece como «{EMPTY}».</p>
        {canEdit && (
          <ButtonLink to={`${ctx.base}/vehiculos/${v.id}/editar`} icon={<Pencil aria-hidden />}>
            Editar datos
          </ButtonLink>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identificación" />
          <CardBody className="pt-2">
            <DataList items={identity} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Mecánica y aspecto" description="La carrocería y el color deciden el modelo 3D (ilustrativo, sin marcas)." />
          <CardBody className="pt-2">
            <DataList items={mechanics} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Compra y kilometraje" action={<Link to={`${ctx.base}/vehiculos/${v.id}/diario`} className="text-sm font-medium text-accent-ink hover:underline">Lecturas</Link>} />
          <CardBody className="pt-2">
            <DataList items={usage} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Registro" />
          <CardBody className="pt-2">
            <DataList items={record} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
