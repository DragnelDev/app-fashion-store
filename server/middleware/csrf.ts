import { defineEventHandler, getRequestHeader, getRequestHost, getRequestProtocol } from 'h3'
import { apiError } from '../utils/errors'

/**
 * Defensa CSRF adicional a `SameSite=Lax`: en peticiones que modifican datos a /api/**, si el
 * navegador envía `Origin`, debe coincidir con el host de la aplicación. Las llamadas sin
 * `Origin` (curl, scripts, servidor→servidor) no usan cookies de navegador y se permiten.
 */
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/') || METODOS_SEGUROS.has(event.method)) return
  const origen = getRequestHeader(event, 'origin')
  if (!origen) return

  const host = getRequestHost(event, { xForwardedHost: true })
  const protocolo = getRequestProtocol(event, { xForwardedProto: true })
  let esperado: string
  try {
    esperado = new URL(origen).host
  } catch {
    throw apiError(403, 'Origen no permitido.')
  }
  if (esperado !== host && !(protocolo && origen === `${protocolo}://${host}`)) {
    throw apiError(403, 'Origen no permitido.')
  }
})
