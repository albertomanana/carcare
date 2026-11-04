import { cn } from '@/lib/cn'
import { SHOTS, type ShotName } from './shots'

const BASE = import.meta.env.BASE_URL ?? '/'

interface ScreenshotProps {
  shot: ShotName
  caption: string
  /** Ancho con el que se muestra, para elegir la de 640 o la de 1200. */
  sizes: string
  className?: string
}

/** Captura real de la app con su pie. Diferida (`loading="lazy"`) y con ancho y alto fijos para no mover la página. */
export function Screenshot({ shot, caption, sizes, className }: ScreenshotProps) {
  const { file, alt } = SHOTS[shot]
  return (
    <figure className={cn('min-w-0', className)}>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
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
      <figcaption className="mt-3 text-sm text-fg-muted">{caption}</figcaption>
    </figure>
  )
}
