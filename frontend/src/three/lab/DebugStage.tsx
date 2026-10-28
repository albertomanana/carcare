/**
 * Solo laboratorio: el coche con cámara fija por URL para revisar detalles (?tab=debug&az=35&el=12&dist=6&tx=1.5&ty=0.6).
 * az/el en grados (az 0 = de frente, 90 = lateral derecho), dist en metros, tx/ty/tz = punto al que mira.
 * `still=1`: lienzo a pantalla completa, sin fondo ni suelo (solo la sombra de contacto), para generar la imagen fija
 * de la portada (`public/img/portada-coche-*.webp`) con el script de captura del informe de rendimiento.
 */
import { Canvas } from '@react-three/fiber'
import type { BodyType, Zone } from '@/api/types'
import { getCarBuild } from '../car/build'
import { CarModel } from '../car/CarModel'
import { useThemeTokens } from '../env'
import { CarShadow, StudioEnvironment, StudioFloor } from '../scenes/Stage'

export default function DebugStage({ body, color, xray, night, zone }: { body: BodyType; color: string; xray: boolean; night: boolean; zone: Zone | null }) {
  const q = new URLSearchParams(window.location.search)
  const n = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d)
  const still = q.get('still') === '1'
  const az = (n('az', 40) * Math.PI) / 180
  const el = (n('el', 14) * Math.PI) / 180
  const dist = n('dist', 9)
  const t: [number, number, number] = [n('tx', 0), n('ty', 0.6), n('tz', 0)]
  const pos: [number, number, number] = [t[0] + Math.cos(el) * Math.cos(az) * dist, t[1] + Math.sin(el) * dist, t[2] + Math.cos(el) * Math.sin(az) * dist]
  const tokens = useThemeTokens()
  const build = getCarBuild(body, 'high')
  return (
    <div className={still ? 'fixed inset-0' : 'h-[calc(100dvh-2rem)] w-full rounded-hero bg-surface'} data-still={still || undefined}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: n('fov', 24), position: pos }}
        onCreated={({ camera }) => camera.lookAt(...t)}
        gl={{ alpha: true, antialias: true }}
      >
        <StudioEnvironment night={night} accent={tokens.accent} info={tokens.info} />
        <CarModel
          body={body}
          color={color}
          accent={tokens.accent}
          xray={xray}
          night={night}
          ghostColor={tokens.info}
          highlight={zone ? { zone, color: tokens.warning, pulse: false } : null}
        />
        {!still && <StudioFloor color={tokens.surface2} night={night} />}
        <CarShadow length={build.size.length} width={build.size.width} opacity={n('shadow', 0.75)} frames={n('sframes', 1)} />
      </Canvas>
    </div>
  )
}
