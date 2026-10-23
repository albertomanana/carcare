import { CircleAlert, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import type { ItemKind, LineItem, LineItemInput } from '@/api/types'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/inputs'
import { cn } from '@/lib/cn'
import { formatMoney, moneyToInput, normalizeDecimalInput, toMoneyString } from '@/lib/format'
import { ITEM_KIND_LABEL } from '@/lib/labels'
import { centsToMoney, lineTotalCents } from '@/lib/lineItems'
import { amountError, quantityError } from '@/lib/validation'

export const MAX_ITEMS = 50

export interface LineItemFormValue {
  kind: ItemKind
  name: string
  part_number: string
  quantity: string
  unit_price: string
}

export const lineItemSchema = z
  .object({
    kind: z.enum(['part', 'labor', 'fluid', 'other']),
    name: z.string().trim().min(1, 'Indica el concepto.').max(120, 'Máximo 120 caracteres.'),
    part_number: z.string().max(60, 'Máximo 60 caracteres.'),
    quantity: z.string(),
    unit_price: z.string(),
  })
  .superRefine((v, ctx) => {
    const q = quantityError(v.quantity)
    if (q) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: q })
    const p = amountError(v.unit_price)
    if (p) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit_price'], message: p })
  })

export function emptyLine(kind: ItemKind = 'part'): LineItemFormValue {
  return { kind, name: '', part_number: '', quantity: '1', unit_price: '' }
}

export function lineToForm(item: LineItem): LineItemFormValue {
  return {
    kind: item.kind,
    name: item.name,
    part_number: item.part_number ?? '',
    quantity: item.quantity.replace(/\.00$/, '').replace('.', ','),
    unit_price: moneyToInput(item.unit_price),
  }
}

export function formToLine(v: LineItemFormValue): LineItemInput {
  return {
    kind: v.kind,
    name: v.name.trim(),
    part_number: v.part_number.trim() || null,
    quantity: normalizeDecimalInput(v.quantity) ?? '1',
    unit_price: toMoneyString(v.unit_price),
  }
}

type WithItems = { items: LineItemFormValue[] }

const ADD_BUTTONS: { kind: ItemKind; label: string }[] = [
  { kind: 'part', label: 'Pieza' },
  { kind: 'labor', label: 'Mano de obra' },
  { kind: 'fluid', label: 'Fluido' },
]

/**
 * Editor de líneas (piezas, mano de obra, fluidos…). El total de cada línea se calcula en céntimos
 * con las mismas reglas que el servidor; el servidor sigue siendo quien guarda el valor definitivo.
 * `showPrices = false` oculta importes (rol mecánico en talleres) pero conserva los precios existentes.
 */
