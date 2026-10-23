import { ThreeLab } from '@/three'

/** Solo en desarrollo (/dev/3d): laboratorio visual del módulo 3D. */
export default function ThreeLabPage() {
  return (
    <main className="min-h-dvh bg-canvas">
      <ThreeLab />
    </main>
  )
}
