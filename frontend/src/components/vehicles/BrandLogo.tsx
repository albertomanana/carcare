import { brandLogoUrl, brandMonogram } from '@/lib/brands'
import { cn } from '@/lib/cn'

/**
 * Logotipo de marca en monocromo (toma el color del texto, así sirve en tema claro y oscuro) o, si no lo tenemos,
 * un monograma. Decorativo: el nombre de la marca siempre va al lado como texto.
 */
export function BrandLogo({ make, className }: { make: string; className?: string }) {
  const url = brandLogoUrl(make)
  if (!url)
    return (
      <span
        aria-hidden
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-full border border-current text-[0.6em] font-semibold leading-none tracking-tight',
          className ?? 'size-6',
        )}
      >
        {brandMonogram(make)}
      </span>
    )
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className ?? 'size-6')}
      style={{
        maskImage: `url(${url})`,
        WebkitMaskImage: `url(${url})`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
      }}
    />
  )
}
