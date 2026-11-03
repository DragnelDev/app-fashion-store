import { cerrarSesion } from '../../utils/auth'
import { defineApiHandler } from '../../utils/handler'

/** POST /api/auth/logout — cierra la sesión (idempotente). */
export default defineApiHandler(async (event) => {
  await cerrarSesion(event)
  return { ok: true }
}, { requiresMongo: false })
