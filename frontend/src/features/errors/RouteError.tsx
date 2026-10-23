import { RotateCcw, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { NotFoundPage } from './NotFoundPage'

/** errorElement de las rutas: errores de render o de carga de chunks. */
export function RouteError() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  const chunkError = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message)

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex max-w-md flex-col items-center text-center" role="alert">
        <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
          <TriangleAlert aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold text-fg-warm">
          {chunkError ? 'Hay una versión nueva de CarCare' : 'Algo se ha roto en esta pantalla'}
        </h1>
        <p className="mt-2 text-fg-muted">
          {chunkError
            ? 'Recarga la página para cargar la última versión.'
            : 'Ha ocurrido un error inesperado. Puedes recargar o volver a tu panel; tus datos están a salvo en el servidor.'}
        </p>
        {import.meta.env.DEV && error instanceof Error && (
          <pre className="mt-4 max-h-40 w-full overflow-auto rounded-control bg-surface-2 p-3 text-left text-xs text-fg-muted">{error.message}</pre>
        )}
        <div className="mt-6 flex gap-2">
          <Button variant="primary" icon={<RotateCcw aria-hidden />} onClick={() => window.location.reload()}>
            Recargar
          </Button>
          <ButtonLink to="/app">Ir a mi panel</ButtonLink>
        </div>
      </div>
    </main>
  )
}
