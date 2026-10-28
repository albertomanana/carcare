import { ChevronDown, Search, X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { todayISO } from '@/lib/format'
import { useFieldContext } from './field-context'
import { inputClasses } from './variants'

function useControlA11y(id?: string, invalid?: boolean, describedBy?: string) {
  const field = useFieldContext()
  return {
    id: id ?? field?.id,
    'aria-invalid': (invalid ?? field?.invalid) || undefined,
    'aria-describedby': [describedBy, field?.describedBy].filter(Boolean).join(' ') || undefined,
    'aria-required': field?.required || undefined,
  }
}

export interface InputProps extends Omit<ComponentProps<'input'>, 'prefix'> {
  invalid?: boolean
  prefix?: ReactNode
  suffix?: ReactNode
  wrapperClassName?: string
}

export function Input({ className, wrapperClassName, invalid, prefix, suffix, id, 'aria-describedby': describedBy, ...props }: InputProps) {
  const a11y = useControlA11y(id, invalid, describedBy)
  if (!prefix && !suffix) return <input className={cn(inputClasses, className)} {...a11y} {...props} />
  return (
    <div className={cn('relative flex items-center', wrapperClassName)}>
      {prefix && <span className="pointer-events-none absolute left-3 flex items-center text-fg-subtle [&_svg]:size-4">{prefix}</span>}
      <input className={cn(inputClasses, prefix && 'pl-9', suffix && 'pr-12', className)} {...a11y} {...props} />
      {suffix && <span className="pointer-events-none absolute right-3 text-sm text-fg-subtle">{suffix}</span>}
    </div>
  )
}

export function Textarea({ className, id, 'aria-describedby': describedBy, rows = 3, ...props }: ComponentProps<'textarea'>) {
  const a11y = useControlA11y(id, undefined, describedBy)
  return <textarea rows={rows} className={cn(inputClasses, 'h-auto min-h-20 py-2.5 leading-relaxed md:h-auto', className)} {...a11y} {...props} />
}

export interface SelectProps extends ComponentProps<'select'> {
  placeholder?: string
}

/** Select nativo con estilo: accesible y cómodo en móvil. */
/**
 * Clases que deciden si el control se ve y dónde se coloca. Van al contenedor (que lleva el icono) y no al `<select>`:
 * con `md:hidden` en el `<select>` la flecha se quedaba sola en la pantalla, y `sm:col-span-2` o `sm:ml-auto` no
 * hacían nada porque el elemento de la rejilla o de la fila flexible es el contenedor. El ancho sigue en el `<select>`.
 */
const WRAPPER_CLASS = /^([\w@[\]-]+:)*(hidden|block|inline-block|col-span-\S+|row-start-\S+|-?m[trblxy]?-\S+|self-\S+|order-\S+)$/

function splitSelectClasses(className: string | undefined): [string, string] {
  const wrapper: string[] = []
  const own: string[] = []
  for (const token of (className ?? '').split(/\s+/).filter(Boolean)) (WRAPPER_CLASS.test(token) ? wrapper : own).push(token)
  return [wrapper.join(' '), own.join(' ')]
}

export function Select({ className, id, 'aria-describedby': describedBy, children, placeholder, ...props }: SelectProps) {
  const a11y = useControlA11y(id, undefined, describedBy)
  const [wrapperClass, ownClass] = splitSelectClasses(className)
  className = ownClass
  return (
    <div className={cn('relative', wrapperClass)}>
      <select className={cn(inputClasses, 'appearance-none pr-9', className)} {...a11y} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  )
}

/** Importe en euros. El valor es texto ('1234,56'); se normaliza al enviar (toMoneyString). */
export function MoneyInput(props: Omit<InputProps, 'type' | 'suffix'>) {
  return <Input type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" suffix="€" className="tabular text-right" {...props} />
}

/** Kilómetros enteros. El valor es texto; se convierte con parseIntegerInput. */
export function MileageInput(props: Omit<InputProps, 'type' | 'suffix'>) {
  return <Input type="text" inputMode="numeric" autoComplete="off" placeholder="0" suffix="km" className="tabular text-right" {...props} />
}

/** Fecha 'YYYY-MM-DD' nativa. `allowFuture=false` limita a hoy. */
export function DateInput({ allowFuture = true, max, ...props }: Omit<InputProps, 'type'> & { allowFuture?: boolean }) {
  return <Input type="date" max={max ?? (allowFuture ? undefined : todayISO())} className="tabular" {...props} />
}

export interface SearchInputProps extends Omit<InputProps, 'type' | 'prefix' | 'onChange' | 'value'> {
  value: string
  onValueChange: (value: string) => void
}

export function SearchInput({ value, onValueChange, placeholder = 'Buscar…', className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-fg-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClasses, 'pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden')}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="absolute right-1 grid size-9 place-items-center rounded-control text-fg-subtle hover:text-fg"
          aria-label="Borrar búsqueda"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
