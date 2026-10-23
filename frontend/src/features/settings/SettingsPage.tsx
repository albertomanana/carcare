import { Monitor, Moon, Palette, ShieldAlert, Sun, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { isApiError, errorMessage } from '@/api/client'
import { useDeleteAccount } from '@/api/hooks/auth'
import type { Workspace } from '@/api/types'
import { useTheme } from '@/app/theme-context'
import { FormErrors } from '@/components/forms/MileageConflictNotice'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LoadingBlock } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/auth-context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { joinList, plural } from '@/lib/text'
import { PasswordCard, ProfileCard } from './AccountForms'
import { WorkspacesCard } from './WorkspacesCard'

const SECTIONS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'contrasena', label: 'Contraseña' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'espacios', label: 'Espacios' },
  { id: 'cuenta', label: 'Eliminar cuenta' },
]

/** Ajustes de la cuenta: perfil, contraseña, tema, espacios y baja. */
export default function SettingsPage() {
  useDocumentTitle('Ajustes')
  const { user, workspaces, status, error, refetch } = useAuth()
  const location = useLocation()

  // /app/ajustes#espacios (desde el selector de espacios): lleva a la sección
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [location.hash, user])

  return (
    <>
      <PageHeader title="Ajustes" description="Tu cuenta, la apariencia de CarCare y los espacios a los que perteneces." />
      {status === 'loading' ? (
        <LoadingBlock label="Cargando tus ajustes…" className="max-w-3xl" />
      ) : !user ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Secciones de ajustes" className="hidden lg:block">
            <ul className="sticky top-24 space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      'flex min-h-10 items-center rounded-control px-3 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg',
                      location.hash === `#${s.id}` && 'bg-surface-2 text-fg',
                      s.id === 'cuenta' && 'text-danger hover:text-danger',
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 max-w-3xl space-y-6">
            <ProfileCard user={user} />
            <PasswordCard />
            <AppearanceCard />
            <WorkspacesCard user={user} workspaces={workspaces} />
            <DeleteAccountCard workspaces={workspaces} />
          </div>
        </div>
      )}
    </>
  )
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  return (
    <Card id="apariencia" className="scroll-mt-24">
      <CardHeader icon={<Palette />} title="Apariencia" description="El tema se guarda en este navegador." />
      <CardBody className="space-y-4">
        <SegmentedControl
          label="Tema"
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: 'dark', label: 'Oscuro', icon: <Moon aria-hidden /> },
            { value: 'light', label: 'Claro', icon: <Sun aria-hidden /> },
          ]}
        />
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Monitor aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>Si tu sistema pide reducir el movimiento, CarCare acorta las animaciones y detiene el giro automático del modelo 3D.</span>
        </p>
      </CardBody>
    </Card>
  )
}

function DeleteAccountCard({ workspaces }: { workspaces: Workspace[] }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [otherError, setOtherError] = useState<string | null>(null)
  const remove = useDeleteAccount()
  const navigate = useNavigate()
  const personal = workspaces.find((w) => w.type === 'personal')
  const ownedWorkshops = workspaces.filter((w) => w.type === 'workshop' && w.role === 'owner')
  const otherWorkshops = workspaces.filter((w) => w.type === 'workshop' && w.role !== 'owner')

  const close = () => {
    setOpen(false)
    setPassword('')
    setFieldError(null)
    setOtherError(null)
  }

  const confirm = () => {
    if (!password) {
      setFieldError('Escribe tu contraseña para confirmar.')
      return
    }
    setFieldError(null)
    setOtherError(null)
    remove.mutate(
      { password },
      {
        onSuccess: () => {
          writeStorage(STORAGE_KEYS.lastWorkspace, null)
          toast.success('Tu cuenta se ha eliminado. Gracias por usar CarCare.')
          navigate('/', { replace: true })
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 422) setFieldError(err.fieldError('password') ?? err.message)
          else setOtherError(errorMessage(err))
        },
      },
    )
  }

  return (
    <Card id="cuenta" className="scroll-mt-24 border-danger/40">
      <CardHeader icon={<ShieldAlert />} title="Eliminar cuenta" description="Borra tu cuenta y tus datos de forma definitiva." />
      <CardBody className="space-y-4">
        <ul className="list-inside list-disc space-y-1 text-sm text-fg-muted">
          <li>
            Se borra tu garaje personal
            {personal ? ` con ${plural(personal.vehicles_count, 'vehículo', 'vehículos')} y todo su historial, gastos, recordatorios y documentos` : ''}.
          </li>
          {ownedWorkshops.length > 0 && (
            <li>
              Si eres el único propietario de {joinList(ownedWorkshops.map((w) => `«${w.name}»`))}, {ownedWorkshops.length === 1 ? 'ese taller se borrará' : 'esos talleres se borrarán'} para
              todo su equipo.
            </li>
          )}
          {otherWorkshops.length > 0 && <li>Saldrás de {joinList(otherWorkshops.map((w) => `«${w.name}»`))}; sus datos se quedan en el taller.</li>}
          <li>No se puede deshacer.</li>
        </ul>
        <div className="flex justify-end">
          <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={() => setOpen(true)}>
            Eliminar mi cuenta
          </Button>
        </div>
      </CardBody>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !o && close()}
        title="¿Eliminar tu cuenta para siempre?"
        description="Escribe tu contraseña para confirmar. Se cerrará la sesión y tus datos se borrarán."
        confirmLabel="Eliminar mi cuenta"
        loading={remove.isPending}
        onConfirm={confirm}
      >
        <Field label="Contraseña" required error={fieldError}>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {otherError && (
          <div className="mt-3">
            <FormErrors messages={[otherError]} />
          </div>
        )}
      </ConfirmDialog>
    </Card>
  )
}
