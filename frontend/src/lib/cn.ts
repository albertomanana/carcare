import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** tailwind-merge con los radios propios del sistema (rounded-control, rounded-card, rounded-hero). */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['control', 'card', 'hero'],
      font: ['display'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
