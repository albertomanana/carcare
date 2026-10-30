import { Store } from 'lucide-react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { useWorkspace } from './workspace-context'

type Page = LazyExoticComponent<ComponentType> | ComponentType

/**
 * Misma ruta, pantalla distinta según el tipo de espacio (E16: `solicitudes` es la bandeja en un taller y
 * "Mis solicitudes" en un espacio personal). Sin pantalla para ese tipo, explica dónde se hace.
 */
export function ByWorkspaceType({ personal: Personal, workshop: Workshop, title }: { personal: Page | null; workshop: Page | null; title: string }) {
  const ctx = useWorkspace()
  const Component = ctx.isWorkshop ? Workshop : Personal
  if (Component) return <Component />
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={<Store />}
        title={ctx.isWorkshop ? 'Esto se hace desde tu espacio personal' : 'Esto es del modo taller'}
        description={
          ctx.isWorkshop
            ? 'Las solicitudes de reparación las envía un particular desde su garaje. Cambia a tu espacio personal con el selector de espacios.'
            : 'Cambia a un espacio de taller con el selector de espacios.'
        }
      />
    </>
  )
}
