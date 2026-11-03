import type { UsuarioDTO } from '../../../shared/types'
import { getUsuarioActual } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'
import { usuarioDTO } from '../../utils/usuario'

/** GET /api/auth/me — usuario de la sesión, o `null` si no hay sesión (nunca 401: lo usa el arranque de la app). */
export default defineApiHandler(async (event): Promise<UsuarioDTO | null> => {
  const usuario = await getUsuarioActual(event)
  return usuario ? usuarioDTO(usuario) : null
})
