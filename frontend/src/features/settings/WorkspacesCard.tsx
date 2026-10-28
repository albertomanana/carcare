/** Espacios de la cuenta: abrir, ajustes del taller, salir, eliminar y crear un taller nuevo. */
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { DoorOpen, EllipsisVertical, Plus, Settings2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/api/client'
import { useCreateWorkspace, useDeleteWorkspace, useRemoveMember, useUpdateWorkspace } from '@/api/hooks/workspaces'
import { qk } from '@/api/keys'
import type { User, Workspace } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { formatDate, normalizeDecimalInput } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { can } from '@/lib/permissions'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { ROLE_LABEL } from '@/lib/labels'
import { plural } from '@/lib/text'

function workspaceName(w: Workspace) {
  return w.type === 'personal' ? 'Mi garaje' : w.name
}

/** Tras salir o borrar un espacio: limpia su caché y la preferencia de «último espacio». */
function forgetWorkspace(qc: ReturnType<typeof useQueryClient>, id: number) {
  qc.removeQueries({ queryKey: qk.workspace(id) })
  if (readStorage(STORAGE_KEYS.lastWorkspace) === String(id)) writeStorage(STORAGE_KEYS.lastWorkspace, null)
}

export function WorkspacesCard({ user, workspaces }: { user: User; workspaces: Workspace[] }) {
  const [editing, setEditing] = useState<Workspace | null>(null)
  const [leaving, setLeaving] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<Workspace | null>(null)
  const sorted = [...workspaces].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'es') : a.type === 'personal' ? -1 : 1))

  return (
    <Card id="espacios" className="scroll-mt-24">
      <CardHeader title="Espacios" description="Tu garaje personal y los talleres a los que perteneces." />
      <CardBody className="space-y-6">
        <ul className="divide-y divide-line border-y border-line">
          {sorted.map((w) => (
            <WorkspaceRow key={w.id} workspace={w} onEdit={setEditing} onLeave={setLeaving} onDelete={setDeleting} />
          ))}
        </ul>
        <CreateWorkshopForm />
      </CardBody>
      {editing && <WorkshopSettingsDialog workspace={editing} onClose={() => setEditing(null)} />}
      <LeaveDialog workspace={leaving} userId={user.id} onClose={() => setLeaving(null)} />
      <DeleteWorkshopDialog workspace={deleting} onClose={() => setDeleting(null)} />
    </Card>
  )
}

function WorkspaceRow({
  workspace: w,
  onEdit,
  onLeave,
  onDelete,
}: {
  workspace: Workspace
  onEdit: (w: Workspace) => void
  onLeave: (w: Workspace) => void
  onDelete: (w: Workspace) => void
}) {
  const workshop = w.type === 'workshop'
  const canManage = can(w, 'manage')
  const isOwner = can(w, 'own')
  const meta = [
    workshop ? `Taller · ${ROLE_LABEL[w.role]}` : 'Particular',
    plural(w.vehicles_count, 'vehículo', 'vehículos'),
    workshop ? plural(w.members_count, 'miembro', 'miembros') : null,
  ].filter(Boolean)

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-fg">{workspaceName(w)}</span>
          </p>
          <p className="truncate text-sm text-fg-muted">{meta.join(' · ')}</p>
          {workshop && (
            <p className="text-xs text-fg-subtle tabular">
              {plural(w.settings.bays_count, 'elevador', 'elevadores')} · IVA por defecto {w.settings.tax_rate.replace('.', ',')} % · desde el {formatDate(w.created_at)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <ButtonLink to={`/app/${w.id}`} size="sm" className="max-sm:flex-1">
          Abrir
        </ButtonLink>
        {workshop && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-11 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:size-9"
              aria-label={`Más acciones de ${workspaceName(w)}`}
            >
              <EllipsisVertical aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canManage && (
                <DropdownMenuItem icon={<Settings2 aria-hidden />} onSelect={() => onEdit(w)}>
                  Ajustes del taller
                </DropdownMenuItem>
              )}
              <DropdownMenuItem icon={<DoorOpen aria-hidden />} onSelect={() => onLeave(w)}>
                Salir del taller
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => onDelete(w)}>
                    Eliminar taller
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  )
}

// ───────── Crear taller ─────────

const createSchema = z.object({ name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100, 'Máximo 100 caracteres.') })

function CreateWorkshopForm() {
  const mutation = useCreateWorkspace()
  const navigate = useNavigate()
  const [orphans, setOrphans] = useState<string[]>([])
  const { register, handleSubmit, formState, setError, reset } = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  })

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    mutation.mutate(
      { name: v.name.trim() },
      {
        onSuccess: (ws) => {
          reset()
          toast.success(`Taller «${ws.name}» creado`)
          navigate(`/app/${ws.id}`)
        },
        onError: (err) => handleFormError(err, setError, ['name'], setOrphans),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <h3 className="font-display text-base font-semibold text-fg-warm">Crear un taller</h3>
      <p className="mt-0.5 text-sm text-fg-muted">Para gestionar clientes, órdenes de trabajo y elevadores. Serás su propietario; tu garaje personal no cambia.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Nombre del taller" hideLabel error={formState.errors.name?.message} className="sm:flex-1">
          <Input placeholder="Nombre del taller" maxLength={100} autoComplete="organization" {...register('name')} />
        </Field>
        <Button type="submit" icon={<Plus aria-hidden />} loading={mutation.isPending}>
          Crear taller
        </Button>
      </div>
      <FormErrors messages={orphans} />
    </form>
  )
}

