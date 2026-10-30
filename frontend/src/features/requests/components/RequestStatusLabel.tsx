import type { RepairRequest } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { TONE_CLASSES } from '@/lib/status'
import { requestStatusDescriptor } from '../requestStatus'

/**
 * Estado de una solicitud con icono y texto (nunca solo color). Solo es píldora cuando le toca actuar a quien mira
 * (R5): "Presupuesto recibido" para el particular; "Nueva" y "Aceptada · falta el presupuesto" para el taller.
 */
export function RequestStatusLabel({ request, className }: { request: Pick<RepairRequest, 'status' | 'perspective' | 'work_order'>; className?: string }) {
  const d = requestStatusDescriptor(request)
  const Icon = d.icon
  if (d.attention) {
    return (
      <Badge tone={d.tone} icon={<Icon aria-hidden />} className={className}>
        {d.label}
      </Badge>
    )
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-sm', TONE_CLASSES[d.tone].text, className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{d.label}</span>
    </span>
  )
}
