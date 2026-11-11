import * as RT from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = RT.Root

export function TabsList({ className, ...props }: ComponentProps<typeof RT.List>) {
  return (
    <RT.List
      className={cn('scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface-3/70 p-1 shadow-[inset_0_2px_3px_hsl(var(--shadow-color)/0.07)]', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold text-fg-muted transition-[color,background-color,box-shadow,translate,scale] duration-200 ease-out-soft active:scale-[0.96] md:min-h-9',
        'hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-accent-ink data-[state=active]:shadow-[0_2px_0_0_var(--line),0_6px_10px_-4px_hsl(var(--shadow-color)/0.25)]',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RT.Content>) {
  // Radix deja el panel en el orden de Tab (tabindex=0): con `outline-none` el foco llegaba a él sin verse. Usa el anillo global.
  return <RT.Content className={cn('mt-4 data-[state=active]:animate-pop-in', className)} {...props} />
}
