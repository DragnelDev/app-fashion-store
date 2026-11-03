import { readBody, setResponseStatus } from 'h3'
import { registroSchema } from '../../../shared/schemas/auth'
import type { UsuarioDTO } from '../../../shared/types'
import { User } from '../../models'
import { iniciarSesion } from '../../utils/auth'
import { apiError } from '../../utils/errors'
import { defineApiHandler } from '../../utils/handler'
import { hashPassword } from '../../utils/password'
import { limitarPeticiones } from '../../utils/rateLimit'
import { usuarioDTO } from '../../utils/usuario'

/** POST /api/auth/register — crea una cuenta de cliente e inicia sesión. El rol siempre es `client`. */
export default defineApiHandler(async (event): Promise<UsuarioDTO> => {
  limitarPeticiones(event, { clave: 'auth-register', max: 10, ventanaMs: 60 * 60_000 })
  const datos = registroSchema.parse(await readBody(event))

  const existe = await User.exists({ email: datos.email }).setOptions({ incluirEliminados: true } as never)
  if (existe) throw apiError(409, 'Ya existe una cuenta con ese correo.', { code: 'duplicado', campo: 'email' })

  const usuario = await User.create({
    nombre: datos.nombre,
    apellido: datos.apellido,
    email: datos.email,
    telefono: datos.telefono,
    rol: 'client',
    passwordHash: await hashPassword(datos.password),
  })
  await iniciarSesion(event, usuario)
  setResponseStatus(event, 201)
  return usuarioDTO(usuario)
})