// ───────── Ajustes del taller ─────────

const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100, 'Máximo 100 caracteres.'),
  bays_count: z.string().refine((v) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 12, 'Entre 1 y 12 elevadores.'),
  tax_rate: z.string().refine((v) => {
    const n = normalizeDecimalInput(v)
    return n !== null && Number(n) >= 0 && Number(n) <= 100 && !/\.\d{3,}$/.test(n)
  }, 'Entre 0 y 100, con 2 decimales como máximo.'),
})
type SettingsValues = z.infer<typeof settingsSchema>

function WorkshopSettingsDialog({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 200)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent title="Ajustes del taller" description={workspace.name} size="sm">
        <WorkshopSettingsForm workspace={workspace} onDone={close} />
      </DialogContent>
    </Dialog>
  )
}

function WorkshopSettingsForm({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const mutation = useUpdateWorkspace(workspace.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const { register, handleSubmit, formState, setError } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: workspace.name,
      bays_count: String(workspace.settings.bays_count),
      tax_rate: workspace.settings.tax_rate.replace('.', ','),
    },
  })
  const errors = formState.errors

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const tax = Number(normalizeDecimalInput(v.tax_rate)).toFixed(2)
    mutation.mutate(
      { name: v.name.trim(), settings: { bays_count: Number(v.bays_count), tax_rate: tax } },
      {
        onSuccess: () => {
          toast.success('Ajustes del taller guardados')
          onDone()
        },
        onError: (err) =>
          handleFormError(err, setError, ['name', 'bays_count', 'tax_rate'], setOrphans, { 'settings.bays_count': 'bays_count', 'settings.tax_rate': 'tax_rate' }),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogBody className="space-y-4">
        <Field label="Nombre" required error={errors.name?.message}>
          <Input maxLength={100} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Elevadores" required error={errors.bays_count?.message} hint="De 1 a 12. Se ven en el taller 3D.">
            <Input type="text" inputMode="numeric" className="tabular text-right" {...register('bays_count')} />
          </Field>
          <Field label="IVA por defecto" required error={errors.tax_rate?.message} hint="Para las órdenes nuevas.">
            <Input type="text" inputMode="decimal" suffix="%" className="tabular text-right" {...register('tax_rate')} />
          </Field>
        </div>
        <p className="text-xs text-fg-subtle">Si reduces los elevadores y alguno tiene una orden, el servidor te lo indicará.</p>
        <FormErrors messages={orphans} />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button>Cancelar</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}

// ───────── Salir ─────────

function LeaveDialog({ workspace, userId, onClose }: { workspace: Workspace | null; userId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const remove = useRemoveMember(workspace?.id ?? 0)
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    setError(null)
    onClose()
  }
  return (
    <ConfirmDialog
      open={!!workspace}
      onOpenChange={(o) => !o && close()}
      title={`¿Salir de ${workspace?.name ?? 'este taller'}?`}
      description={
        workspace?.role === 'owner'
          ? 'Dejarás de ver sus vehículos, clientes y órdenes. Si eres el único propietario no podrás salir: nombra antes a otro propietario en Equipo o elimina el taller.'
          : 'Dejarás de ver sus vehículos, clientes y órdenes. Para volver, alguien del taller tendrá que añadirte de nuevo.'
      }
      confirmLabel="Salir del taller"
      loading={remove.isPending}
      onConfirm={() => {
        if (!workspace) return
        setError(null)
        remove.mutate(userId, {
          onSuccess: () => {
            forgetWorkspace(qc, workspace.id)
            toast.success(`Has salido de ${workspace.name}`)
            close()
          },
          onError: (err) => setError(errorMessage(err)),
        })
      }}
    >
      {error ? <FormErrors messages={[error]} /> : null}
    </ConfirmDialog>
  )
}

// ───────── Eliminar taller ─────────

function DeleteWorkshopDialog({ workspace, onClose }: { workspace: Workspace | null; onClose: () => void }) {
  const qc = useQueryClient()
  const remove = useDeleteWorkspace()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const close = () => {
    setTyped('')
    setError(null)
    onClose()
  }
  const matches = !!workspace && typed.trim() === workspace.name
  return (
    <ConfirmDialog
      open={!!workspace}
      onOpenChange={(o) => !o && close()}
      title={`¿Eliminar ${workspace?.name ?? 'el taller'}?`}
      description={
        workspace
          ? `Se borrarán para todo el equipo sus ${plural(workspace.vehicles_count, 'vehículo', 'vehículos')}, clientes, órdenes, historial y documentos. No se puede deshacer.`
          : undefined
      }
      confirmLabel="Eliminar taller"
      loading={remove.isPending}
      confirmDisabled={!matches}
      onConfirm={() => {
        if (!workspace || !matches) return
        setError(null)
        remove.mutate(workspace.id, {
          onSuccess: () => {
            forgetWorkspace(qc, workspace.id)
            toast.success(`Taller «${workspace.name}» eliminado`)
            close()
          },
          onError: (err) => setError(errorMessage(err)),
        })
      }}
    >
      <Field label={`Escribe «${workspace?.name ?? ''}» para confirmar`}>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
      </Field>
      {error && (
        <div className="mt-3">
          <FormErrors messages={[error]} />
        </div>
      )}
    </ConfirmDialog>
  )
}
