import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { errorMessage, isApiError } from '@/api/client'
import { useLogin } from '@/api/hooks/auth'
import type { LoginInput } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { safeRedirect } from '@/lib/navigation'
import { AuthLayout, FormAlert, PasswordToggle } from './AuthLayout'
import { useLockout } from './useLockout'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email.').email('Ese email no parece válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  remember: z.boolean(),
})
type Values = z.infer<typeof schema>

/** Cuentas del DemoSeeder (contrato §5). Solo se muestran en desarrollo. */
const DEMO_ACCOUNTS = [
  { email: 'demo@carcare.test', label: 'Particular', description: '2 vehículos con historial' },
  { email: 'taller@carcare.test', label: 'Taller (propietario)', description: 'Taller Demo, 4 elevadores' },
  { email: 'gerente@carcare.test', label: 'Gerente de taller', description: 'Rol manager' },
  { email: 'mecanico@carcare.test', label: 'Mecánico', description: 'Rol mechanic, no ve importes' },
]

/** Aviso que llega en `location.state` (p. ej. tras cambiar la contraseña). */
function readNotice(state: unknown): string | null {
  if (state && typeof state === 'object' && 'notice' in state && typeof state.notice === 'string') return state.notice
  return null
}

export default function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const back = safeRedirect(params.get('volver'))
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useLockout()
  const notice = readNotice(useLocation().state)

  const { register, handleSubmit, formState, setError, setValue, setFocus } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: true },
  })
  const errors = formState.errors

  const submit = (input: LoginInput) => {
    setFormError(null)
    login.mutate(input, {
      onSuccess: () => navigate(back ?? '/app', { replace: true }),
      onError: (err) => {
        if (isApiError(err) && err.status === 429) {
          setLockedFor(err.retryAfter ?? 60)
          setFormError(err.message)
          return
        }
        if (isApiError(err) && err.status === 422) {
          const emailMsg = err.fieldError('email')
          const passwordMsg = err.fieldError('password')
          // El servidor responde con un mensaje genérico ("Las credenciales no son correctas.")
          setFormError(emailMsg ?? passwordMsg ?? err.message)
          if (emailMsg) setError('email', { type: 'server', message: emailMsg })
          if (passwordMsg) setError('password', { type: 'server', message: passwordMsg })
          setFocus(passwordMsg && !emailMsg ? 'password' : 'email')
          return
        }
        setFormError(errorMessage(err))
      },
    })
  }

  const onSubmit = handleSubmit((v) => submit({ email: v.email.trim().toLowerCase(), password: v.password, remember: v.remember }))

  const loginAsDemo = (email: string) => {
    setValue('email', email)
    setValue('password', 'password')
    submit({ email, password: 'password', remember: true })
  }

  const locked = lockedFor > 0

  return (
    <AuthLayout
      title="Entra en CarCare"
      description={back && !notice ? 'Inicia sesión para continuar donde lo dejaste.' : undefined}
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {notice && !formError && (
          <div role="status" className="flex items-start gap-2.5 rounded-card border border-ok/40 bg-ok-soft p-3.5 text-sm text-fg">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
            <span>{notice}</span>
          </div>
        )}
        {formError && <FormAlert lockedFor={lockedFor}>{formError}</FormAlert>}

        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...register('email')} />
        </Field>

        <Field
          label="Contraseña"
          required
          error={errors.password?.message}
          labelAside={
            <Link to="/recuperar" className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
              ¿Has olvidado tu contraseña?
            </Link>
          }
        >
          <div className="relative">
            <Input type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-20" {...register('password')} />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </Field>

        <Checkbox label="Mantener la sesión iniciada" description="No lo marques en un ordenador compartido." {...register('remember')} />

        <Button type="submit" variant="primary" size="lg" block loading={login.isPending} disabled={locked}>
          {locked ? `Espera ${lockedFor} s` : 'Entrar'}
        </Button>
      </form>

      {import.meta.env.DEV && (
        <section aria-labelledby="demo-title" className="mt-8 rounded-card border border-dashed border-line-strong p-4">
          <h2 id="demo-title" className="text-sm font-semibold text-fg">
            Cuentas de demostración
          </h2>
          <p className="mt-0.5 text-xs text-fg-muted">Solo en desarrollo. Datos ficticios del DemoSeeder; contraseña «password».</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map(({ email, label, description }) => (
              <button
                key={email}
                type="button"
                onClick={() => loginAsDemo(email)}
                disabled={login.isPending || locked}
                className="flex min-h-12 items-center rounded-control border border-line bg-surface-2 px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-3 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">{label}</span>
                  <span className="block truncate text-xs text-fg-subtle">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </AuthLayout>
  )
}
