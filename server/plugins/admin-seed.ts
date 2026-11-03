import mongoose from 'mongoose'
import { User } from '../models'
import { hashPassword } from '../utils/password'
import { passwordSchema } from '../../shared/schemas/auth'

/**
 * Crea el primer administrador al arrancar, a partir de NUXT_ADMIN_EMAIL / NUXT_ADMIN_PASSWORD.
 * - Solo crea: si ya existe un usuario con ese correo NO se modifica ni se promueve (evita que
 *   alguien que se registró antes con ese correo obtenga el rol admin).
 * - Después del primer arranque puede retirar NUXT_ADMIN_PASSWORD del entorno.
 */
export default defineNitroPlugin(async () => {
  const { adminEmail, adminPassword, mongodbUri } = useRuntimeConfig()
  if (!adminEmail || !adminPassword || !mongodbUri) return

  try {
    // Espera (breve) a que el plugin de MongoDB haya conectado.
    for (let i = 0; i < 50 && mongoose.connection.readyState !== mongoose.ConnectionStates.connected; i++) {
      await new Promise((r) => setTimeout(r, 200))
    }
    if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) return

    const email = adminEmail.trim().toLowerCase()
    const existente = await User.findOne({ email }).setOptions({ incluirEliminados: true } as never)
    if (existente) {
      if (existente.rol !== 'admin') {
        console.warn(`[admin-seed] "${email}" ya existe como cliente; no se modifica. Use otro correo para el admin.`)
      }
      return
    }
    const validacion = passwordSchema.safeParse(adminPassword)
    if (!validacion.success) {
      console.error(`[admin-seed] NUXT_ADMIN_PASSWORD inválida: ${validacion.error.issues[0]?.message}`)
      return
    }
    await User.create({ nombre: 'Administrador', apellido: 'Vestiq', email, rol: 'admin', passwordHash: await hashPassword(adminPassword) })
    console.info(`[admin-seed] Administrador creado: ${email}`)
  } catch (error) {
    console.error('[admin-seed] No se pudo crear el administrador:', (error as Error).message)
  }
})
