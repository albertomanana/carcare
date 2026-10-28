/**
 * Escenario de estudio compartido: entorno de iluminación generado con Lightformers (sin HDRIs descargados),
 * suelo con reflejo sutil que se funde con el fondo de la página y sombras de contacto.
 */
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function StudioEnvironment({ night = false, accent, info }: { night?: boolean; accent?: string; info?: string }) {
  return (
    <Environment resolution={512} frames={1} background={false}>
      <color attach="background" args={[night ? '#030405' : '#2a2f33']} />
      {/* Softbox cenital grande: reflejo largo sobre capó y techo */}
      <Lightformer form="rect" intensity={night ? 0.8 : 3} scale={[12, 6]} position={[0, 8, 0]} rotation-x={Math.PI / 2} />
      {/* Paneles laterales: banda de luz a lo largo de los costados */}
      <Lightformer form="rect" intensity={night ? 0.5 : 1.9} scale={[18, 2.2]} position={[0, 2.4, 9]} />
      <Lightformer form="rect" intensity={night ? 0.5 : 1.6} scale={[18, 2.2]} position={[0, 2.4, -9]} />
      <Lightformer form="rect" intensity={night ? 0.4 : 1.4} scale={[18, 0.35]} position={[0, 5, 7]} />
      {/* Clave frontal, contraluz y aro */}
      <Lightformer form="rect" intensity={night ? 0.6 : 2.2} scale={[6, 3]} position={[10, 3, 3]} />
      <Lightformer form="rect" intensity={night ? 0.7 : 2} scale={[0.8, 8]} position={[-10, 3, 0]} />
      <Lightformer form="ring" intensity={night ? 1.2 : 2.6} scale={3} position={[8, 4, 6]} />
      <Lightformer form="rect" intensity={night ? 0.15 : 0.5} scale={[24, 24]} position={[0, -2, 0]} rotation-x={-Math.PI / 2} />
      {/* Paneles altos inclinados (a ~45°): dan un degradado de reflejo a lunas y techo desde cualquier ángulo */}
      <Lightformer form="rect" intensity={night ? 0.25 : 0.75} scale={[16, 3.5]} position={[0, 6.5, -6.5]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={night ? 0.25 : 0.7} scale={[16, 3.5]} position={[0, 6.5, 6.5]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={night ? 0.2 : 0.55} scale={[3.5, 12]} position={[6.5, 6.5, 0]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={night ? 0.2 : 0.55} scale={[3.5, 12]} position={[-6.5, 6.5, 0]} target={[0, 0, 0]} />
      {night && accent && <Lightformer form="rect" color={accent} intensity={0.9} scale={[12, 0.25]} position={[-3, 0.8, -7]} />}
      {night && info && <Lightformer form="rect" color={info} intensity={1.6} scale={[0.4, 6]} position={[7, 2, -6]} />}
    </Environment>
  )
}

/** Textura radial (blanco en el centro → transparente) para fundir el suelo con el fondo. */
function useRadialAlpha(): THREE.Texture | null {
  const tex = useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')
    if (!g) return null
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.42, '#d0d0d0')
    grad.addColorStop(0.75, '#3a3a3a')
    grad.addColorStop(1, '#000000')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

export interface FloorProps {
  color: string
  radius?: number
  /** Suelo con reflejo (render extra): solo en el visor principal. */
  reflect?: boolean
  strength?: number
  night?: boolean
}

export function StudioFloor({ color, radius = 10, reflect = true, strength = 1, night = false }: FloorProps) {
  const alpha = useRadialAlpha()
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]} renderOrder={-1}>
      <circleGeometry args={[radius, 64]} />
      {reflect ? (
        <MeshReflectorMaterial
          color={color}
          blur={[400, 140]}
          resolution={512}
          mixBlur={1}
          mixStrength={(night ? 2.4 : 0.9) * strength}
          mixContrast={1}
          roughness={0.85}
          metalness={0.35}
          depthScale={1.2}
          minDepthThreshold={0.2}
          maxDepthThreshold={1.1}
          mirror={0.6}
          transparent
          alphaMap={alpha ?? undefined}
          depthWrite={false}
        />
      ) : (
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} transparent alphaMap={alpha ?? undefined} depthWrite={false} />
      )}
    </mesh>
  )
}

/**
 * Sombra de contacto. Con `frames=1` se pinta una vez y, además, cada vez que este componente se vuelve a renderizar
 * (drei reinicia su contador en cada render): así la portada la actualiza al cambiar de coche sin pintarla siempre.
 * `scale` va memorizado: drei crea render targets nuevos cada vez que cambia la identidad del array.
 *
 * La altura TIENE que ser ≤ 0: drei desenfoca la sombra dibujando un plano suelto en y = 0 con la cámara de la sombra
 * (que va dentro del grupo y mira hacia arriba). Con el grupo en y > 0 ese plano queda detrás de la cámara, el
 * desenfoque no pinta nada y la sombra sale vacía (pasaba con y = 0,002: el render target quedaba con alfa 0).
 */
export function CarShadow({ length, width, opacity = 0.75, frames = 1 }: { length: number; width: number; opacity?: number; frames?: number }) {
  const scale = useMemo(() => [length * 1.7, width * 2.6] as [number, number], [length, width])
  return (
    <ContactShadows
      position={[0, -0.0005, 0]}
      scale={scale}
      resolution={512}
      blur={2.4}
      far={1.4}
      opacity={opacity}
      frames={frames}
      color="#000000"
    />
  )
}
