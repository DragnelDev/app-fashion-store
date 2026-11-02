import { createHash, timingSafeEqual } from 'node:crypto'
import { getRequestHeader, type H3Event } from 'h3'
import { apiError } from './errors'

const sha256 = (valor: string) => createHash('sha256').update(valor).digest()

/** Comparación en tiempo constante de dos secretos. */
export function secretosIguales(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

/**
 * Protege endpoints de administración con la cabecera `x-admin-key`.
 * Es una protección mínima hasta implementar el login (User.rol === 'admin').
 */
export function requireAdmin(event: H3Event): void {
  const { adminApiKey } = useRuntimeConfig(event)
  if (!adminApiKey) {
    throw apiError(503, 'El servidor no tiene configurada NUXT_ADMIN_API_KEY.')
  }
  const enviada = getRequestHeader(event, 'x-admin-key') ?? ''
  if (!enviada || !secretosIguales(enviada, adminApiKey)) {
    throw apiError(401, 'No autorizado.')
  }
}
