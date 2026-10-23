import { cn } from '@/lib/cn'
import { initials } from '@/lib/text'

export function Avatar({ name, size = 'md', className, highlight }: { name: string | null | undefined; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; highlight?: boolean }) {
  const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 select-none place-items-center rounded-full border font-display font-semibold',
        highlight ? 'border-accent/60 bg-accent-soft text-accent-ink' : 'border-line bg-surface-3 text-fg',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
