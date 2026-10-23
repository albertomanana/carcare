import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/auth-context'

export function NotFoundPage({
  title = 'Página no encontrada',
  description = 'La dirección no existe o ya no está disponible.',
}: {
  title?: string
  description?: string
}) {
  const { status } = useAuth()
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="font-display text-7xl font-semibold tracking-tighter text-accent-ink tabular" aria-hidden>
          404
        </span>
        <span className="mt-4 grid size-12 place-items-center rounded-full bg-surface-2 text-fg-muted">
          <Compass aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-fg-warm">{title}</h1>
        <p className="mt-2 text-fg-muted">{description}</p>
        <div className="mt-6 flex gap-2">
          <ButtonLink to={status === 'authenticated' ? '/app' : '/'} variant="primary">
            {status === 'authenticated' ? 'Ir a mi panel' : 'Ir al inicio'}
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}

export default NotFoundPage
