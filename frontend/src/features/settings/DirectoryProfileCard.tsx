/**
 * Perfil del taller en el directorio de CarCare (E16‑1, contrato §3.13.2). Lo edita solo el propietario; el gerente
 * y el mecánico lo ven en solo lectura (la API les daría 403). El nombre público es el del espacio: no se duplica.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useDirectoryProfile } from '@/api/hooks/repairRequests'
import { useSaveDirectoryProfile } from '@/api/hooks/workshopRequests'
import type { DirectoryProfile, DirectoryProfileInput, Workspace, WorkshopService } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, DataList } from '@/components/ui/Card'
import { Checkbox, Switch } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { SkeletonText } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { WORKSHOP_SERVICE_LABEL, WORKSHOP_SERVICES } from '@/features/requests/requestStatus'
import { formatDate } from '@/lib/format'
import { handleFormError } from '@/lib/forms'
import { can } from '@/lib/permissions'

export const PHONE_REGEX = /^[0-9 +()-]{6,30}$/

export const directorySchema = z
  .object({
    listed: z.boolean(),
    city: z.string().trim().max(80, 'Máximo 80 caracteres.'),
    address: z.string().trim().max(160, 'Máximo 160 caracteres.'),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || PHONE_REGEX.test(v), 'Entre 6 y 30 caracteres: números, espacios y + ( ) -.'),
    services: z.array(z.string()),
    opening_hours: z.string().trim().max(200, 'Máximo 200 caracteres.'),
  })
  .superRefine((v, ctx) => {
    if (v.listed && !v.city) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'Indica la ciudad para aparecer en el directorio.' })
    else if (v.city && v.city.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'Mínimo 2 caracteres.' })
  })

export type DirectoryValues = z.infer<typeof directorySchema>

const FIELDS = ['listed', 'city', 'address', 'phone', 'services', 'opening_hours'] as const

export function profileToValues(p: DirectoryProfile): DirectoryValues {
  return {
    listed: p.listed,
    city: p.city ?? '',
    address: p.address ?? '',
    phone: p.phone ?? '',
    services: [...p.services],
    opening_hours: p.opening_hours ?? '',
  }
}

export function valuesToProfileInput(v: DirectoryValues): DirectoryProfileInput {
  return {
    listed: v.listed,
    city: v.city.trim() || null,
    address: v.address.trim() || null,
    phone: v.phone.trim() || null,
    // En el orden de la lista cerrada, sin repetir
    services: WORKSHOP_SERVICES.filter((s) => v.services.includes(s)),
    opening_hours: v.opening_hours.trim() || null,
  }
}

/** Tarjeta "Directorio de talleres" de Ajustes: un bloque por cada taller al que pertenece el usuario. */
export function DirectoryProfileCard({ workspaces }: { workspaces: Workspace[] }) {
  const workshops = workspaces.filter((w) => w.type === 'workshop').sort((a, b) => a.name.localeCompare(b.name, 'es'))
  if (!workshops.length) return null
  return (
    <Card id="directorio" className="scroll-mt-24">
      <CardHeader title="Directorio de talleres" description="Lo que ven los particulares de CarCare cuando buscan un taller y te piden presupuesto." />
      <CardBody className="divide-y divide-line [&>*]:py-6 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
        {workshops.map((w) => (
          <DirectoryProfileBlock key={w.id} workspace={w} showName={workshops.length > 1} />
        ))}
      </CardBody>
    </Card>
  )
}

function DirectoryProfileBlock({ workspace, showName }: { workspace: Workspace; showName: boolean }) {
  const profile = useDirectoryProfile(workspace.id)
  return (
    <section aria-label={`Directorio de ${workspace.name}`} className="min-w-0">
      {showName && <h3 className="mb-3 font-medium text-fg">{workspace.name}</h3>}
      {profile.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Cargando el perfil del directorio…</span>
          <SkeletonText lines={4} />
        </div>
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} compact />
      ) : can(workspace, 'own') ? (
        <DirectoryForm workspace={workspace} profile={profile.data} />
      ) : (
        <DirectoryReadOnly workspace={workspace} profile={profile.data} />
      )}
    </section>
  )
}

