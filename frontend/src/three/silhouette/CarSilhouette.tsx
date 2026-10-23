import { useId, useMemo } from 'react'
import type { CarSilhouetteProps } from '../types'
import { luminance, mixHex } from '../color'
import { resolveBody, resolveColor } from '../car/specs'
import { describeCar } from './describe'
import { getSilhouettePaths } from './paths'

/**
 * Silueta lateral SVG propia por carrocería, teñida con el color del vehículo.
 * Respaldo universal (sin WebGL, cargando el 3D, miniaturas). Escala con su contenedor (preserveAspectRatio).
 */
export function CarSilhouette({ appearance, className, title }: CarSilhouetteProps) {
  const body = resolveBody(appearance.bodyType)
  const color = resolveColor(appearance.colorHex)
  const p = useMemo(() => getSilhouettePaths(body), [body])
  const uid = useId().replace(/:/g, '')
  const label = title ?? `Silueta: ${describeCar(appearance.bodyType, appearance.colorHex)}`

  const light = luminance(color)
  const top = mixHex(color, '#ffffff', light > 0.6 ? 0.25 : 0.32)
  const low = mixHex(color, '#000000', 0.45)
  const outline = mixHex(color, '#000000', light > 0.5 ? 0.35 : 0.55)
  const glassTop = '#3b4a54'
  const glassBottom = '#0b1014'
  const [vx, vy, vw, vh] = p.viewBox
  const spokeAngles = Array.from({ length: p.spokes }, (_, i) => (360 / p.spokes) * i)

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <defs>
        <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="0.42" stopColor={color} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={glassTop} />
          <stop offset="0.55" stopColor="#141c22" />
          <stop offset="1" stopColor={glassBottom} />
        </linearGradient>
        <radialGradient id={`rim-${uid}`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#e3e7ea" />
          <stop offset="1" stopColor="#7d868c" />
        </radialGradient>
        <radialGradient id={`shadow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sombra de contacto */}
      <ellipse cx={(vx + vx + vw) / 2} cy={0.01} rx={p.length * 0.56} ry={0.07} fill={`url(#shadow-${uid})`} />

      {/* Pasos de rueda (fondo oscuro) */}
      {p.wheels.map((w) => (
        <circle key={`arch-${w.cx}`} cx={w.cx} cy={w.cy} r={w.arch} fill="#07090a" />
      ))}

      {/* Carrocería */}
      {p.cabin && <path d={p.cabin} fill={`url(#paint-${uid})`} stroke={outline} strokeWidth={0.008} strokeLinejoin="round" />}
      <path d={p.body} fill={`url(#paint-${uid})`} stroke={outline} strokeWidth={0.008} strokeLinejoin="round" />
      {p.glass && <path d={p.glass} fill={`url(#glass-${uid})`} stroke="#050607" strokeWidth={0.012} strokeLinejoin="round" />}
      {p.pillars.map((d, i) => (
        <path key={i} d={d} fill="#07090a" />
      ))}
      {p.openWindshield && <path d={p.openWindshield} fill={`url(#glass-${uid})`} stroke={outline} strokeWidth={0.01} />}
      {p.seats.map((d, i) => (
        <path key={`seat-${i}`} d={d} fill="#1b1f22" stroke="#07090a" strokeWidth={0.01} />
      ))}

      {/* Reflejo del hombro, estribo y juntas */}
      <path d={p.shoulder} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={0.012} strokeLinecap="round" />
      <path d={p.sill} fill="none" stroke="#000000" strokeOpacity={0.25} strokeWidth={0.018} strokeLinecap="round" />
      {p.doors.map((d, i) => (
        <path key={`door-${i}`} d={d} stroke="#000000" strokeOpacity={0.35} strokeWidth={0.008} />
      ))}

      {/* Luces */}
      <path d={p.headlight} fill="#eef4f8" stroke="#0b0d0e" strokeWidth={0.01} />
      <path d={p.taillight} fill="#d8262c" stroke="#0b0d0e" strokeWidth={0.01} />

      {/* Ruedas */}
      {p.wheels.map((w) => (
        <g key={`wheel-${w.cx}`} transform={`translate(${w.cx} ${w.cy})`}>
          <circle r={w.r} fill="#0d0f10" />
          <circle r={w.r * 0.93} fill="none" stroke="#24292c" strokeWidth={w.r * 0.04} />
          <circle r={w.rim} fill={`url(#rim-${uid})`} />
          <circle r={w.rim * 0.86} fill="#2a3035" />
          {spokeAngles.map((a) => (
            <rect
              key={a}
              x={-w.rim * 0.07}
              y={-w.rim * 0.9}
              width={w.rim * 0.14}
              height={w.rim * 0.8}
              rx={w.rim * 0.05}
              fill="#c9cfd3"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r={w.rim * 0.24} fill="#d5dadd" stroke="#5c656b" strokeWidth={w.rim * 0.04} />
        </g>
      ))}
    </svg>
  )
}
