import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, ChevronRight, History, ListFilter, LogOut, Plus, UserMinus, UserPlus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/api/client'
import { flattenPages, totalFromPages } from '@/api/hooks/shared'
import { useVehicle, useVehicles } from '@/api/hooks/vehicles'
import { useActivity, useAddMember, useMembers, useRemoveMember, useUpdateMemberRole } from '@/api/hooks/workspaces'
import type { Member, Vehicle, WorkspaceRole } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input, Select } from '@/components/ui/inputs'
import { LoadMore } from '@/components/ui/LoadMore'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { buttonClasses } from '@/components/ui/variants'
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspace } from '@/features/workspace/workspace-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSearchParam } from '@/hooks/useSearchParam'
import { cn } from '@/lib/cn'
import { formatDate, formatPlate } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'
import { TeamActivity } from './components/TeamActivity'
import { memberPermissions, type MemberPermissions } from './components/team'

const ROLE_ORDER: WorkspaceRole[] = ['owner', 'manager', 'mechanic']

type Pending = { kind: 'role'; member: Member; role: WorkspaceRole } | { kind: 'remove'; member: Member } | null

/**
 * Equipo del taller (plan UX 5.5): tabla de personas con su rol y, debajo, la actividad de 10 en 10.
 * Sin cajas ni iniciales en círculo (R3, R7); el rol es texto o su menú (R5). La explicación de los roles
 * va plegada. Al abrir solo se piden los miembros y la actividad (R12): los vehículos del filtro, al usarlo.
 */
export default function TeamPage() {
  const ctx = useWorkspace()
  useDocumentTitle('Equipo')
  const members = useMembers(ctx.id)
  const [adding, setAdding] = useState(false)
  const canManage = ctx.can('manage')

  if (!ctx.isWorkshop)
    return (
      <>
        <PageHeader title="Equipo" />
        <EmptyState icon={<Users />} title="El equipo es del modo taller" description="Tu garaje personal es solo tuyo. Crea un taller desde Ajustes para trabajar con más personas." />
      </>
    )

  return (
    <>
      <PageHeader
        title="Equipo"
        description={members.data ? `${plural(members.data.length, 'persona', 'personas')} con acceso a ${ctx.workspace.name}.` : `Quién trabaja en ${ctx.workspace.name} y con qué permisos.`}
        actions={
          canManage && (
            <Button variant="primary" icon={<UserPlus aria-hidden />} onClick={() => setAdding(true)}>
              Añadir persona
            </Button>
          )
        }
      />
      <div className="max-w-4xl space-y-10">
        <section aria-labelledby="personas-title" className="min-w-0">
          <h2 id="personas-title" className="mb-3 font-display text-lg font-semibold tracking-tight text-fg-warm">
            Personas
          </h2>
          {members.isPending ? (
            <MembersSkeleton />
          ) : members.isError ? (
            <ErrorState error={members.error} onRetry={() => void members.refetch()} />
          ) : (
            <MemberList members={members.data} />
          )}
          <RolesGuide />
        </section>
        <RecentActivity />
      </div>
      <AddMemberDialog open={adding} onOpenChange={setAdding} />
    </>
  )
}

