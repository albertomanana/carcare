import type { WorkshopDashboard } from '@/api/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FirstStepsGuide } from '@/components/vehicles/FirstSteps'
import { useWorkspace } from '@/features/workspace/workspace-context'
import type { workshopFirstSteps } from '@/lib/firstSteps'
import { plural } from '@/lib/text'

/**
 * Primeros pasos de un taller recién creado (10/11/2026): revisar los elevadores → dar de alta el primer cliente →
 * abrir la primera orden. Todo con rutas que ya existen: los ajustes del taller, el alta de cliente y la nueva orden.
 * Vive en la portada del taller (antes, en el Inicio que se fusionó con «Taller» el 11/11/2026).
 */
export function WorkshopFirstSteps({
  data,
  steps,
  onHide,
  onConfirmBays,
}: {
  data: Pick<WorkshopDashboard, 'bays'>
  steps: NonNullable<ReturnType<typeof workshopFirstSteps>>
  onHide: () => void
  onConfirmBays: () => void
}) {
  const ctx = useWorkspace()
  const done = (key: string) => steps.find((s) => s.key === key)?.done ?? false
  const bays = data.bays.length
  return (
    <FirstStepsGuide
      onHide={onHide}
      steps={[
        {
          key: 'bays',
          title: 'Indica cuántos elevadores tiene el taller',
          why: `Ahora tiene ${plural(bays, 'elevador', 'elevadores')}. Son los puestos donde subís los coches: los verás en la maqueta y al abrir una orden.`,
          done: done('bays'),
          action: (
            <ButtonLink to={`/app/ajustes?ajustar=${ctx.id}#espacios`} variant="primary">
              Cambiar los elevadores
            </ButtonLink>
          ),
          alternative: (
            <Button variant="ghost" onClick={onConfirmBays}>
              Son {bays}, está bien
            </Button>
          ),
        },
        {
          key: 'customer',
          title: 'Da de alta tu primer cliente',
          why: 'Con su nombre y su teléfono. Después le añades sus vehículos y le abres órdenes.',
          done: done('customer'),
          action: (
            <ButtonLink to={`${ctx.base}/clientes?nuevo=1`} variant="primary">
              Añadir cliente
            </ButtonLink>
          ),
        },
        {
          key: 'order',
          title: 'Abre tu primera orden de trabajo',
          why: 'Una orden es un trabajo para un coche: qué le pasa, quién lo hace y cuándo se entrega. Empieza en «Recibido» y la mueves por el tablero.',
          done: done('order'),
          action: (
            <ButtonLink to={`${ctx.base}/ordenes/nueva`} variant="primary">
              Abrir orden
            </ButtonLink>
          ),
        },
      ]}
    />
  )
}
