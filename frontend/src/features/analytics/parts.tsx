/**
 * Piezas de la pantalla de Analítica: cifras clave, gráfico mensual con tabla y listas de barras.
 * Reglas de simplificación (informe UX §4): como mucho 3 cifras grandes, sin caja dentro de caja
 * (solo el gráfico va en caja), sin etiquetas en mayúsculas y sin iconos de adorno.
 */
import { ChevronRight } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import type { Money, YearMonth } from '@/api/types'
import { HBarList, MonthlyBars } from '@/components/charts/Charts'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { currentMonthKey } from '@/lib/analytics'
import { formatMoney, formatMonth } from '@/lib/format'
import { plural } from '@/lib/text'

// ───────── Cifras clave (máximo 3) ─────────

export interface Figure {
  label: string
  value: ReactNode
  /** Texto pequeño bajo la cifra (contexto). */
  hint?: ReactNode
}

export function Figures({ items, label }: { items: [Figure] | [Figure, Figure] | [Figure, Figure, Figure]; label: string }) {
  return (
    <section aria-label={label}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-sm text-fg-muted">{item.label}</dt>
            <dd className="mt-1 font-display text-xl font-semibold tracking-tight text-fg-warm tabular md:text-2xl">{item.value}</dd>
            {item.hint && <dd className="mt-0.5 text-xs text-fg-muted">{item.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}

// ───────── Sección con título (sin recuadro) ─────────

export function Block({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0">
      <h2 id={`${id}-titulo`} className="font-display text-lg font-semibold tracking-tight text-fg-warm">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// ───────── Gráfico mensual + tabla visible ─────────

/**
 * Barras mensuales (Recharts, sin animación). La alternativa accesible es una tabla visible
 * dentro de «Ver los datos en una tabla», que sirve a todo el mundo y no solo a lectores de pantalla.
 */
export function MonthlyChart({ data, label, valueHeader }: { data: { month: YearMonth; total: Money }[]; label: string; valueHeader: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <MonthlyBars data={data} label={label} highlightMonth={currentMonthKey()} srTable={false} height={200} />
      <details className="group mt-3 border-t border-line pt-1">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-control text-sm text-fg-muted hover:text-fg md:min-h-9 [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 transition-transform duration-150 ease-out-soft group-open:rotate-90" />
          Ver los datos en una tabla
        </summary>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line text-fg-muted">
              <th scope="col" className="py-2 text-left font-medium">
                Mes
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {valueHeader}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((row) => (
              <tr key={row.month}>
                <th scope="row" className="py-2 text-left font-normal text-fg first-letter:uppercase">
                  {formatMonth(row.month, 'long')}
                </th>
                <td className="py-2 text-right text-fg tabular">{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  )
}

// ───────── Listas de barras con «Mostrar más» ─────────

export interface BarItem {
  key: string | number
  label: ReactNode
  sublabel?: ReactNode
  value: number
  display: string
}

/** HBarList que enseña los `initial` primeros y deja desplegar el resto. */
export function ExpandableBars({ items, initial = 6, what, emptyText }: { items: BarItem[]; initial?: number; what: [string, string]; emptyText: string }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const hidden = Math.max(0, items.length - initial)
  const shown = open ? items : items.slice(0, initial)
  return (
    <>
      <div id={listId}>
        <HBarList items={shown} emptyText={emptyText} />
      </div>
      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="-ml-3 mt-2" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
          {open ? 'Mostrar menos' : `Mostrar ${plural(hidden, what[0], what[1])} más`}
        </Button>
      )}
    </>
  )
}

/**
 * Esqueleto simple (3 bloques). Aparece con 300 ms de retraso para no parpadear
 * cuando la respuesta llega enseguida.
 */
export function ContentSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-[cc-fade-in_150ms_300ms_both] space-y-10">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
