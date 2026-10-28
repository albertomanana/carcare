import * as DM from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group
export const DropdownMenuRadioGroup = DM.RadioGroup
export const DropdownMenuSub = DM.Sub

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-[60] min-w-52 overflow-hidden rounded-card border border-line bg-surface-2 p-1.5 shadow-2xl shadow-black/30 data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  )
}

const itemClasses =
  'relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-control px-2.5 text-sm text-fg outline-none md:min-h-9 ' +
  'data-[highlighted]:bg-surface-3 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted'

export function DropdownMenuItem({ className, icon, danger, children, ...props }: ComponentProps<typeof DM.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <DM.Item className={cn(itemClasses, danger && 'text-danger [&_svg]:text-danger', className)} {...props}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DM.Item>
  )
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn(itemClasses, 'pl-8', className)} {...props}>
      <DM.ItemIndicator className="absolute left-2.5">
        <Check aria-hidden className="!text-accent-ink" />
      </DM.ItemIndicator>
      {children}
    </DM.RadioItem>
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 pb-1 pt-2 text-xs font-medium text-fg-subtle', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1.5 my-1.5 h-px bg-line', className)} {...props} />
}
