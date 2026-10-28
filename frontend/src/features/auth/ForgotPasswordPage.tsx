import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { errorMessage, isApiError } from '@/api/client'
import { useForgotPassword } from '@/api/hooks/auth'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { AuthLayout, FormAlert } from './AuthLayout'
import { useLockout } from './useLockout'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu email.').email('Ese email no parece válido.'),
})
type Values = z.infer<typeof schema>

/** Texto del contrato §3.1.1: el mismo exista o no la cuenta. */
const FORGOT_SENT_MESSAGE =
  'Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 60 minutos.'

/** /recuperar: pide el email y responde siempre lo mismo (contrato §3.1.1). */
export default function ForgotPasswordPage() {
  useDocumentTitle('Recuperar la contraseña')
  const forgot = useForgotPassword()
  const [params] = useSearchParams()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useLockout()

  const { register, handleSubmit, formState, setError, setFocus } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '' },
  })

  const onSubmit = handleSubmit(({ email }) => {
    setFormError(null)
    const normalized = email.trim().toLowerCase()
    forgot.mutate(
      { email: normalized },
      {
        onSuccess: () => setSentTo(normalized),
        onError: (err) => {
          if (isApiError(err) && err.status === 429) {
            setLockedFor(err.retryAfter ?? 60)
            setFormError(err.message)
            return
          }
          if (isApiError(err) && err.status === 422) {
            const msg = err.fieldError('email') ?? err.message
            setError('email', { type: 'server', message: msg })
            setFocus('email')
            return
          }
          setFormError(errorMessage(err))
        },
      },
    )
  })

  const locked = lockedFor > 0

  if (sentTo) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        footer={
          <Link to="/entrar" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Volver a entrar
          </Link>
        }
      >
        <div role="status" className="flex items-start gap-2.5 text-fg">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-ok" />
          <p>{FORGOT_SENT_MESSAGE}</p>
        </div>
        <p className="mt-4 text-sm text-fg-muted">
          ¿No llega? Mira en la carpeta de correo no deseado o{' '}
          <button
            type="button"
            className="font-medium text-accent-ink underline underline-offset-4"
            onClick={() => {
              setSentTo(null)
              forgot.reset()
              setTimeout(() => setFocus('email'))
            }}
          >
            pídelo otra vez
          </button>
          . Si lo pides varias veces, solo vale el último enlace.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="¿Has olvidado tu contraseña?"
      description="Escribe el email con el que entras y te enviaremos un enlace para crear una nueva."
      footer={
        <>
          ¿Ya la recuerdas?{' '}
          <Link to="/entrar" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Volver a entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError && <FormAlert lockedFor={lockedFor}>{formError}</FormAlert>}
        <Field label="Email" required error={formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...register('email')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={forgot.isPending} disabled={locked}>
          {locked ? `Espera ${lockedFor} s` : 'Enviar el enlace'}
        </Button>
      </form>
    </AuthLayout>
  )
}
