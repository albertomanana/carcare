/**
 * Cliente HTTP de CarCare sobre fetch.
 *  - Sanctum en modo SPA: cookie de sesión + cabecera X-XSRF-TOKEN leída de la cookie XSRF-TOKEN.
 *  - Antes de login/registro hay que pedir GET /sanctum/csrf-cookie (ensureCsrfCookie).
 *  - Si el token CSRF caduca (419) se renueva y se reintenta una sola vez.
 *  - Los errores se lanzan como ApiError con status, mensaje en español y errores por campo (422).
 */
import type { ApiErrorBody } from './types'

export const API_BASE = '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly errors: Record<string, string[]>
  readonly body: ApiErrorBody | null

  constructor(status: number, message: string, body: ApiErrorBody | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.errors = body?.errors ?? {}
  }

  /** Primer mensaje de error de un campo (422). */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0]
  }

  get isValidation() {
    return this.status === 422
  }
  get isUnauthorized() {
    return this.status === 401
  }
  get isForbidden() {
    return this.status === 403
  }
  get isNotFound() {
    return this.status === 404
  }
  get isConflict() {
    return this.status === 409
  }
  get isNetwork() {
    return this.status === 0
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Mensaje legible para cualquier error (toasts, estados de error). */
export function errorMessage(error: unknown, fallback = 'Algo ha fallado. Inténtalo de nuevo.'): string {
  if (isApiError(error)) return error.message || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Comprueba tu conexión.',
  401: 'Tu sesión ha caducado. Vuelve a entrar.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscas.',
  409: 'La operación entra en conflicto con el estado actual.',
  413: 'El archivo es demasiado grande.',
  419: 'La sesión de seguridad ha caducado. Inténtalo de nuevo.',
  422: 'Revisa los datos del formulario.',
  429: 'Demasiados intentos. Espera un minuto y vuelve a probar.',
  500: 'Error del servidor. Inténtalo más tarde.',
}

// ───────── CSRF ─────────

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!match) return null
  try {
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return match.slice(name.length + 1)
  }
}

let csrfPromise: Promise<void> | null = null

/** Pide la cookie XSRF-TOKEN (una sola petición en vuelo; `force` la renueva). */
export function ensureCsrfCookie(force = false): Promise<void> {
  if (!force && readCookie('XSRF-TOKEN')) return Promise.resolve()
  if (!csrfPromise) {
    csrfPromise = fetch('/sanctum/csrf-cookie', {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((res) => {
        if (!res.ok && res.status !== 204) throw new ApiError(res.status, DEFAULT_MESSAGES[res.status] ?? 'No se pudo iniciar la sesión segura.')
      })
      .catch((err: unknown) => {
        if (isApiError(err)) throw err
        throw new ApiError(0, DEFAULT_MESSAGES[0])
      })
      .finally(() => {
        csrfPromise = null
      })
  }
  return csrfPromise
}

// ───────── Sesión caducada ─────────

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** El proveedor de autenticación se suscribe para limpiar la sesión ante un 401. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

// ───────── Petición base ─────────

export type QueryValue = string | number | boolean | null | undefined | (string | number)[]
export type QueryParams = Record<string, QueryValue>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: QueryParams
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Si true, un 401 no dispara el cierre de sesión global (p. ej. GET /me inicial). */
  silentUnauthorized?: boolean
}

export function buildUrl(path: string, query?: QueryParams): string {
  const base = path.startsWith('/api/') || path.startsWith('/sanctum/') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0')
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base
}

function buildHeaders(method: string, body: unknown, extra?: Record<string, string>): Headers {
  const headers = new Headers({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' })
  if (body !== undefined && !(body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (method !== 'GET') {
    const token = readCookie('XSRF-TOKEN')
    if (token) headers.set('X-XSRF-TOKEN', token)
  }
  if (extra) for (const [k, v] of Object.entries(extra)) headers.set(k, v)
  return headers
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null
  try {
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'message' in data) body = data as ApiErrorBody
  } catch {
    /* respuesta sin JSON */
  }
  const message = body?.message?.trim() || DEFAULT_MESSAGES[res.status] || DEFAULT_MESSAGES[500]
  return new ApiError(res.status, message, body)
}

async function rawRequest(path: string, options: RequestOptions, retried = false): Promise<Response> {
  const method = options.method ?? 'GET'
  const url = buildUrl(path, options.query)
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: buildHeaders(method, options.body, options.headers),
    signal: options.signal,
  }
  if (options.body !== undefined) {
    init.body = options.body instanceof FormData ? options.body : JSON.stringify(options.body)
  }

  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, DEFAULT_MESSAGES[0])
  }

  if (res.status === 419 && !retried && method !== 'GET') {
    await ensureCsrfCookie(true)
    return rawRequest(path, options, true)
  }

  if (!res.ok) {
    const error = await parseError(res)
    if (res.status === 401 && !options.silentUnauthorized) {
      unauthorizedListeners.forEach((listener) => listener())
    }
    throw error
  }
  return res
}

/** Petición JSON. 204 ⇒ undefined. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, options)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError(res.status, 'La respuesta del servidor no es válida.')
  }
}

export const api = {
  get: <T>(path: string, query?: QueryParams, opts: Omit<RequestOptions, 'method' | 'query'> = {}) =>
    request<T>(path, { ...opts, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T = void>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'DELETE', body }),
  /** multipart/form-data (subida de documentos). El navegador fija el boundary. */
  upload: <T>(path: string, form: FormData, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'POST', body: form }),
}

// ───────── Descargas autenticadas ─────────

/** Descarga un recurso protegido como Blob (con la cookie de sesión). */
export async function fetchBlob(path: string, query?: QueryParams, signal?: AbortSignal): Promise<Blob> {
  const res = await rawRequest(path, { method: 'GET', query, signal })
  return res.blob()
}

/** Descarga y guarda un archivo con su nombre original. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await fetchBlob(path)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}
