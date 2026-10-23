import { TriangleAlert } from 'lucide-react'
import { Checkbox } from '@/components/ui/Checkbox'

/** Aviso de km que no cuadran con lecturas anteriores (422) + casilla para confirmar. */
export function MileageConflictNotice({ message, checked, onCheckedChange }: { message: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div role="alert" className="rounded-card border border-warning/40 bg-warning-soft p-4">
      <p className="flex items-start gap-2 text-sm text-fg">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>{message}</span>
      </p>
      <Checkbox
        className="mt-2"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        label="Confirmo que el kilometraje es correcto"
        description="Por ejemplo, si cambiaste el cuentakilómetros o corriges una lectura anterior."
      />
    </div>
  )
}

/** Mensajes generales del servidor que no pertenecen a un campo concreto. */
export function FormErrors({ messages }: { messages: string[] }) {
  if (!messages.length) return null
  return (
    <div role="alert" className="rounded-card border border-danger/40 bg-danger-soft p-3 text-sm text-fg">
      <ul className="list-inside list-disc space-y-0.5">
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  )
}
