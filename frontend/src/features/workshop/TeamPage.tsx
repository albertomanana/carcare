import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronDown, Crown, History, Lock, LogOut, Plus, ShieldCheck, UserMinus, UserPlus, Users, Wrench } from 'lucide-react'
import { useState } from 'react'
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
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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

const ROLE_ICON: Record<WorkspaceRole, typeof Crown> = { owner: Crown, manager: ShieldCheck, mechanic: Wrench }
const ROLE_ORDER: WorkspaceRole[] = ['owner', 'manager', 'mechanic']

type Pending = { kind: 'role'; member: Member; role: WorkspaceRole } | { kind: 'remove'; member: Member } | null

/** Equipo del taller: quién tiene acceso, con qué rol, y altas/bajas. El último propietario está protegido. */
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
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-8">
          {members.isPending ? (
            <MembersSkeleton />
          ) : members.isError ? (
            <ErrorState error={members.error} onRetry={() => void members.refetch()} />
          ) : (
            <MemberList members={members.data} />
          )}
          <RecentActivity />
        </div>
        <RolesGuide />
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
    <section aria-labelledby="members-title">
      <h2 id="members-title" className="sr-only">
        Miembros
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {members.map((m) => {
          const perms = memberPermissions({ actorRole: actor, actorId: user?.id ?? null, member: m, ownersCount: owners })
          return <MemberRow key={m.user.id} member={m} perms={perms} isSelf={m.user.id === user?.id} busy={busyId === m.user.id} onRole={requestRole} onRemove={(mm) => setPending({ kind: 'remove', member: mm })} />
        })}
      </ul>
      {owners === 1 && <p className="mt-2 text-xs text-fg-subtle">El taller tiene un único propietario: para que deje de serlo, nombra antes a otro propietario.</p>}

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
    </section>
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
  const Icon = ROLE_ICON[member.role]
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center" aria-busy={busy || undefined}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.user.name} highlight={isSelf} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 truncate font-medium text-fg">
            {member.user.name}
            {isSelf && <span className="text-xs font-normal text-fg-subtle">(tú)</span>}
          </p>
          <p className="truncate text-xs text-fg-muted">
            {member.user.email} · desde el {formatDate(member.joined_at)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
        {perms.roles.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger disabled={busy} className={cn(buttonClasses({ size: 'sm' }), 'min-w-36 justify-between')} aria-label={`Rol de ${member.user.name}: ${ROLE_LABEL[member.role]}. Cambiar rol`}>
              <span className="inline-flex items-center gap-1.5">
                <Icon aria-hidden />
                {ROLE_LABEL[member.role]}
              </span>
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
          <Badge tone={member.role === 'owner' ? 'accent' : member.role === 'manager' ? 'info' : 'neutral'} icon={<Icon aria-hidden />}>
            {ROLE_LABEL[member.role]}
          </Badge>
        )}
        {perms.protectedReason && (
          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle" title={perms.protectedReason}>
            <Lock aria-hidden className="size-3.5" />
            {perms.protectedLabel}
          </span>
        )}
        {perms.canRemove &&
          (isSelf ? (
            <Button size="sm" variant="ghost" icon={<LogOut aria-hidden />} disabled={busy} onClick={() => onRemove(member)}>
              Salir del taller
            </Button>
          ) : (
            <IconButton label={`Quitar a ${member.user.name} del taller`} size="sm" disabled={busy} onClick={() => onRemove(member)}>
              <UserMinus aria-hidden />
            </IconButton>
          ))}
      </div>
    </li>
  )
}

function RolesGuide() {
  return (
    <aside aria-labelledby="roles-title" className="space-y-3">
      <Card className="p-5">
        <h2 id="roles-title" className="font-display text-base font-semibold text-fg-warm">
          Qué puede hacer cada rol
        </h2>
        <ul className="mt-3 space-y-3">
          {ROLE_ORDER.map((r) => {
            const Icon = ROLE_ICON[r]
            return (
              <li key={r} className="flex items-start gap-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-control bg-surface-2 text-fg-muted [&_svg]:size-4">
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{ROLE_LABEL[r]}</span>
                  <span className="block text-sm text-fg-muted">{ROLE_DESCRIPTION[r]}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">Todos pueden ver el taller, abrir y mover órdenes, y registrar intervenciones. Los permisos se comprueban también en el servidor.</p>
      </Card>
    </aside>
  )
}

/** Actividad del equipo (E13‑7): paginada de 10 en 10 con «Ver más» y filtro por vehículo en la URL (?vehiculo=ID). */
function RecentActivity() {
  const ctx = useWorkspace()
  const [vehicleParam, setVehicleParam] = useSearchParam('vehiculo')
  const vehicleId = /^\d+$/.test(vehicleParam) ? Number(vehicleParam) : null
  const activity = useActivity(ctx.id, { per_page: ACTIVITY_PAGE, vehicle_id: vehicleId ?? undefined })
  const items = flattenPages(activity.data)
  const total = totalFromPages(activity.data)

  return (
    <Section title="Actividad" id="actividad">
      <ActivityVehicleFilter value={vehicleId} onChange={(id) => setVehicleParam(id === null ? null : String(id))} />
      {activity.isPending ? (
        <div role="status" className="space-y-2">
          <span className="sr-only">Cargando actividad…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-control" />
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
function ActivityVehicleFilter({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const ctx = useWorkspace()
  const vehicles = useVehicles(ctx.id, { per_page: 100, sort: 'name' })
  const list = vehicles.data?.data ?? []
  const missing = value !== null && !!vehicles.data && !list.some((v) => v.id === value)
  // El vehículo elegido puede no estar en la lista (archivado o más allá de los 100 primeros)
  const selected = useVehicle(missing ? value : undefined)

  if (vehicles.isError) {
    return value !== null ? (
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        Solo la actividad de un vehículo.
        <Button size="sm" onClick={() => onChange(null)}>
          Ver toda la actividad
        </Button>
      </p>
    ) : null
  }
  if (vehicles.data && list.length === 0 && value === null) return null

  return (
    <label className="mb-3 flex items-center gap-2 text-sm text-fg-muted">
      <span className="shrink-0">Vehículo</span>
      <Select
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={vehicles.isPending}
        className="w-full sm:w-72"
      >
        <option value="">Todos los vehículos</option>
        {missing && <option value={value}>{selected.data ? vehicleOptionLabel(selected.data) : 'Vehículo elegido'}</option>}
        {list.map((v) => (
          <option key={v.id} value={v.id}>
            {vehicleOptionLabel(v)}
          </option>
        ))}
      </Select>
    </label>
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
              const Icon = ROLE_ICON[r]
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
                  <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', checked ? 'text-accent-ink' : 'text-fg-subtle')} />
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
    <div role="status" aria-live="polite" className="divide-y divide-line rounded-card border border-line bg-surface">
      <span className="sr-only">Cargando equipo…</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 rounded-full" />
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
