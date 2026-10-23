import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/** El <canvas> se anuncia como imagen con texto alternativo (los marcadores HTML quedan fuera, accesibles). */
export function useCanvasLabel(label: string, hidden = false) {
  const el = useThree((s) => s.gl.domElement)
  useEffect(() => {
    if (hidden) {
      el.setAttribute('aria-hidden', 'true')
      el.removeAttribute('role')
      el.removeAttribute('aria-label')
    } else {
      el.removeAttribute('aria-hidden')
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', label)
    }
    el.tabIndex = -1
  }, [el, label, hidden])
}
