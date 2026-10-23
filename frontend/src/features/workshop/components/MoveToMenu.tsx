import { ArrowRightLeft, Ban, ChevronDown, CircleCheck } from 'lucide-react'
import type { WorkOrder, WorkOrderStatus } from '@/api/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { buttonClasses, iconButtonClasses } from '@/components/ui/variants'
import { cn } from '@/lib/cn'
import { WORK_ORDER_STATUS } from '@/lib/status'
import { isFinalStatus, KANBAN_STATUSES } from './orderUtils'

/**
 * «Mover a…»: alternativa por teclado (y para pantallas táctiles) al arrastrar y soltar del tablero.
 * Entregar y cancelar pasan por `onRequest`, que pide confirmación.
 */
export function MoveToMenu({
  order,
  onRequest,
  variant = 'icon',
  disabled,
  className,
}: {
  order: WorkOrder
  onRequest: (order: WorkOrder, status: WorkOrderStatus) => void
  variant?: 'icon' | 'button'
  disabled?: boolean
  className?: string
}) {
  if (isFinalStatus(order.status)) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        data-no-drag
        aria-label={variant === 'icon' ? `Mover ${order.number} a otro estado` : undefined}
        title={variant === 'icon' ? 'Mover a…' : undefined}
        className={cn(variant === 'icon' ? iconButtonClasses({ size: 'sm' }) : buttonClasses({ size: 'sm' }), className)}
      >
        <ArrowRightLeft aria-hidden />
        {variant === 'button' && (
          <>
            Mover a…
            <ChevronDown aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Mover {order.number} a</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={order.status} onValueChange={(v) => onRequest(order, v as WorkOrderStatus)}>
          {KANBAN_STATUSES.map((s) => {
            const st = WORK_ORDER_STATUS[s]
            const Icon = st.icon
            return (
              <DropdownMenuRadioItem key={s} value={s} className="gap-2.5 [&_svg]:size-4 [&_svg]:text-fg-muted">
                <Icon aria-hidden />
                {st.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<CircleCheck aria-hidden />} onSelect={() => onRequest(order, 'delivered')}>
          Entregar al cliente…
        </DropdownMenuItem>
        <DropdownMenuItem danger icon={<Ban aria-hidden />} onSelect={() => onRequest(order, 'cancelled')}>
          Cancelar orden…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
