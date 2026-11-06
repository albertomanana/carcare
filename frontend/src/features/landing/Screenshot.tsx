import { Tilt } from '@/components/ui/Tilt'
import { cn } from '@/lib/cn'
import { SHOTS, type ShotName } from './shots'

const BASE = import.meta.env.BASE_URL ?? '/'

// Posición de reposo en pantallas anchas: el panel está girado hacia el centro y se endereza al pasar el ratón.
const REST = {
  left: 'md:[transform:perspective(1400px)_rotateY(17deg)_rotateX(3deg)] md:hover:[transform:perspective(1400px)]',
  right: 'md:[transform:perspective(1400px)_rotateY(-17deg)_rotateX(3deg)] md:hover:[transform:perspective(1400px)]',
  flat: '',
} as const

interface ScreenshotProps {
  shot: ShotName
  /** Ancho con el que se muestra, para elegir la de 640 o la de 1200. */
  sizes: string
  /** Hacia dónde está girado el panel en reposo (en móvil siempre plano). */
  rest?: keyof typeof REST
  className?: string
}

/** Captura real de la app en un panel con grosor. Diferida (`loading="lazy"`) y con ancho y alto fijos para no mover la página. */
export function Screenshot({ shot, sizes, rest = 'flat', className }: ScreenshotProps) {
  const { file, alt } = SHOTS[shot]
  return (
    <figure className={cn('min-w-0', className)}>
      <div className={cn('preserve-3d transition-transform duration-500 ease-out-soft', REST[rest])}>
        <Tilt max={5} className="rounded-card">
          <div className="zoom rounded-card border border-line bg-surface [box-shadow:0_1px_0_rgb(255_255_255/0.06)_inset,0_4px_0_var(--surface-3),0_5px_0_var(--line),0_40px_50px_-24px_hsl(var(--shadow-color)/0.85)]">
            <img
              src={`${BASE}img/portada/${file}-1200.webp`}
              srcSet={`${BASE}img/portada/${file}-640.webp 640w, ${BASE}img/portada/${file}-1200.webp 1200w`}
              sizes={sizes}
              width={1200}
              height={751}
              alt={alt}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="block aspect-[16/10] h-auto w-full object-cover object-top"
            />
          </div>
        </Tilt>
      </div>
    </figure>
  )
}