function MemberList({ members }: { members: Member[] }) {
  const ctx = useWorkspace()
  const { user } = useAuth()
  const navigate = useNavigate()
  const updateRole = useUpdateMemberRole(ctx.id)
  const remove = useRemoveMember(ctx.id)
  const [pending, setPending] = useState<Pending>(null)
  const actor = ctx.workspace.role
  const owners = members.filter((m) => m.role === 'owner').length
  const perms = members.map((m) => memberPermissions({ actorRole: actor, actorId: user?.id ?? null, member: m, ownersCount: owners }))
  // El motivo del miembro protegido (último propietario) se dice una vez bajo la lista, no en su fila (5.5)
  const protectedReason = ctx.can('manage') ? (perms.find((p) => p.protectedReason)?.protectedReason ?? null) : null

  const changeRole = (member: Member, role: WorkspaceRole) =>
    updateRole.mutate(
      { userId: member.user.id, role },
      {
        onSuccess: () => {
          setPending(null)
          toast.success(`${member.user.name} ahora es ${ROLE_LABEL[role].toLowerCase()}`)
        },
        onError: (err) => {
          setPending(null)
          toast.error('No se pudo cambiar el rol', { description: errorMessage(err) })
        },
      },
    )

  const requestRole = (member: Member, role: WorkspaceRole) => {
    if (role === member.role) return
    // Dar o quitar «propietario», o cambiar tu propio rol, se confirma
    if (role === 'owner' || member.role === 'owner' || member.user.id === user?.id) setPending({ kind: 'role', member, role })
    else changeRole(member, role)
  }

  const doRemove = (member: Member) => {
    const self = member.user.id === user?.id
    remove.mutate(member.user.id, {
      onSuccess: () => {
        setPending(null)
        if (self) {
          toast.success(`Has salido de ${ctx.workspace.name}`)
          navigate('/app', { replace: true })
        } else toast.success(`${member.user.name} ya no tiene acceso al taller`)
      },
      onError: (err) => {
        setPending(null)
        toast.error(self ? 'No se pudo salir del taller' : 'No se pudo quitar a esta persona', { description: errorMessage(err) })
      },
    })
  }

  const p = pending
  const busyId = updateRole.isPending ? updateRole.variables?.userId : remove.isPending ? remove.variables : null

  return (
    <>
      <div
        aria-hidden
        className="hidden gap-4 border-t border-line px-1 py-2 text-xs font-medium text-fg-muted md:grid md:grid-cols-[minmax(0,1fr)_7.5rem_11rem_2.75rem]"
      >
        <span>Persona</span>
        <span>Desde</span>
        <span>Rol</span>
        <span />
      </div>
      <ul className="border-t border-line" aria-label="Personas del taller">
        {members.map((m, i) => (
          <MemberRow
            key={m.user.id}
            member={m}
            perms={perms[i]}
            isSelf={m.user.id === user?.id}
            busy={busyId === m.user.id}
            onRole={requestRole}
            onRemove={(mm) => setPending({ kind: 'remove', member: mm })}
          />
        ))}
      </ul>
      {protectedReason && <p className="mt-2 text-xs text-fg-subtle">{protectedReason}</p>}

      <ConfirmDialog
        open={p?.kind === 'role'}
        onOpenChange={(o) => !o && setPending(null)}
        title={p?.kind === 'role' ? (p.role === 'owner' ? `¿Hacer propietario a ${p.member.user.name}?` : `¿Cambiar el rol de ${p.member.user.id === user?.id ? 'tu cuenta' : p.member.user.name}?`) : ''}
        description={
          p?.kind === 'role'
            ? p.role === 'owner'
              ? 'Tendrá control total del taller, incluido eliminarlo y gestionar a otros propietarios.'
              : `Pasará a ${ROLE_LABEL[p.role].toLowerCase()}: ${ROLE_DESCRIPTION[p.role].charAt(0).toLowerCase()}${ROLE_DESCRIPTION[p.role].slice(1)}${p.member.user.id === user?.id ? ' Perderás los permisos que tienes ahora.' : ''}`
            : undefined
        }
        confirmLabel={p?.kind === 'role' ? `Hacer ${ROLE_LABEL[p.role].toLowerCase()}` : 'Confirmar'}
        tone="primary"
        loading={updateRole.isPending}
        onConfirm={() => p?.kind === 'role' && changeRole(p.member, p.role)}
      />
      <ConfirmDialog
        open={p?.kind === 'remove'}
        onOpenChange={(o) => !o && setPending(null)}
        title={p?.kind === 'remove' ? (p.member.user.id === user?.id ? `¿Salir de ${ctx.workspace.name}?` : `¿Quitar a ${p.member.user.name} del taller?`) : ''}
        description={
          p?.kind === 'remove'
            ? p.member.user.id === user?.id
              ? 'Dejarás de ver sus órdenes, clientes y vehículos. Para volver, alguien con permiso tendrá que añadirte de nuevo.'
              : 'Perderá el acceso al taller. Las órdenes que tenía asignadas quedarán sin asignar. Su cuenta de CarCare no se borra.'
            : undefined
        }
        confirmLabel={p?.kind === 'remove' && p.member.user.id === user?.id ? 'Salir del taller' : 'Quitar del taller'}
        loading={remove.isPending}
        onConfirm={() => p?.kind === 'remove' && doRemove(p.member)}
      />
    </>
  )
}

