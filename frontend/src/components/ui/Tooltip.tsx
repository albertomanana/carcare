import * as RT from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = RT.Provider

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-control border border-line bg-surface-3 px-2.5 py-1.5 text-xs text-fg shadow-lg data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  )
}
