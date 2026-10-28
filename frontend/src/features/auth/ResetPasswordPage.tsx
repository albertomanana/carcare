import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { errorMessage, isApiError } from '@/api/client'
import { useResetPassword } from '@/api/hooks/auth'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthLayout, FormAlert, PasswordToggle } from './AuthLayout'
import { useLockout } from './useLockout'

const schema = z
  .object({
    password: z.string().min(8, 'Usa al menos 8 caracteres.').max(255, 'Usa como mucho 255 caracteres.'),
    password_confirmation: z.string().min(1, 'Repite la contraseña.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Las dos contraseñas no coinciden.',
  })
type Values = z.infer<typeof schema>

/** Aviso que se muestra en /entrar tras cambiarla (contrato §3.1.1). */
const RESET_DONE_NOTICE = 'Contraseña cambiada. Entra con la nueva; hemos cerrado las sesiones abiertas.'

/** El enlace caducado, usado o de otra cuenta: el mensaje de la API va con la forma de pedir otro. */
function LinkProblem({ message, email }: { message: string; email: string | null }) {
  const to = email ? `/recuperar?email=${encodeURIComponent(email)}` : '/recuperar'
  return (
    <FormAlert>
      {message}{' '}
      <Link to={to} className="font-medium text-accent-ink underline underline-offset-4">
        Pedir un enlace nuevo
      </Link>
    </FormAlert>
  )
}

/** /restablecer?token=…&email=…: contraseña nueva dos veces (contrato §3.1.1). */
export default function ResetPasswordPage() {
  useDocumentTitle('Crear una contraseña nueva')
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() ?? ''
  const email = params.get('email')?.trim().toLowerCase() ?? ''
  const navigate = useNavigate()
  const reset = useResetPassword()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useLockout()

  const { register, handleSubmit, formState, setError, setFocus } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', password_confirmation: '' },
  })
  const errors = formState.errors

  if (!token || !email) {
    return (
      <AuthLayout title="El enlace está incompleto">
        <p className="text-fg">
          Al enlace le falta una parte. Ábrelo de nuevo desde el correo, sin recortarlo, o pide uno nuevo: caduca a los 60 minutos.
        </p>
        <ButtonLink to="/recuperar" variant="primary" size="lg" block className="mt-6">
          Pedir un enlace nuevo
        </ButtonLink>
      </AuthLayout>
    )
  }

  const onSubmit = handleSubmit((v) => {
    setFormError(null)
    setLinkError(null)
    reset.mutate(
      { token, email, password: v.password, password_confirmation: v.password_confirmation },
      {
        onSuccess: () => navigate('/entrar', { replace: true, state: { notice: RESET_DONE_NOTICE } }),
        onError: (err) => {
          if (isApiError(err) && err.status === 429) {
            setLockedFor(err.retryAfter ?? 60)
            setFormError(err.message)
            return
          }
          if (isApiError(err) && err.status === 422) {
            const linkMsg = err.fieldError('token') ?? err.fieldError('email')
            const passwordMsg = err.fieldError('password')
            const confirmationMsg = err.fieldError('password_confirmation')
            if (passwordMsg) setError('password', { type: 'server', message: passwordMsg })
            if (confirmationMsg) setError('password_confirmation', { type: 'server', message: confirmationMsg })
            if (linkMsg) setLinkError(linkMsg)
            else if (!passwordMsg && !confirmationMsg) setFormError(err.message)
            if (passwordMsg) setFocus('password')
            return
          }
          setFormError(errorMessage(err))
        },
      },
    )
  })

  const locked = lockedFor > 0

  return (
    <AuthLayout
      title="Crea una contraseña nueva"
      description="Al guardarla se cierran las sesiones abiertas en todos tus dispositivos."
      footer={
        <Link to="/entrar" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Volver a entrar
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {linkError && <LinkProblem message={linkError} email={email} />}
        {formError && <FormAlert lockedFor={lockedFor}>{formError}</FormAlert>}

        <Field label="Cuenta">
          <Input type="email" autoComplete="username" value={email} readOnly />
        </Field>

        <Field label="Contraseña nueva" required hint="Al menos 8 caracteres." error={errors.password?.message}>
          <div className="relative">
            <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" autoFocus className="pr-20" {...register('password')} />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </Field>

        <Field label="Repite la contraseña" required error={errors.password_confirmation?.message}>
          <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password_confirmation')} />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={reset.isPending} disabled={locked}>
          {locked ? `Espera ${lockedFor} s` : 'Guardar la contraseña'}
        </Button>
      </form>
    </AuthLayout>
  )
}
