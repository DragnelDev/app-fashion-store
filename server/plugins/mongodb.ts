import mongoose from 'mongoose'
import { conectarMongo, desconectarMongo } from '../utils/mongo'
// Importar los modelos aquí garantiza que estén registrados (e indexados) al arrancar.
import '../models'

/**
 * Plugin de Nitro: abre la conexión a MongoDB al iniciar el servidor y la cierra al apagarlo.
 * Falla rápido en producción si falta NUXT_MONGODB_URI.
 */
export default defineNitroPlugin(async (nitroApp) => {
  const { mongodbUri } = useRuntimeConfig()

  if (!mongodbUri) {
    const mensaje = '[mongodb] Falta NUXT_MONGODB_URI. Configure la URI en el archivo .env.'
    if (import.meta.dev) {
      console.warn(`${mensaje} Los endpoints que usan la base de datos fallarán.`)
      return
    }
    throw new Error(mensaje)
  }

  try {
    await conectarMongo(mongodbUri)
    console.info(`[mongodb] Conectado a "${mongoose.connection.name}"`)
    // Crea los índices declarados en los esquemas (únicos, SKU, listados).
    await Promise.all(Object.values(mongoose.models).map((modelo) => modelo.init()))
  } catch (error) {
    console.error('[mongodb] No se pudo conectar:', (error as Error).message)
    if (!import.meta.dev) throw error
  }

  nitroApp.hooks.hook('close', async () => {
    await desconectarMongo()
  })
})
