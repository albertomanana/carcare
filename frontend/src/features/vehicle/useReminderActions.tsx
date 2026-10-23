import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { useReminderCommands } from '@/api/hooks/records'
import { useVehicle } from '@/api/hooks/vehicles'
import type { Reminder } from '@/api/types'
import type { ReminderActions } from '@/components/vehicles/ReminderItem'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { currentMileageOf } from '@/lib/agenda'

const CompleteReminderDialog = lazy(() => import('./dialogs/CompleteReminderDialog'))
const ReminderDialog = lazy(() => import('./dialogs/ReminderDialog'))
const PostponeReminderDialog = lazy(() => import('./dialogs/PostponeReminderDialog'))

/** Diálogo de edición: carga el vehículo del recordatorio (en la agenda solo llega su referencia). */
function EditReminder({ reminder, onClose }: { reminder: Reminder; onClose: () => void }) {
  const { data: vehicle } = useVehicle(reminder.vehicle_id)
  const [open, setOpen] = useState(true)
  if (!vehicle) return null
  return (
    <ReminderDialog
      vehicle={vehicle}
      reminder={reminder}
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setTimeout(onClose, 200)
      }}
    />
  )
}

/**
 * Acciones de recordatorio (hecho, editar, descartar, eliminar) con sus diálogos.
 * Devuelve las acciones para <ReminderItem> y los diálogos que hay que pintar una vez.
 */
export function useReminderActions({ canOperate, currentMileage }: { canOperate: boolean; currentMileage?: number | null }) {
  const { dismiss, remove } = useReminderCommands()
  const [completing, setCompleting] = useState<Reminder | null>(null)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [postponing, setPostponing] = useState<Reminder | null>(null)
  const [deleting, setDeleting] = useState<Reminder | null>(null)

  const actions: ReminderActions = canOperate
    ? {
        onComplete: setCompleting,
        onEdit: setEditing,
        onPostpone: setPostponing,
        onDismiss: (r) =>
          dismiss.mutate(r, {
            onSuccess: () => toast.success(`«${r.title}» descartado`),
            onError: (err) => toast.error(errorMessage(err)),
          }),
        onDelete: setDeleting,
      }
    : {}

  const dialogs = (
    <Suspense fallback={null}>
      {completing && (
        <CompleteReminderDialog
          reminder={completing}
          currentMileage={currentMileage !== undefined ? currentMileage : currentMileageOf(completing)}
          onOpenChange={(o) => !o && setCompleting(null)}
        />
      )}
      {postponing && <PostponeReminderDialog reminder={postponing} onOpenChange={(o) => !o && setPostponing(null)} />}
      {editing && <EditReminder key={editing.id} reminder={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar este recordatorio?"
        description={deleting ? `«${deleting.title}» se borrará definitivamente. Si solo ya no aplica, puedes descartarlo.` : undefined}
        confirmLabel="Eliminar"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast.success('Recordatorio eliminado')
              setDeleting(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </Suspense>
  )

  return { actions, dialogs }
}
