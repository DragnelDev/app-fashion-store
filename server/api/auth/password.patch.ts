import { readBody } from 'h3'
import { cambiarPasswordSchema } from '../../../shared/schemas/auth'
import { User } from '../../models'
import { iniciarSesion, requireUsuario } from '../../utils/auth'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { hashPassword, verificarPassword } from '../../utils/password'
import { limitarPeticiones } from '../../utils/rateLimit'

/**
 * PATCH /api/auth/password — cambia la contraseña verificando la actual.
 * Las sesiones abiertas (otros dispositivos) quedan invalidadas porque la cookie lleva la huella
 * del hash anterior; a la sesión actual se le emite una nueva.
 */
export default defineApiHandler(async (event) => {
  limitarPeticiones(event, { clave: 'auth-password', max: 10, ventanaMs: 10 * 60_000 })
  const actual = await requireUsuario(event)
  const { actual: pwActual, nueva } = cambiarPasswordSchema.parse(await readBody(event))

  const usuario = await User.findById(actual.id).select('+passwordHash')
  if (!usuario || !(await verificarPassword(pwActual, usuario.passwordHash))) {
    throw apiError(422, 'La contraseña actual no es correcta.', { code: 'validacion', errores: { actual: 'La contraseña actual no es correcta.' } })
  }
  usuario.passwordHash = await hashPassword(nueva)
  await usuario.save()
  await iniciarSesion(event, usuario)
  return { ok: true }
})
