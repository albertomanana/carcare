import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Muelle sin rebote apreciable: sigue al puntero con inercia y vuelve a su sitio sin pasarse. Decorativo, así que puede ser blando.
const SPRING = { stiffness: 220, damping: 24, mass: 0.6 } as const

export interface TiltProps {
  children: ReactNode
  className?: string
  /** Grados máximos de inclinación hacia cada lado (8 por defecto: más se lee como juguete). */
  max?: number
  /** Brillo que sigue al puntero sobre la superficie. */
  glare?: boolean
  /** Distancia de la perspectiva en px. */
  perspective?: number
}

/**
 * Inclina su contenido hacia el puntero, como una losa sobre un eje, y deja que lo que lleve `.z-near` se despegue de ella.
 * Solo reacciona a un ratón (`pointerType === 'mouse'`): en táctil el hover se queda pegado, y con `prefers-reduced-motion`
 * no se mueve. El giro va directo al `transform` del elemento (no a una variable CSS del padre) para no recalcular estilos
 * de todos sus hijos. Úsalo en tarjetas que llevan a algún sitio, no en cifras ni en tablas que se leen.
 */
export function Tilt({ children, className, max = 8, glare = true, perspective = 1000 }: TiltProps) {
  const reduce = useReducedMotion()
  const rotateX = useSpring(0, SPRING)
  const rotateY = useSpring(0, SPRING)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const glow = useSpring(0, { stiffness: 260, damping: 30 })
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.1), transparent 62%)`

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - box.left) / box.width
    const py = (e.clientY - box.top) / box.height
    rotateY.set((px - 0.5) * max * 2)
    rotateX.set((0.5 - py) * max * 2)
    gx.set(px * 100)
    gy.set(py * 100)
    glow.set(1)
  }
  const leave = () => {
    rotateX.set(0)
    rotateY.set(0)
    glow.set(0)
  }

  if (reduce) return <div className={className}>{children}</div>

  return (
    <div style={{ perspective }} className={cn('min-w-0', className)} onPointerMove={move} onPointerLeave={leave}>
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }} className="relative h-full rounded-[inherit]">
        {children}
        {glare && <motion.span aria-hidden style={{ background: sheen, opacity: glow }} className="pointer-events-none absolute inset-0 rounded-[inherit]" />}
      </motion.div>
    </div>
  )
}