function MemberRow({
  member,
  perms,
  isSelf,
  busy,
  onRole,
  onRemove,
}: {
  member: Member
  perms: MemberPermissions
  isSelf: boolean
  busy: boolean
  onRole: (m: Member, role: WorkspaceRole) => void
  onRemove: (m: Member) => void
}) {
  const joined = formatDate(member.joined_at)
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-1 py-3 md:grid-cols-[minmax(0,1fr)_7.5rem_11rem_2.75rem]"
      aria-busy={busy || undefined}
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="truncate text-sm font-medium text-fg">
          {member.user.name}
          {isSelf && <span className="font-normal text-fg-subtle"> (tú)</span>}
        </p>
        <p className="truncate text-xs text-fg-muted">
          {member.user.email}
          <span className="md:hidden"> · desde el {joined}</span>
        </p>
      </div>
      <p className="hidden text-sm text-fg-muted tabular md:block">
        <span className="sr-only">Desde el </span>
        {joined}
      </p>
      <div className="min-w-0">
        {perms.roles.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={busy}
              className={cn(buttonClasses({ size: 'sm' }), 'w-full max-w-44 justify-between')}
              aria-label={`Rol de ${member.user.name}: ${ROLE_LABEL[member.role]}. Cambiar rol`}
            >
              {ROLE_LABEL[member.role]}
              <ChevronDown aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              <DropdownMenuLabel>Rol de {member.user.name.split(' ')[0]}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={member.role} onValueChange={(v) => onRole(member, v as WorkspaceRole)}>
                {perms.roles.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r} className="h-auto min-h-14 flex-col items-start justify-center gap-0.5 py-2">
                    <span className="font-medium">{ROLE_LABEL[r]}</span>
                    <span className="whitespace-normal text-xs text-fg-muted">{ROLE_DESCRIPTION[r]}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <p className="text-sm text-fg">
            <span className="sr-only">Rol: </span>
            {ROLE_LABEL[member.role]}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        {perms.canRemove &&
          (isSelf ? (
            <IconButton label="Salir del taller" size="sm" disabled={busy} onClick={() => onRemove(member)}>
              <LogOut aria-hidden />
            </IconButton>
          ) : (
            <IconButton label={`Quitar a ${member.user.name} del taller`} size="sm" disabled={busy} onClick={() => onRemove(member)}>
              <UserMinus aria-hidden />
            </IconButton>
          ))}
      </div>
    </li>
  )
}

