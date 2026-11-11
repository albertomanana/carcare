import { describe, expect, it } from 'vitest'
import { redirectAfterLogin, safeRedirect } from './navigation'

describe('safeRedirect', () => {
  it('solo acepta rutas internas de la app', () => {
    expect(safeRedirect('/app/1/garaje')).toBe('/app/1/garaje')
    expect(safeRedirect('https://otro.com')).toBeNull()
    expect(safeRedirect('//otro.com')).toBeNull()
    expect(safeRedirect(null)).toBeNull()
  })
})

describe('redirectAfterLogin', () => {
  const mine = [{ id: 1 }, { id: 4 }]

  it('vuelve a la ruta pedida si el espacio es de la cuenta', () => {
    expect(redirectAfterLogin('/app/4/ordenes?estado=abiertas', mine)).toBe('/app/4/ordenes?estado=abiertas')
    expect(redirectAfterLogin('/app/1', mine)).toBe('/app/1')
  })

  it('manda al panel si la ruta es de un espacio ajeno (otra cuenta tras caducar la sesión)', () => {
    expect(redirectAfterLogin('/app/7/vehiculos/12', mine)).toBe('/app')
    expect(redirectAfterLogin('/app/14', mine)).toBe('/app')
  })

  it('respeta las rutas sin espacio y descarta las externas', () => {
    expect(redirectAfterLogin('/app/ajustes', mine)).toBe('/app/ajustes')
    expect(redirectAfterLogin('https://otro.com', mine)).toBe('/app')
    expect(redirectAfterLogin(null, mine)).toBe('/app')
  })
})
