import { describe, expect, it } from 'vitest'
import { firmarSesion, verificarSesion } from '../../server/utils/auth'

const SECRETO = 'x'.repeat(40)
const ahora = 1_800_000_000

describe('token de sesión', () => {
  it('firma y verifica', () => {
    const t = firmarSesion({ uid: 'a'.repeat(24), exp: ahora + 100, pv: 'h' }, SECRETO)
    expect(verificarSesion(t, SECRETO, ahora)?.uid).toBe('a'.repeat(24))
  })
  it('rechaza firma alterada, otro secreto y token vencido', () => {
    const t = firmarSesion({ uid: 'a'.repeat(24), exp: ahora + 100, pv: 'h' }, SECRETO)
    const [cuerpo] = t.split('.')
    const admin = Buffer.from(JSON.stringify({ uid: 'b'.repeat(24), exp: ahora + 100, pv: 'h' })).toString('base64url')
    expect(verificarSesion(`${admin}.${t.split('.')[1]}`, SECRETO, ahora)).toBe(null)
    expect(verificarSesion(`${cuerpo}.zzz`, SECRETO, ahora)).toBe(null)
    expect(verificarSesion(t, 'y'.repeat(40), ahora)).toBe(null)
    expect(verificarSesion(t, SECRETO, ahora + 101)).toBe(null)
    expect(verificarSesion('basura', SECRETO, ahora)).toBe(null)
  })
})
