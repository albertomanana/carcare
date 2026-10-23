import { useQueryClient } from '@tanstack/react-query'
import { Car } from 'lucide-react'
import { lazy, type ReactNode, Suspense, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, errorMessage } from '@/api/client'
import { useVehicle } from '@/api/hooks/vehicles'
import { qk } from '@/api/keys'
import type { ID, Paginated, Vehicle } from '@/api/types'
import { Plate } from '@/components/ui/Badge'
import { Dialog, DialogBody, DialogContent } from '@/components/ui/Dialog'
import { useOptionalWorkspace } from '@/features/workspace/workspace-context'
import { formatKm } from '@/lib/format'
import { type QuickActionKind, QuickActionsContext } from './quick-actions-context'

const MileageDialog = lazy(() => import('@/features/vehicle/dialogs/MileageDialog'))
const ExpenseDialog = lazy(() => import('@/features/vehicle/dialogs/ExpenseDialog'))
const ReminderDialog = lazy(() => import('@/features/vehicle/dialogs/ReminderDialog'))

const TITLES: Record<QuickActionKind, string> = {
  mileage: 'Actualizar kilometraje',
  expense: 'Añadir gasto',
  reminder: 'Nuevo recordatorio',
  record: 'Nueva intervención',
}

type DialogKind = Exclude<QuickActionKind, 'record'>

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const ctx = useOptionalWorkspace()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [picker, setPicker] = useState<{ kind: QuickActionKind; vehicles: Vehicle[] } | null>(null)
  const [active, setActive] = useState<{ kind: DialogKind; vehicleId: ID } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const start = useCallback(
    (kind: QuickActionKind, vehicleId: ID) => {
      if (!ctx) return
      if (kind === 'record') {
        navigate(`${ctx.base}/vehiculos/${vehicleId}/intervenciones/nueva`)
        return
      }
      setActive({ kind, vehicleId })
      setDialogOpen(true)
    },
    [ctx, navigate],
  )

  const run = useCallback(
    async (kind: QuickActionKind, vehicleId?: ID) => {
      if (!ctx) return
      if (vehicleId) return start(kind, vehicleId)
      try {
        const params = { per_page: 100, sort: 'name' }
        const list = await qc.fetchQuery({
          queryKey: qk.vehicles(ctx.id, params),
          queryFn: () => api.get<Paginated<Vehicle>>(`/workspaces/${ctx.id}/vehicles`, params),
          staleTime: 30_000,
        })
        if (list.data.length === 0) {
          toast('Primero añade un vehículo', {
            action: { label: 'Añadir', onClick: () => navigate(`${ctx.base}/vehiculos/nuevo`) },
          })
        } else if (list.data.length === 1) {
          start(kind, list.data[0].id)
        } else {
          setPicker({ kind, vehicles: list.data })
        }
      } catch (err) {
        toast.error(errorMessage(err))
      }
    },
    [ctx, qc, navigate, start],
  )

  const value = useMemo(() => ({ run: (kind: QuickActionKind, vehicleId?: ID) => void run(kind, vehicleId) }), [run])

  return (
    <QuickActionsContext.Provider value={value}>
      {children}

      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent title={picker ? TITLES[picker.kind] : ''} description="¿En qué vehículo?" size="md">
          <DialogBody className="grid gap-2">
            {picker?.vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  const kind = picker.kind
                  setPicker(null)
                  setTimeout(() => start(kind, v.id), 0)
                }}
                className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface-2 px-4 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-line"
                  style={{ backgroundColor: v.color_hex ?? undefined }}
                  aria-hidden
                >
                  <Car className="size-4 text-white mix-blend-difference" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{v.display_name}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {[v.customer?.name, v.current_mileage !== null ? formatKm(v.current_mileage) : 'Sin kilometraje'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Plate value={v.plate} />
              </button>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {active && <ActiveDialog kind={active.kind} vehicleId={active.vehicleId} open={dialogOpen} onOpenChange={setDialogOpen} />}
    </QuickActionsContext.Provider>
  )
}

function ActiveDialog({ kind, vehicleId, open, onOpenChange }: { kind: DialogKind; vehicleId: ID; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: vehicle } = useVehicle(vehicleId)
  if (!vehicle) return null
  return (
    <Suspense fallback={null}>
      {kind === 'mileage' && <MileageDialog vehicle={vehicle} open={open} onOpenChange={onOpenChange} />}
      {kind === 'expense' && <ExpenseDialog vehicle={vehicle} open={open} onOpenChange={onOpenChange} />}
      {kind === 'reminder' && <ReminderDialog vehicle={vehicle} open={open} onOpenChange={onOpenChange} />}
    </Suspense>
  )
}
