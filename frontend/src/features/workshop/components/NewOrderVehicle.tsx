import { CircleAlert, ClipboardList, Plus, TriangleAlert, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Link } from 'react-router'
import { useVehicle, useVehicles } from '@/api/hooks/vehicles'
import { useCustomer, useCustomerSearch } from '@/api/hooks/workshop'
import type { BodyType, Vehicle } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input, SearchInput, Select } from '@/components/ui/inputs'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { formatKm } from '@/lib/format'
import { BODY_LABEL } from '@/lib/labels'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { plural } from '@/lib/text'
import { normalizePlate } from '@/lib/validation'
import { CarThumbnail } from '@/three'
import { type CustomerMode, type NewOrderValues, QUICK_COLORS } from './newOrderForm'

const BODY_TYPES = Object.keys(BODY_LABEL) as BodyType[]
type Form = UseFormReturn<NewOrderValues>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
      <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  )
}

/** Aviso si el vehículo ya tiene una orden abierta (se puede abrir otra si es un trabajo distinto). */
function OpenOrderNotice({ vehicle }: { vehicle: Vehicle }) {
  const ctx = useWorkspace()
  const open = vehicle.stats.open_work_order
  if (!open) return null
  return (
    <p className="flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-fg">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>
        Ya tiene abierta la{' '}
        <Link to={`${ctx.base}/ordenes/${open.id}`} className="font-medium underline">
          {open.number}
        </Link>{' '}
        ({WORK_ORDER_STATUS[open.status].label.toLowerCase()}
        {open.bay ? `, elevador ${open.bay}` : ''}). Abre otra solo si es un trabajo distinto.
      </span>
    </p>
  )
}

function VehicleLine({ vehicle }: { vehicle: Vehicle }) {
  return (
    <>
      <CarThumbnail appearance={{ bodyType: vehicle.body_type, colorHex: vehicle.color_hex }} alt="" className="h-10 w-16 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-fg">{vehicle.display_name}</span>
          {vehicle.plate && <Plate value={vehicle.plate} className="h-5 text-[10px]" />}
        </span>
        <span className="block truncate text-xs text-fg-muted">
          {[vehicle.customer?.name ?? 'Sin cliente', formatKm(vehicle.current_mileage, { empty: 'sin km' })].join(' · ')}
          {vehicle.stats.open_work_order && ` · ${vehicle.stats.open_work_order.number} abierta`}
        </span>
      </span>
    </>
  )
}

/** Paso «Vehículo»: uno del taller (buscador) o alta rápida de cliente + vehículo. */
export function VehicleSection({ form, presetCustomerId }: { form: Form; presetCustomerId: string | null }) {
  const mode = useWatch({ control: form.control, name: 'vehicle_mode' })
  const setMode = (m: NewOrderValues['vehicle_mode']) => form.setValue('vehicle_mode', m, { shouldDirty: true })
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="¿Qué coche entra?"
        block
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'existing', label: 'Ya está en el taller' },
          { value: 'new', label: 'Coche nuevo', icon: <Plus aria-hidden /> },
        ]}
      />
      {mode === 'existing' ? (
        <ExistingVehiclePicker
          form={form}
          presetCustomerId={presetCustomerId}
          onCreateNew={(plate, customerId) => {
            if (plate) form.setValue('plate', plate, { shouldDirty: true })
            if (customerId) {
              form.setValue('customer_mode', 'existing', { shouldDirty: true })
              form.setValue('customer_id', customerId, { shouldDirty: true })
            }
            setMode('new')
          }}
        />
      ) : (
        <NewVehicleFields form={form} />
      )}
    </div>
  )
}