export function LineItemsEditor<T extends FieldValues & WithItems>({ form, showPrices = true, disabled }: { form: UseFormReturn<T>; showPrices?: boolean; disabled?: boolean }) {
  const f = form as unknown as UseFormReturn<WithItems>
  const { fields, append, remove } = useFieldArray({ control: f.control, name: 'items' })
  const items = useWatch({ control: f.control, name: 'items' }) ?? []
  const errors = f.formState.errors.items

  // Container queries: la tabla de columnas solo aparece si el contenedor es ancho (≥ 48rem), no la ventana
  return (
    <div className="@container">
      {fields.length > 0 && (
        <div
          aria-hidden
          className={cn(
            'hidden gap-2 px-1 pb-2 text-xs font-medium text-fg-subtle @3xl:grid',
            showPrices ? '@3xl:grid-cols-[120px_minmax(0,1fr)_110px_72px_104px_92px_40px]' : '@3xl:grid-cols-[120px_minmax(0,1fr)_110px_72px_40px]',
          )}
        >
          <span>Tipo</span>
          <span>Concepto</span>
          <span>Referencia</span>
          <span className="text-right">Cant.</span>
          {showPrices && <span className="text-right">Precio/u</span>}
          {showPrices && <span className="text-right">Total</span>}
          <span />
        </div>
      )}
      <ol className="space-y-2">
        {fields.map((field, i) => {
          const rowErrors = errors?.[i]
          const total = lineTotalCents(items[i] ?? { quantity: null, unit_price: null })
          const n = i + 1
          return (
            <li
              key={field.id}
              className={cn(
                'grid grid-cols-2 gap-2 rounded-card border border-line bg-surface-2/40 p-3 @3xl:items-start @3xl:rounded-control @3xl:border-0 @3xl:bg-transparent @3xl:p-0',
                showPrices ? '@3xl:grid-cols-[120px_minmax(0,1fr)_110px_72px_104px_92px_40px]' : '@3xl:grid-cols-[120px_minmax(0,1fr)_110px_72px_40px]',
              )}
            >
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-fg-muted @3xl:sr-only">Tipo (línea {n})</span>
                <Select disabled={disabled} {...f.register(`items.${i}.kind`)}>
                  {(Object.keys(ITEM_KIND_LABEL) as ItemKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ITEM_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="col-span-2 row-start-2 flex min-w-0 flex-col gap-1 @3xl:col-span-1 @3xl:row-start-auto">
                <span className="text-xs text-fg-muted @3xl:sr-only">Concepto (línea {n})</span>
                <Input invalid={!!rowErrors?.name} disabled={disabled} maxLength={120} placeholder="P. ej. Filtro de aceite" {...f.register(`items.${i}.name`)} />
                {rowErrors?.name && <RowError message={rowErrors.name.message} />}
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-fg-muted @3xl:sr-only">Referencia (línea {n})</span>
                <Input disabled={disabled} maxLength={60} placeholder="Opcional" {...f.register(`items.${i}.part_number`)} />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-fg-muted @3xl:sr-only">Cantidad (línea {n})</span>
                <Input invalid={!!rowErrors?.quantity} disabled={disabled} inputMode="decimal" className="tabular text-right" {...f.register(`items.${i}.quantity`)} />
                {rowErrors?.quantity && <RowError message={rowErrors.quantity.message} />}
              </label>
              {showPrices && (
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-fg-muted @3xl:sr-only">Precio unitario (línea {n})</span>
                  <Input invalid={!!rowErrors?.unit_price} disabled={disabled} inputMode="decimal" placeholder="0,00" className="tabular text-right" suffix="€" {...f.register(`items.${i}.unit_price`)} />
                  {rowErrors?.unit_price && <RowError message={rowErrors.unit_price.message} />}
                </label>
              )}
              {showPrices && (
                <div className="flex min-h-11 items-center justify-end text-sm font-medium tabular @3xl:min-h-10">
                  <span className="mr-auto text-xs font-normal text-fg-muted @3xl:hidden">Total</span>
                  {total === null ? <span className="text-fg-subtle">Sin precio</span> : <span className="text-fg">{formatMoney(centsToMoney(total))}</span>}
                </div>
              )}
              <div className="col-start-2 row-start-1 flex justify-end @3xl:col-start-auto @3xl:row-start-auto">
                <IconButton label={`Quitar la línea ${n}`} onClick={() => remove(i)} disabled={disabled}>
                  <Trash2 aria-hidden />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ol>
      {!disabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ADD_BUTTONS.map(({ kind, label }) => (
            <Button key={kind} size="sm" icon={<Plus aria-hidden />} onClick={() => append(emptyLine(kind))} disabled={fields.length >= MAX_ITEMS}>
              {label}
            </Button>
          ))}
          {fields.length >= MAX_ITEMS && <p className="self-center text-xs text-fg-subtle">Máximo {MAX_ITEMS} líneas.</p>}
        </div>
      )}
    </div>
  )
}

function RowError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <span className="flex items-start gap-1 text-xs font-medium text-danger">
      <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
      {message}
    </span>
  )
}
