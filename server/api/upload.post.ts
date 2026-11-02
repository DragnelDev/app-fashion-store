import { getQuery, getRequestHeader, readMultipartFormData, setResponseStatus } from 'h3'
import { z } from 'zod'
import { SCOPES_UPLOAD } from '../../shared/utils/bolivia'
import type { SubidaRespuesta } from '../../shared/types'
import { requireAdmin } from '../utils/auth'
import { apiError } from '../utils/errors'
import { defineApiHandler } from '../utils/handler'
import { procesarImagen } from '../utils/imagen'
import { limitarPeticiones } from '../utils/rateLimit'
import { getStorage } from '../utils/storage'

/**
 * POST /api/upload?scope=producto|categoria|comprobante      (multipart/form-data, campo "file")
 *
 * - producto / categoria: requieren cabecera x-admin-key.
 * - comprobante: público (el cliente adjunta su pago QR/transferencia) con límite de 10 por minuto/IP.
 * La imagen se valida por contenido, se normaliza a WebP ≤1600 px sin metadatos y se guarda
 * con el driver configurado (local en desarrollo, Cloudinary en producción).
 */
export default defineApiHandler(async (event): Promise<SubidaRespuesta> => {
  const scope = z.enum(SCOPES_UPLOAD).catch('producto').parse(getQuery(event).scope)
  const { public: publica } = useRuntimeConfig(event)
  const maxBytes = Number(publica.uploadMaxMb) * 1024 * 1024

  if (scope === 'comprobante') limitarPeticiones(event, { clave: 'upload-comprobante', max: 10, ventanaMs: 60_000 })
  else requireAdmin(event)

  if (!(getRequestHeader(event, 'content-type') ?? '').startsWith('multipart/form-data')) {
    throw apiError(415, 'Envíe la imagen como multipart/form-data (campo "file").')
  }
  // Rechazo temprano por tamaño declarado (el margen cubre las cabeceras del multipart).
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > maxBytes + 64 * 1024) {
    throw apiError(413, `La imagen supera el máximo de ${publica.uploadMaxMb} MB.`)
  }

  const partes = await readMultipartFormData(event)
  const archivo = partes?.find((p) => p.name === 'file' && p.filename)
  if (!archivo || archivo.data.length === 0) throw apiError(400, 'Adjunte una imagen en el campo "file".')
  if (archivo.data.length > maxBytes) throw apiError(413, `La imagen supera el máximo de ${publica.uploadMaxMb} MB.`)

  const imagen = await procesarImagen(archivo.data)
  const storage = getStorage(event)
  const { url } = await storage.guardar(imagen.buffer, scope)

  setResponseStatus(event, 201)
  return { url, scope, bytes: imagen.bytes, width: imagen.width, height: imagen.height, format: imagen.format, provider: storage.nombre }
}, { requiresMongo: false })
