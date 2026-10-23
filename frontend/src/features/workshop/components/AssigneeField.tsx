import { UserCheck } from 'lucide-react'
import { useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import type { Member } from '@/api/types'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/inputs'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABEL } from '@/lib/labels'

type WithAssignee = { assigned_to: string }

/** Mecánico asignado (miembros del taller) con atajo «Asignármela». */
export function AssigneeField<T extends FieldValues & WithAssignee>({
  form,
  members,
  loading,
  disabled,
  currentName,
}: {
  form: UseFormReturn<T>
  members: Member[] | undefined
  loading?: boolean
  disabled?: boolean
  /** Nombre del asignado actual por si ya no es miembro (se quitó del equipo). */
  currentName?: string | null
}) {
  const f = form as unknown as UseFormReturn<WithAssignee>
  const { user } = useAuth()
  const value = useWatch({ control: f.control, name: 'assigned_to' }) ?? ''
  const isMember = !!user && !!members?.some((m) => m.user.id === user.id)
  const mine = !!user && value === String(user.id)
  const known = !value || !!members?.some((m) => String(m.user.id) === value)

  return (
    <Field
      label="Mecánico"
      error={f.formState.errors.assigned_to?.message}
      hint="Quién se encarga del coche. Puedes cambiarlo en cualquier momento."
      labelAside={
        isMember &&
        !mine &&
        !disabled && (
          <button
            type="button"
            onClick={() => f.setValue('assigned_to', String(user.id), { shouldDirty: true })}
            className="-my-2 inline-flex items-center gap-1 rounded-control px-1 py-2 text-xs font-medium text-accent-ink hover:underline"
          >
            <UserCheck aria-hidden className="size-3.5" />
            Asignármela
          </button>
        )
      }
    >
      <Select disabled={disabled || loading} {...f.register('assigned_to')}>
        <option value="">{loading ? 'Cargando equipo…' : 'Sin asignar'}</option>
        {!known && <option value={value}>{currentName ?? 'Persona que ya no está en el equipo'}</option>}
        {members?.map((m) => (
          <option key={m.user.id} value={String(m.user.id)}>
            {m.user.name} · {ROLE_LABEL[m.role]}
            {user?.id === m.user.id ? ' (tú)' : ''}
          </option>
        ))}
      </Select>
    </Field>
  )
}