/** Qué puede hacer cada rol, plegado bajo la lista (5.5). `<details>` nativo: teclado y lector sin JavaScript. */
function RolesGuide() {
  return (
    <details className="group mt-4 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-control font-medium text-fg-muted hover:text-fg md:min-h-9 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
        ¿Qué puede hacer cada rol?
      </summary>
      <dl className="mt-2 max-w-2xl divide-y divide-line border-y border-line">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="grid gap-1 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
            <dt className="font-medium text-fg">{ROLE_LABEL[r]}</dt>
            <dd className="text-fg-muted">{ROLE_DESCRIPTION[r]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 max-w-2xl text-xs text-fg-subtle">Todos pueden ver el taller, abrir y mover órdenes, y registrar intervenciones. Los permisos se comprueban también en el servidor.</p>
    </details>
  )
}

/** Actividad del equipo (E13‑7): paginada de 10 en 10 con «Ver más» y filtro por vehículo en la URL (?vehiculo=ID). */
function RecentActivity() {
  const ctx = useWorkspace()
  const [vehicleParam, setVehicleParam] = useSearchParam('vehiculo')
  const vehicleId = /^\d+$/.test(vehicleParam) ? Number(vehicleParam) : null
  // El filtro (y su petición de vehículos) solo se monta al pedirlo o si ya viene en la URL (R12)
  const [filterWanted, setFilterWanted] = useState(false)
  const filterOpen = filterWanted || vehicleId !== null
  const activity = useActivity(ctx.id, { per_page: ACTIVITY_PAGE, vehicle_id: vehicleId ?? undefined })
  const items = flattenPages(activity.data)
  const total = totalFromPages(activity.data)

  return (
    <Section
      title="Actividad"
      id="actividad"
      action={
        !filterOpen && (
          <Button size="sm" variant="ghost" icon={<ListFilter aria-hidden />} onClick={() => setFilterWanted(true)}>
            Filtrar por vehículo
          </Button>
        )
      }
    >
      {filterOpen && (
        <ActivityVehicleFilter
          value={vehicleId}
          autoFocus={filterWanted && vehicleId === null}
          onChange={(id) => setVehicleParam(id === null ? null : String(id))}
          onClose={() => {
            setFilterWanted(false)
            setVehicleParam(null)
          }}
        />
      )}
      {activity.isPending ? (
        <div role="status" className="border-t border-line">
          <span className="sr-only">Cargando actividad…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} aria-hidden className="space-y-1.5 border-b border-line px-1 py-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : activity.isError ? (
        <ErrorState compact error={activity.error} onRetry={() => void activity.refetch()} />
      ) : items.length === 0 && vehicleId !== null ? (
        <EmptyState
          compact
          icon={<History />}
          title="Sin actividad de este vehículo"
          description="Aquí saldrán sus órdenes, cambios de estado, lecturas de km e intervenciones."
          action={<Button onClick={() => setVehicleParam(null)}>Ver toda la actividad</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={<History />}
          title="Sin actividad todavía"
          description="Aquí verás lo que vaya haciendo el equipo: órdenes abiertas, cambios de estado, entregas…"
          action={
            ctx.can('operate') && (
              <ButtonLink to={`${ctx.base}/ordenes/nueva`} icon={<Plus aria-hidden />}>
                Abrir una orden
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <TeamActivity items={items} limit={items.length} />
          <LoadMore
            className="mt-4"
            hasNextPage={!!activity.hasNextPage}
            isFetchingNextPage={activity.isFetchingNextPage}
            fetchNextPage={activity.fetchNextPage}
            shown={items.length}
            total={total}
            what={total === 1 ? 'acción' : 'acciones'}
            label="Ver más"
          />
        </>
      )}
    </Section>
  )
}

const ACTIVITY_PAGE = 10

/** Selector de vehículo para la actividad. Lista los vehículos activos del taller por nombre (hasta 100). */
function ActivityVehicleFilter({
  value,
  autoFocus,
  onChange,
  onClose,
}: {
  value: number | null
  autoFocus?: boolean
  onChange: (id: number | null) => void
  onClose: () => void
}) {
  const ctx = useWorkspace()
  const vehicles = useVehicles(ctx.id, { per_page: 100, sort: 'name' })
  const list = vehicles.data?.data ?? []
  const missing = value !== null && !!vehicles.data && !list.some((v) => v.id === value)
  // El vehículo elegido puede no estar en la lista (archivado o más allá de los 100 primeros)
  const selected = useVehicle(missing ? value : undefined)
  const selectRef = useRef<HTMLSelectElement>(null)
  const ready = !vehicles.isPending

  // Al pulsar «Filtrar por vehículo» el foco pasa al selector en cuanto tiene opciones
  useEffect(() => {
    if (autoFocus && ready) selectRef.current?.focus()
  }, [autoFocus, ready])

  if (vehicles.isError) {
    return (
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        No se pudieron cargar los vehículos.
        <Button size="sm" onClick={() => void vehicles.refetch()}>
          Reintentar
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Ver toda la actividad
        </Button>
      </p>
    )
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-fg-muted sm:flex-none">
        <span className="shrink-0">Vehículo</span>
        <Select
          ref={selectRef}
          value={value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={!ready}
          className="w-full sm:w-72"
        >
          <option value="">{ready ? 'Todos los vehículos' : 'Cargando vehículos…'}</option>
          {missing && <option value={value}>{selected.data ? vehicleOptionLabel(selected.data) : 'Vehículo elegido'}</option>}
          {list.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleOptionLabel(v)}
            </option>
          ))}
        </Select>
      </label>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Quitar filtro
      </Button>
    </div>
  )
}

function vehicleOptionLabel(v: Pick<Vehicle, 'display_name' | 'plate'>): string {
  return v.plate ? `${v.display_name} · ${formatPlate(v.plate)}` : v.display_name
}

const addSchema = z.object({
  email: z.string().trim().min(1, 'Escribe su email.').email('Escribe un email válido.').max(255, 'Máximo 255 caracteres.'),
  role: z.enum(['manager', 'mechanic']),
})
type AddValues = z.infer<typeof addSchema>

function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Añadir persona al taller" description="Debe tener ya una cuenta en CarCare (particular o de taller). Si no la tiene, pídele que se registre primero." size="md">
        {open && <AddMemberForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const ctx = useWorkspace()
  const add = useAddMember(ctx.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<AddValues>({ resolver: zodResolver(addSchema), defaultValues: { email: '', role: 'mechanic' }, mode: 'onTouched' })
  const { register, handleSubmit, formState, setError, setValue } = form
  const role = useWatch({ control: form.control, name: 'role' })

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    add.mutate(
      { email: v.email.trim().toLowerCase(), role: v.role },
      {
        onSuccess: (res) => {
          toast.success(`${res.data.user.name} se ha unido al taller como ${ROLE_LABEL[v.role].toLowerCase()}`)
          onDone()
        },
        onError: (err) => handleFormError(err, setError, ['email', 'role'], setOrphans),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-5">
        <Field label="Email de su cuenta" required error={formState.errors.email?.message}>
          <Input type="email" autoComplete="off" autoFocus maxLength={255} placeholder="nombre@ejemplo.com" {...register('email')} />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-fg">Rol</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(['mechanic', 'manager'] as const).map((r) => {
              const checked = role === r
              return (
                <label
                  key={r}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                    checked ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                  )}
                >
                  <input type="radio" name="role" value={r} checked={checked} onChange={() => setValue('role', r, { shouldDirty: true })} className="sr-only" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                      {ROLE_LABEL[r]}
                      {checked && <Check aria-hidden className="size-3.5 text-accent-ink" />}
                    </span>
                    <span className="block text-xs text-fg-muted">{ROLE_DESCRIPTION[r]}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {formState.errors.role?.message && <p className="mt-1 text-xs font-medium text-danger">{formState.errors.role.message}</p>}
        </fieldset>
        <p className="text-xs text-fg-subtle">Solo un propietario puede nombrar a otro propietario, desde la lista del equipo.</p>
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button disabled={add.isPending}>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={add.isPending} icon={<UserPlus aria-hidden />}>
          Añadir al taller
        </Button>
      </DialogFooter>
    </form>
  )
}

function MembersSkeleton() {
  return (
    <div role="status" aria-live="polite" className="border-t border-line">
      <span className="sr-only">Cargando equipo…</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-4 border-b border-line px-1 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  )
}

