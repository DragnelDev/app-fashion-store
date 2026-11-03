import { readBody } from 'h3'
import { loginSchema } from '../../../shared/schemas/auth'
import type { UsuarioDTO } from '../../../shared/types'
import { User } from '../../models'
import { iniciarSesion } from '../../utils/auth'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { verificarPassword, verificarPasswordFicticia } from '../../utils/password'
import { limitarPeticiones } from '../../utils/rateLimit'
import { usuarioDTO } from '../../utils/usuario'

/** POST /api/auth/login — inicia sesión. Mismo error para correo inexistente o contraseña errónea. */
export default defineApiHandler(async (event): Promise<UsuarioDTO> => {
  limitarPeticiones(event, { clave: 'auth-login', max: 10, ventanaMs: 10 * 60_000 })
  const { email, password } = loginSchema.parse(await readBody(event))

  const usuario = await User.findOne({ email, estadoRegistro: 'activo' }).select('+passwordHash')
  if (!usuario) {
    await verificarPasswordFicticia(password)
    throw apiError(401, 'Correo o contraseña incorrectos.')
  }
  if (!(await verificarPassword(password, usuario.passwordHash))) throw apiError(401, 'Correo o contraseña incorrectos.')

  await iniciarSesion(event, usuario)
  return usuarioDTO(usuario)
})
