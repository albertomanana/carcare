/**
 * Vista previa para formularios (chunk diferido): cambia de carrocería y color en vivo, sin controles.
 * Más ligera que el visor: geometría de detalle bajo, sin suelo reflectante; giro lento si se permite animación.
 */
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import type { CarPreviewProps } from '../types'
import { getCarLayout } from '../car/anchors'
import { getCarBuild } from '../car/build'
import { CarModel } from '../car/CarModel'
import { resolveBody, resolveColor } from '../car/specs'
import { useInView, usePageVisible, usePrefersReducedMotion, useThemeTokens } from '../env'
import { describeCar } from '../silhouette/describe'
import { CameraRig } from './CameraRig'
import { ReleaseOnUnmount, ResumeOnVisible } from './common'
import { canvasDpr } from './dpr'
import { useCanvasLabel } from './useCanvasLabel'
import { CarShadow, StudioEnvironment } from './Stage'

export default function CarPreviewCanvas({ appearance, className }: CarPreviewProps) {
  const body = resolveBody(appearance.bodyType)
  const color = resolveColor(appearance.colorHex)
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  const pageVisible = usePageVisible()
  const dpr = useMemo(canvasDpr, [])
  const spin = !reduced && inView
  const layout = getCarLayout(body)
  const build = getCarBuild(body, 'low')
  const label = `Vista previa: ${describeCar(appearance.bodyType, appearance.colorHex)}`

  return (
    <div ref={wrap} className={['relative overflow-hidden', className].filter(Boolean).join(' ')}>
      <Canvas
        frameloop={!pageVisible ? 'never' : spin ? 'always' : 'demand'}
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ fov: 24, near: 0.1, far: 60, position: [7, 3, 7] }}
        style={{ touchAction: 'pan-y', pointerEvents: 'none' }}
      >
        <ReleaseOnUnmount />
        <ResumeOnVisible visible={pageVisible} />
        <Label text={label} />
        <StudioEnvironment />
        <Turntable spin={spin}>
          <CarModel body={body} color={color} accent={tokens.accent} detail="low" />
          <CarShadow key={body} length={build.size.length} width={build.size.width} opacity={tokens.light ? 0.5 : 0.75} />
        </Turntable>
        <CameraRig
          focus={{ target: layout.framing.target, direction: layout.framing.direction, distance: layout.framing.distance * 0.92 }}
          reducedMotion
          enableRotate={false}
          fitWidth={layout.framing.length * 1.15}
        />
      </Canvas>
    </div>
  )
}

function Label({ text }: { text: string }) {
  useCanvasLabel(text)
  return null
}

/** Gira el coche (no la cámara): así la sombra de contacto gira con él. */
function Turntable({ spin, children }: { spin: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += Math.min(dt, 0.05) * 0.35
  })
  return <group ref={ref}>{children}</group>
}
