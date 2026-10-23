import * as RT from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = RT.Root

export function TabsList({ className, ...props }: ComponentProps<typeof RT.List>) {
  return (
    <RT.List
      className={cn('scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface-2 p-1', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-sm font-medium text-fg-muted transition-colors md:min-h-9',
        'hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-line',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RT.Content>) {
  return <RT.Content className={cn('mt-4 outline-none data-[state=active]:animate-fade-in', className)} {...props} />
}