function ExistingVehiclePicker({ form, presetCustomerId, onCreateNew }: { form: Form; presetCustomerId: string | null; onCreateNew: (plate: string | null, customerId: string | null) => void }) {
  const ctx = useWorkspace()
  const vehicleId = useWatch({ control: form.control, name: 'vehicle_id' })
  const selected = useVehicle(vehicleId ? Number(vehicleId) : undefined)
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term)
  const [customerFilter, setCustomerFilter] = useState(presetCustomerId)
  const filterCustomer = useCustomer(customerFilter ? Number(customerFilter) : undefined)
  const results = useVehicles(ctx.id, { search: debounced.trim() || undefined, per_page: 6, sort: 'recent', customer_id: customerFilter || undefined }, !vehicleId)
  const error = form.formState.errors.vehicle_id?.message
  const choose = (id: string) => form.setValue('vehicle_id', id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })

  if (vehicleId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-card border border-accent/50 bg-accent-soft/40 p-3">
          {selected.isPending ? (
            <div className="flex flex-1 items-center gap-3" role="status">
              <span className="sr-only">Cargando vehículo…</span>
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : selected.isError || !selected.data ? (
            <p className="flex-1 text-sm text-danger">No se pudo cargar el vehículo elegido. Elige otro.</p>
          ) : (
            <VehicleLine vehicle={selected.data} />
          )}
          <Button size="sm" onClick={() => choose('')}>
            Cambiar
          </Button>
        </div>
        {selected.data && <OpenOrderNotice vehicle={selected.data} />}
        {selected.data && selected.data.workspace_id !== ctx.id && <FieldError message="Este vehículo no es de este taller." />}
      </div>
    )
  }

  const list = results.data?.data ?? []
  const plateLike = /^[A-Z0-9]{4,12}$/.test(normalizePlate(debounced)) && /\d/.test(debounced)

  return (
    <div className="space-y-2">
      <SearchInput
        value={term}
        onValueChange={setTerm}
        aria-label="Buscar vehículo por matrícula, marca, modelo, VIN o cliente"
        placeholder="Matrícula, marca, modelo o cliente…"
        aria-invalid={!!error || undefined}
      />
      {customerFilter && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <UserRound aria-hidden className="size-4 text-fg-subtle" />
          Vehículos de <span className="font-medium text-fg">{filterCustomer.data?.name ?? 'este cliente'}</span>
          <button type="button" onClick={() => setCustomerFilter(null)} className="inline-flex min-h-9 items-center gap-1 rounded-control px-2 text-xs font-medium text-accent-ink hover:underline">
            <X aria-hidden className="size-3.5" />
            Ver todos
          </button>
        </p>
      )}
      <div className="overflow-hidden rounded-card border border-line">
        {results.isPending ? (
          <div role="status" className="space-y-px">
            <span className="sr-only">Buscando vehículos…</span>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} aria-hidden className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-16" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : results.isError ? (
          <div className="flex flex-wrap items-center gap-2 p-3 text-sm text-danger">
            No se pudo buscar.
            <Button size="sm" onClick={() => void results.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="space-y-2 p-4 text-sm text-fg-muted">
            <p>
              {debounced.trim()
                ? `Ningún vehículo coincide con «${debounced.trim()}».`
                : customerFilter
                  ? 'Este cliente aún no tiene vehículos en el taller.'
                  : 'Aún no hay vehículos en el taller.'}
            </p>
            <Button size="sm" icon={<Plus aria-hidden />} onClick={() => onCreateNew(plateLike ? normalizePlate(debounced) : null, customerFilter)}>
              {plateLike ? `Dar de alta ${normalizePlate(debounced)}` : 'Dar de alta un coche nuevo'}
            </Button>
          </div>
        ) : (
          <ul aria-label="Vehículos encontrados">
            {list.map((v) => (
              <li key={v.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => choose(String(v.id))}
                  aria-label={`Elegir ${v.display_name}${v.plate ? `, matrícula ${v.plate}` : ''}`}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <VehicleLine vehicle={v} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {results.data && results.data.meta.total > list.length && (
        <p className="text-xs text-fg-subtle">
          Mostrando {list.length} de {plural(results.data.meta.total, 'vehículo', 'vehículos')}: afina la búsqueda para encontrar el tuyo.
        </p>
      )}
      <FieldError message={error} />
    </div>
  )
}

function NewVehicleFields({ form }: { form: Form }) {
  const { register, formState } = form
  const e = formState.errors
  return (
    <div className="space-y-5">
      <CustomerChooser form={form} />
      <div className="space-y-4">
        <p className="text-sm font-medium text-fg">Vehículo</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" required error={e.make?.message}>
            <Input autoComplete="off" maxLength={60} placeholder="P. ej. Seat" {...register('make')} />
          </Field>
          <Field label="Modelo" required error={e.model?.message}>
            <Input autoComplete="off" maxLength={80} placeholder="P. ej. León" {...register('model')} />
          </Field>
          <Field label="Matrícula" error={e.plate?.message} hint="Se guarda en mayúsculas y sin espacios.">
            <Input autoComplete="off" maxLength={15} className="font-mono uppercase tracking-wider" {...register('plate')} />
          </Field>
          <Field label="Carrocería" error={e.body_type?.message} hint="Para su miniatura y el taller 3D.">
            <Select {...register('body_type')}>
              <option value="">Sin indicar</option>
              {BODY_TYPES.map((b) => (
                <option key={b} value={b}>
                  {BODY_LABEL[b]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Color" error={e.color_hex?.message}>
            <Select {...register('color_hex')}>
              <option value="">Sin indicar</option>
              {QUICK_COLORS.map((c) => (
                <option key={c.hex} value={c.hex}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-fg-subtle">El resto de datos (año, combustible, VIN…) se completan después en la ficha del vehículo.</p>
      </div>
    </div>
  )
}

const CUSTOMER_OPTIONS: { value: CustomerMode; label: string }[] = [
  { value: 'existing', label: 'Existente' },
  { value: 'new', label: 'Nuevo' },
  { value: 'none', label: 'Sin cliente' },
]

function CustomerChooser({ form }: { form: Form }) {
  const ctx = useWorkspace()
  const { register, formState, setValue } = form
  const [mode, customerId] = useWatch({ control: form.control, name: ['customer_mode', 'customer_id'] })
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term)
  const selected = useCustomer(mode === 'existing' && customerId ? Number(customerId) : undefined)
  const results = useCustomerSearch(ctx.id, debounced.trim(), mode === 'existing' && !customerId)
  const e = formState.errors
  const choose = (id: string) => setValue('customer_id', id, { shouldDirty: true, shouldValidate: formState.isSubmitted })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-fg">Cliente</p>
        <SegmentedControl label="Cliente del vehículo" size="sm" value={mode} onValueChange={(m) => setValue('customer_mode', m, { shouldDirty: true })} options={CUSTOMER_OPTIONS} />
      </div>
      {mode === 'new' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre" required error={e.customer_name?.message} className="sm:col-span-3">
            <Input autoComplete="off" maxLength={120} {...register('customer_name')} />
          </Field>
          <Field label="Teléfono" error={e.customer_phone?.message} className="sm:col-span-1">
            <Input type="tel" inputMode="tel" autoComplete="off" maxLength={30} className="tabular" {...register('customer_phone')} />
          </Field>
          <Field label="Email" error={e.customer_email?.message} className="sm:col-span-2">
            <Input type="email" autoComplete="off" maxLength={255} {...register('customer_email')} />
          </Field>
        </div>
      )}
      {mode === 'none' && <p className="text-sm text-fg-muted">El vehículo quedará sin cliente. Puedes asignárselo más tarde desde su ficha.</p>}
      {mode === 'existing' &&
        (customerId ? (
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
            <UserRound aria-hidden className="size-5 shrink-0 text-fg-subtle" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{selected.data?.name ?? (selected.isError ? 'No se pudo cargar el cliente' : 'Cargando cliente…')}</p>
              {selected.data && (
                <p className="truncate text-xs text-fg-muted">{[selected.data.phone, plural(selected.data.vehicles_count, 'vehículo', 'vehículos')].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <Button size="sm" onClick={() => choose('')}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <SearchInput value={term} onValueChange={setTerm} aria-label="Buscar cliente por nombre, email, teléfono o NIF" placeholder="Nombre, teléfono, email o NIF…" />
            <div className="max-h-64 overflow-y-auto rounded-card border border-line">
              {results.isPending ? (
                <p className="p-3 text-sm text-fg-muted" role="status">
                  Buscando…
                </p>
              ) : results.isError ? (
                <p className="p-3 text-sm text-danger">No se pudo buscar. {results.error.message}</p>
              ) : results.data.data.length === 0 ? (
                <div className="space-y-2 p-3 text-sm text-fg-muted">
                  <p>{debounced.trim() ? `Ningún cliente coincide con «${debounced.trim()}».` : 'Aún no hay clientes.'}</p>
                  <Button
                    size="sm"
                    icon={<Plus aria-hidden />}
                    onClick={() => {
                      if (debounced.trim()) setValue('customer_name', debounced.trim(), { shouldDirty: true })
                      setValue('customer_mode', 'new', { shouldDirty: true })
                    }}
                  >
                    Crear cliente nuevo
                  </Button>
                </div>
              ) : (
                <ul aria-label="Clientes encontrados">
                  {results.data.data.map((c) => (
                  <li key={c.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => choose(String(c.id))}
                    aria-label={`Elegir a ${c.name}`}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <UserRound aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                      <span className="block truncate text-xs text-fg-subtle">{[c.phone, c.email, plural(c.vehicles_count, 'vehículo', 'vehículos')].filter(Boolean).join(' · ')}</span>
                    </span>
                    {c.open_orders_count > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                        <ClipboardList aria-hidden className="size-3.5" />
                        {plural(c.open_orders_count, 'orden abierta', 'órdenes abiertas')}
                      </span>
                    )}
                  </button>
                  </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      <FieldError message={e.customer_id?.message} />
    </div>
  )
}

/** Coche que entra en el taller (elegido o el que se está dando de alta). */
export interface EnteringVehicle {
  name: string
  plate: string | null
  bodyType: BodyType | null
  colorHex: string | null
  customer: string | null
  mileage: number | null
}

export function VehiclePreview({ vehicle, className }: { vehicle: EnteringVehicle | null; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-control bg-surface-2">
        <CarThumbnail appearance={{ bodyType: vehicle?.bodyType ?? null, colorHex: vehicle?.colorHex ?? null }} alt="" className="absolute inset-0 h-full w-full p-1" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{vehicle?.name ?? 'Elige un vehículo'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Plate value={vehicle?.plate} />
          {vehicle?.mileage != null && <span className="tabular">{formatKm(vehicle.mileage)}</span>}
        </div>
      </div>
    </div>
  )
}
