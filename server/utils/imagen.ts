import sharp from 'sharp'
import { apiError } from './errors'

export interface ImagenProcesada {
  buffer: Buffer
  width: number
  height: number
  bytes: number
  format: 'webp'
}

const FORMATOS_ACEPTADOS = new Set(['jpeg', 'png', 'webp', 'avif'])
const MAX_LADO_PX = 1600

/**
 * Valida que el archivo sea realmente una imagen (por su contenido, no por la extensión ni
 * el Content-Type), corrige la orientación EXIF, elimina metadatos (p. ej. GPS), limita el
 * tamaño a 1600 px y la convierte a WebP.
 */
export async function procesarImagen(entrada: Buffer): Promise<ImagenProcesada> {
  try {
    // limitInputPixels protege contra "bombas de descompresión".
    const base = sharp(entrada, { limitInputPixels: 50_000_000, failOn: 'error' })
    const meta = await base.metadata()
    if (!meta.format || !FORMATOS_ACEPTADOS.has(meta.format)) {
      throw apiError(415, 'Formato no admitido. Suba una imagen JPG, PNG, WebP o AVIF.')
    }

    const { data, info } = await base
      .rotate()
      .resize({ width: MAX_LADO_PX, height: MAX_LADO_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })

    return { buffer: data, width: info.width, height: info.height, bytes: info.size, format: 'webp' }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw apiError(415, 'El archivo no es una imagen válida.')
  }
}
