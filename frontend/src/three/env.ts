/**
 * Utilidades del módulo 3D que NO dependen de three.js (van en el bundle inicial):
 * detección de WebGL, preferencia de movimiento reducido, tokens de color del tema y visibilidad.
 */
import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

// ───────────────────────── WebGL ─────────────────────────

let webglCache: boolean | null = null

/** true si el navegador puede crear un contexto WebGL (se comprueba una vez y se cachea). */
export function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache
  webglCache = false
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false
    // jsdom (tests) no implementa canvas: evita el aviso "not implemented"
    if (/jsdom/i.test(navigator.userAgent)) return false
    // Forzar el respaldo 2D para pruebas: ?sin3d en la URL
    if (new URLSearchParams(window.location.search).has('sin3d')) return false
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    webglCache = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglCache = false
  }
  return webglCache
}

/** true si el navegador puede crear un contexto WebGL (hook estable: se calcula una vez por componente). */
export function useWebGLAvailable(): boolean {
  const [ok] = useState(detectWebGL)
  return ok
}

// ───────────────────────── Movimiento reducido ─────────────────────────

const RM_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(RM_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(RM_QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)
}

// ───────────────────────── Tokens de color ─────────────────────────

export interface ThemeTokens {
  base: string
  surface: string
  surface2: string
  surface3: string
  line: string
  lineStrong: string
  fg: string
  fgMuted: string
  fgSubtle: string
  accent: string
  danger: string
  warning: string
  ok: string
  info: string
  /** true si el tema activo es claro. */
  light: boolean
}

const FALLBACK: ThemeTokens = {
  base: '#111518',
  surface: '#1a2024',
  surface2: '#20272b',
  surface3: '#2a3237',
  line: '#333b40',
  lineStrong: '#5b666c',
  fg: '#f5f7f7',
  fgMuted: '#a5b0b5',
  fgSubtle: '#8a969c',
  accent: '#c7f36b',
  danger: '#ff6b6b',
  warning: '#f5b84a',
  ok: '#5cd6c0',
  info: '#7cc4fa',
  light: false,
}

let tokenCache: { key: string; tokens: ThemeTokens } | null = null

/** Lee los tokens CSS de :root (se cachean por tema). */
export function readThemeTokens(): ThemeTokens {
  if (typeof document === 'undefined') return FALLBACK
  const root = document.documentElement
  const key = `${root.getAttribute('data-theme') ?? ''}|${root.className}`
  if (tokenCache && tokenCache.key === key) return tokenCache.tokens
  const cs = getComputedStyle(root)
  const v = (name: string, fb: string) => {
    const raw = cs.getPropertyValue(name).trim()
    return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw.slice(0, 7) : fb
  }
  const tokens: ThemeTokens = {
    base: v('--base', FALLBACK.base),
    surface: v('--surface', FALLBACK.surface),
    surface2: v('--surface-2', FALLBACK.surface2),
    surface3: v('--surface-3', FALLBACK.surface3),
    line: v('--line', FALLBACK.line),
    lineStrong: v('--line-strong', FALLBACK.lineStrong),
    fg: v('--fg', FALLBACK.fg),
    fgMuted: v('--fg-muted', FALLBACK.fgMuted),
    fgSubtle: v('--fg-subtle', FALLBACK.fgSubtle),
    accent: v('--accent', FALLBACK.accent),
    danger: v('--danger', FALLBACK.danger),
    warning: v('--warning', FALLBACK.warning),
    ok: v('--ok', FALLBACK.ok),
    info: v('--info', FALLBACK.info),
    light: root.getAttribute('data-theme') === 'light',
  }
  tokenCache = { key, tokens }
  return tokens
}

function subscribeTheme(cb: () => void) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
  return () => mo.disconnect()
}

/** Tokens del tema activo; se actualizan al cambiar entre claro y oscuro. */
export function useThemeTokens(): ThemeTokens {
  return useSyncExternalStore(subscribeTheme, readThemeTokens, () => FALLBACK)
}

// ───────────────────────── Visibilidad ─────────────────────────

function subscribePageVisibility(cb: () => void) {
  if (typeof document === 'undefined') return () => {}
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/** false mientras la pestaña está oculta: los lienzos pasan a `frameloop="never"`. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribePageVisibility,
    () => typeof document === 'undefined' || !document.hidden,
    () => true,
  )
}

/**
 * true desde la primera vez que el elemento entra (o casi) en pantalla, y ya no vuelve a false: sirve para no
 * montar un lienzo (ni descargar three.js) hasta que su sección es visible. Sin IntersectionObserver ⇒ true.
 */
export function useSeenOnce(ref: RefObject<Element | null>, rootMargin = '200px'): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (seen || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true)
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, seen])
  return seen
}

/** true mientras el elemento está (aprox.) en pantalla y la pestaña visible: para pausar animaciones. */
export function useInView(ref: RefObject<Element | null>, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  useEffect(() => {
    const on = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return inView && pageVisible
}
