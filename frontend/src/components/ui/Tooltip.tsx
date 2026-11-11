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
          className="hud-pop z-[60] max-w-xs !rounded-xl px-3 py-2 text-xs font-medium text-fg data-[state=delayed-open]:animate-pop-in"
        >
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  )
}
