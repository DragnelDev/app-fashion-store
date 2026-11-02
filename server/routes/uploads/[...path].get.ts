import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { PATRON_RUTA_LOCAL } from '../../utils/storage/local'

/**
 * Sirve las imágenes guardadas por el driver "local" (desarrollo).
 * Se valida la ruta con un patrón estricto, así que no es posible salir del directorio.
 */
export default defineEventHandler(async (event) => {
  const { storage } = useRuntimeConfig(event)
  if (storage.driver !== 'local') throw createError({ statusCode: 404, message: 'No encontrado' })

  const ruta = getRouterParam(event, 'path') ?? ''
  if (!PATRON_RUTA_LOCAL.test(ruta)) throw createError({ statusCode: 404, message: 'No encontrado' })

  const datos = await useStorage('uploads').getItemRaw<Uint8Array>(ruta.replaceAll('/', ':'))
  if (!datos) throw createError({ statusCode: 404, message: 'No encontrado' })

  setResponseHeader(event, 'Content-Type', 'image/webp')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  // Los comprobantes de pago son privados: que no se indexen ni se cacheen en proxies compartidos.
  if (ruta.startsWith('comprobante/')) {
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  }
  return datos
})
