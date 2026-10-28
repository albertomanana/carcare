/** Perfil y contraseña de la cuenta (PATCH /me · PUT /me/password). */
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useChangePassword, useUpdateProfile } from '@/api/hooks/auth'
import type { User } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { formatDate } from '@/lib/format'
import { handleFormError } from '@/lib/forms'

// ───────── Perfil ─────────

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100, 'Máximo 100 caracteres.'),
  email: z.string().trim().min(1, 'Indica tu email.').email('Email no válido.').max(255, 'Máximo 255 caracteres.'),
})
type ProfileValues = z.infer<typeof profileSchema>

export function ProfileCard({ user }: { user: User }) {
  const mutation = useUpdateProfile()
  const [orphans, setOrphans] = useState<string[]>([])
  const { register, handleSubmit, formState, setError, reset } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { name: user.name, email: user.email },
  })
  const errors = formState.errors

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    const input: Partial<ProfileValues> = {}
    if (v.name.trim() !== user.name) input.name = v.name.trim()
    if (v.email.trim().toLowerCase() !== user.email) input.email = v.email.trim().toLowerCase()
    mutation.mutate(input, {
      onSuccess: (me) => {
        reset({ name: me.user.name, email: me.user.email })
        toast.success('Perfil actualizado')
      },
      onError: (err) => handleFormError(err, setError, ['name', 'email'], setOrphans),
    })
  })

  return (
    <Card id="perfil" className="scroll-mt-24">
      <CardHeader title="Perfil" description={`Cuenta creada el ${formatDate(user.created_at, 'long')}.`} />
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.name?.message}>
              <Input autoComplete="name" maxLength={100} {...register('name')} />
            </Field>
            <Field label="Email" required error={errors.email?.message} hint="Lo usas para entrar. Se guarda en minúsculas.">
              <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
            </Field>
          </div>
          <FormErrors messages={orphans} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={mutation.isPending} disabled={!formState.isDirty}>
              Guardar perfil
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

// ───────── Contraseña ─────────

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Escribe tu contraseña actual.'),
    password: z.string().min(8, 'Mínimo 8 caracteres.').max(255, 'Máximo 255 caracteres.'),
    password_confirmation: z.string().min(1, 'Repite la nueva contraseña.'),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password_confirmation && v.password !== v.password_confirmation)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password_confirmation'], message: 'Las contraseñas no coinciden.' })
    if (v.password && v.current_password && v.password === v.current_password)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'La nueva contraseña debe ser distinta de la actual.' })
  })
type PasswordValues = z.infer<typeof passwordSchema>

export function PasswordCard() {
  const mutation = useChangePassword()
  const [orphans, setOrphans] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const { register, handleSubmit, formState, setError, reset } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  })
  const errors = formState.errors
  const type = visible ? 'text' : 'password'

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    mutation.mutate(v, {
      onSuccess: () => {
        reset()
        setVisible(false)
        toast.success('Contraseña cambiada')
      },
      onError: (err) => handleFormError(err, setError, ['current_password', 'password', 'password_confirmation'], setOrphans),
    })
  })

  return (
    <Card id="contrasena" className="scroll-mt-24">
      <CardHeader
        title="Contraseña"
        description="Mínimo 8 caracteres y distinta de la actual."
        action={
          <IconButton label={visible ? 'Ocultar contraseñas' : 'Mostrar contraseñas'} onClick={() => setVisible((x) => !x)} aria-pressed={visible}>
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </IconButton>
        }
      />
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Contraseña actual" required error={errors.current_password?.message}>
            <Input type={type} autoComplete="current-password" {...register('current_password')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nueva contraseña" required error={errors.password?.message}>
              <Input type={type} autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="Repite la nueva contraseña" required error={errors.password_confirmation?.message}>
              <Input type={type} autoComplete="new-password" {...register('password_confirmation')} />
            </Field>
          </div>
          <FormErrors messages={orphans} />
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
