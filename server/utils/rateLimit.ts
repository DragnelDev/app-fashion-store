import { getRequestIP, setResponseHeader, type H3Event } from 'h3'
import { apiError } from './errors'

interface Opciones { clave: string; max: number; ventanaMs: number }

/**
 * Límite de peticiones por IP en memoria (ventana deslizante).
 * ⚠️ Es por instancia: con varias réplicas/serverless use un límite compartido (Redis, WAF).
 */
const registros = new Map<string, number[]>()

export function limitarPeticiones(event: H3Event, { clave, max, ventanaMs }: Opciones): void {
  // X-Forwarded-For lo puede falsificar cualquier cliente: solo se usa si NUXT_TRUST_PROXY=true.
  const { trustProxy } = useRuntimeConfig(event)
  const ip = getRequestIP(event, { xForwardedFor: Boolean(trustProxy) }) ?? 'desconocida'
  const id = `${clave}:${ip}`
  const ahora = Date.now()
  const recientes = (registros.get(id) ?? []).filter((t) => ahora - t < ventanaMs)

  if (recientes.length >= max) {
    const espera = Math.ceil((ventanaMs - (ahora - recientes[0]!)) / 1000)
    setResponseHeader(event, 'Retry-After', espera)
    throw apiError(429, `Demasiadas solicitudes. Intente de nuevo en ${espera} s.`)
  }
  recientes.push(ahora)
  registros.set(id, recientes)

  // Limpieza ocasional para no crecer sin límite.
  if (registros.size > 5000) {
    for (const [k, v] of registros) if (v.every((t) => ahora - t >= ventanaMs)) registros.delete(k)
  }
}
