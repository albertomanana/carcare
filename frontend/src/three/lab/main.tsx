/**
 * Entrada aislada del laboratorio 3D (solo desarrollo): http://localhost:5173/three-lab.html
 * Parámetros: ?theme=light, ?rm=1 (simula movimiento reducido no disponible: usar la preferencia del SO), ?sin3d (respaldo 2D).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ThreeLab } from '../index'

const theme = new URLSearchParams(window.location.search).get('theme')
document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="min-h-dvh bg-base">
      <ThreeLab />
    </main>
  </StrictMode>,
)
