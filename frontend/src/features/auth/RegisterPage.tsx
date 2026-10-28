import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useRegister } from '@/api/hooks/auth'
import type { WorkspaceType } from '@/api/types'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'
import { handleFormError } from '@/lib/forms'
import { AuthLayout, PasswordToggle } from './AuthLayout'

const schema = z
  .object({
    account_type: z.enum(['personal', 'workshop']),
    name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100, 'Máximo 100 caracteres.'),
    email: z.string().trim().min(1, 'Escribe tu email.').email('Ese email no parece válido.'),
    password: z.string().min(8, 'Mínimo 8 caracteres.'),
    password_confirmation: z.string().min(1, 'Repite la contraseña.'),
    workshop_name: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.password_confirmation && v.password !== v.password_confirmation) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password_confirmation'], message: 'Las contraseñas no coinciden.' })
    }
    if (v.account_type === 'workshop') {
      const n = v.workshop_name.trim().length
      if (n < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workshop_name'], message: 'Indica el nombre del taller (mínimo 2 caracteres).' })
      else if (n > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workshop_name'], message: 'Máximo 100 caracteres.' })
    }
  })
type Values = z.infer<typeof schema>
const FIELDS = ['account_type', 'name', 'email', 'password', 'password_confirmation', 'workshop_name'] as const

const TYPES: { value: WorkspaceType; title: string; text: string }[] = [
  { value: 'personal', title: 'Particular', text: 'Tu coche o los de casa: diario, gastos, historial y avisos.' },
  { value: 'workshop', title: 'Taller o flota', text: 'Clientes, órdenes en tablero, elevadores y equipo.' },
]

export default function RegisterPage() {
  const registerMutation = useRegister()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [orphans, setOrphans] = useState<string[]>([])

  const { register, handleSubmit, formState, setError, watch } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_type: params.get('tipo') === 'taller' ? 'workshop' : 'personal',
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      workshop_name: '',
    },
  })
  const errors = formState.errors
  const accountType = watch('account_type')
  const password = watch('password')

  const onSubmit = handleSubmit((v) => {
    setOrphans([])
    registerMutation.mutate(
      {
        account_type: v.account_type,
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        password: v.password,
        password_confirmation: v.password_confirmation,
        ...(v.account_type === 'workshop' ? { workshop_name: v.workshop_name.trim() } : {}),
      },
      {
        onSuccess: (me) => {
          toast.success(`¡Bienvenido a CarCare, ${me.user.name.split(' ')[0]}!`)
          navigate('/app', { replace: true })
        },
        onError: (err) => handleFormError(err, setError, FIELDS, setOrphans),
      },
    )
  })

  return (
    <AuthLayout
      title="Crea tu cuenta"
      description="Siempre tendrás tu garaje personal; si eres taller, creamos también tu espacio de taller."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/entrar" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">¿Cómo vas a usar CarCare?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPES.map(({ value, title, text }) => {
              const checked = accountType === value
              return (
                <label
                  key={value}
                  className={cn(
                    'relative flex cursor-pointer items-start gap-3 rounded-control border p-3.5 transition-colors duration-150',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                    checked ? 'border-accent-ink bg-surface-2' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <input type="radio" value={value} className="sr-only" {...register('account_type')} />
                  <span
                    aria-hidden
                    className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2', checked ? 'border-accent-ink' : 'border-line-strong')}
                  >
                    {checked && <span className="size-2 rounded-full bg-accent-ink" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-fg">{title}</span>
                    <span className="block text-xs text-fg-muted">{text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {accountType === 'workshop' && (
          <Field label="Nombre del taller" required error={errors.workshop_name?.message} hint="Podrás cambiarlo después en Ajustes.">
            <Input autoComplete="organization" maxLength={100} placeholder="P. ej. Talleres Martínez" {...register('workshop_name')} />
          </Field>
        )}

        <Field label="Tu nombre" required error={errors.name?.message}>
          <Input autoComplete="name" maxLength={100} {...register('name')} />
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contraseña" required error={errors.password?.message} hint={!errors.password ? `${password.length < 8 ? 'Mínimo 8 caracteres.' : 'Longitud correcta.'}` : undefined}>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-20" {...register('password')} />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
          </Field>
          <Field label="Repite la contraseña" required error={errors.password_confirmation?.message}>
            <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password_confirmation')} />
          </Field>
        </div>

        <FormErrors messages={orphans} />

        <Button type="submit" variant="primary" size="lg" block loading={registerMutation.isPending}>
          {accountType === 'workshop' ? 'Crear cuenta y taller' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  )
}
