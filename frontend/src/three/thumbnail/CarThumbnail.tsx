/**
 * Miniatura estática para listados: NO crea un WebGL por tarjeta. Muestra la silueta SVG y, cuando la tarjeta
 * entra en pantalla, pide al renderizador compartido (chunk diferido) una imagen del coche 3D, cacheada por
 * (carrocería, color). Si no hay WebGL o falla, se queda la silueta.
 */
import { useEffect, useRef, useState } from 'react'
import type { CarThumbnailProps } from '../types'
import { resolveBody, resolveColor } from '../car/specs'
import { detectWebGL, useThemeTokens } from '../env'
import { CarSilhouette } from '../silhouette/CarSilhouette'

const urls = new Map<string, string>()
const failed = new Set<string>()

export function CarThumbnailImpl({ appearance, alt, className }: CarThumbnailProps) {
  const body = resolveBody(appearance.bodyType)
  const color = resolveColor(appearance.colorHex)
  const { accent } = useThemeTokens()
  const key = `${body}|${color}|${accent}`
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null)
  const url = loaded?.key === key ? loaded.url : (urls.get(key) ?? null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (urls.has(key) || failed.has(key) || !detectWebGL()) return
    const el = ref.current
    if (!el) return
    let cancelled = false
    const start = () => {
      import('./renderThumbnail')
        .then((m) => m.renderCarThumbnail(body, color, accent))
        .then((u) => {
          urls.set(key, u)
          if (!cancelled) setLoaded({ key, url: u })
        })
        .catch(() => failed.add(key))
    }
    if (typeof IntersectionObserver === 'undefined') {
      start()
      return () => {
        cancelled = true
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [key, body, color, accent])

  return (
    <div ref={ref} className={['relative', className].filter(Boolean).join(' ')}>
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-contain" decoding="async" draggable={false} />
      ) : (
        <CarSilhouette appearance={appearance} title={alt} className="h-full w-full" />
      )}
    </div>
  )
}