function ListedStatus({ listed }: { listed: boolean }) {
  const Icon = listed ? Eye : EyeOff
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
      <Icon aria-hidden className="size-4 text-fg-muted" />
      {listed ? 'Aparece en el directorio' : 'No aparece en el directorio'}
    </p>
  )
}

function DirectoryReadOnly({ workspace, profile: p }: { workspace: Workspace; profile: DirectoryProfile }) {
  const empty = 'Sin indicar'
  return (
    <div className="space-y-3">
      <ListedStatus listed={p.listed} />
      <DataList
        className="border-t border-line"
        items={[
          { label: 'Nombre', value: workspace.name },
          { label: 'Ciudad', value: p.city ?? empty, empty: !p.city },
          { label: 'Dirección', value: p.address ?? empty, empty: !p.address },
          { label: 'Teléfono', value: p.phone ? <span className="tabular">{p.phone}</span> : empty, empty: !p.phone },
          { label: 'Servicios', value: p.services.length ? p.services.map((s) => WORKSHOP_SERVICE_LABEL[s]).join(', ') : empty, empty: !p.services.length },
          { label: 'Horario', value: p.opening_hours ?? empty, empty: !p.opening_hours },
        ]}
      />
      <p className="text-xs text-fg-subtle">Solo el propietario del taller puede cambiarlo.</p>
    </div>
  )
}

function DirectoryForm({ workspace, profile }: { workspace: Workspace; profile: DirectoryProfile }) {
  const save = useSaveDirectoryProfile(workspace.id)
  const [orphans, setOrphans] = useState<string[]>([])
  const form = useForm<DirectoryValues>({ resolver: zodResolver(directorySchema), defaultValues: profileToValues(profile) })
  const { register, control, handleSubmit, formState, reset, setError } = form
  const errors = formState.errors

  // Si el perfil cambia fuera del formulario (otra pestaña, refetch) y no hay cambios sin guardar, se refleja
  useEffect(() => {
    if (!formState.isDirty) reset(profileToValues(profile))
  }, [profile, reset, formState.isDirty])

  const onSubmit = handleSubmit((values) => {
    setOrphans([])
    save.mutate(valuesToProfileInput(values), {
      onSuccess: (saved) => {
        reset(profileToValues(saved))
        toast.success(saved.listed ? 'Guardado. Tu taller aparece en el directorio.' : 'Guardado. Tu taller no aparece en el directorio.')
      },
      onError: (error) => handleFormError(error, setError, FIELDS, setOrphans),
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Controller
        control={control}
        name="listed"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            label="Aparecer en el directorio"
            description={`Los particulares podrán encontrar «${workspace.name}» por su nombre o su ciudad y enviarte solicitudes. Si lo quitas, las que ya están abiertas siguen su curso.`}
          />
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad" required={form.watch('listed')} error={errors.city?.message}>
          <Input maxLength={80} autoComplete="address-level2" {...register('city')} />
        </Field>
        <Field label="Teléfono" error={errors.phone?.message}>
          <Input type="tel" maxLength={30} autoComplete="tel" className="tabular" {...register('phone')} />
        </Field>
        <Field label="Dirección" error={errors.address?.message} className="sm:col-span-2">
          <Input maxLength={160} autoComplete="street-address" {...register('address')} />
        </Field>
        <Field label="Horario" error={errors.opening_hours?.message} hint="Texto libre. Por ejemplo: L‑V 8:00‑14:00 y 15:30‑19:00." className="sm:col-span-2">
          <Input maxLength={200} {...register('opening_hours')} />
        </Field>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium text-fg">Servicios</legend>
        <div className="mt-1 grid sm:grid-cols-2 sm:gap-x-4">
          {WORKSHOP_SERVICES.map((s) => (
            <Checkbox key={s} value={s} label={WORKSHOP_SERVICE_LABEL[s as WorkshopService]} {...register('services')} />
          ))}
        </div>
        {errors.services && <p className="mt-1 text-xs font-medium text-danger">{errors.services.message ?? 'Revisa los servicios.'}</p>}
      </fieldset>

      <FormErrors messages={orphans} />

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-subtle">
          {profile.updated_at ? `Guardado por última vez el ${formatDate(profile.updated_at)}.` : 'Todavía no lo has guardado nunca.'} El nombre se cambia en «Ajustes del taller».
        </p>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!formState.isDirty}>
          Guardar directorio
        </Button>
      </div>
    </form>
  )
}
