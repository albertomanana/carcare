import { type ReactNode, useId } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  /** Texto accesible si `label` es solo un icono. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** Nombre accesible del grupo. */
  label: string
  size?: 'sm' | 'md'
  className?: string
  block?: boolean
}

/** Grupo de radios nativos con estilo de control segmentado (flechas del teclado incluidas). */
export function SegmentedControl<T extends string>({ value, onValueChange, options, label, size = 'md', className, block }: SegmentedControlProps<T>) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full border border-line bg-surface-3/70 p-1 shadow-[inset_0_2px_3px_hsl(var(--shadow-color)/0.07)]', block && 'flex w-full', className)}>
      {options.map((opt) => {
        const checked = opt.value === value
        return (
          <label
            key={opt.value}
            className={cn(
              'relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 font-bold transition-[color,background-color,box-shadow,scale] duration-150 ease-out-soft active:scale-[0.96]',
              size === 'sm' ? 'min-h-12 text-xs lg:min-h-8' : 'min-h-12 text-sm lg:min-h-9',
              checked ? 'bg-surface text-accent-ink shadow-[0_2px_0_0_var(--line),0_6px_10px_-4px_hsl(var(--shadow-color)/0.25)]' : 'text-fg-muted hover:text-fg',
              '[&_svg]:size-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onValueChange(opt.value)}
              className="sr-only"
              aria-label={opt.ariaLabel}
            />
            {opt.icon}
            {opt.label}
          </label>
        )
      })}
    </div>
  )
}
