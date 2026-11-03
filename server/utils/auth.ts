import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, getRequestProtocol, setCookie, type H3Event } from 'h3'
import { User, type UserDocument } from '../models'
import { apiError } from './errors'

/**
 * Autenticación por sesión sin estado: cookie `vestiq-session` (httpOnly, SameSite=Lax) con un
 * token firmado con HMAC-SHA256 — `base64url(payload).base64url(firma)` — que contiene
 * `{ uid, exp, pv }`:
 *   · `uid` id del usuario y `exp` caducidad (7 días).
 *   · `pv` huella del hash de contraseña vigente: al cambiar la contraseña, todas las sesiones
 *     anteriores dejan de ser válidas.
 * El usuario (y su rol) se vuelve a leer de la base de datos en cada petición, de modo que
 * desactivar a un usuario o quitarle el rol `admin` surte efecto de inmediato.
 */
export const COOKIE_SESION = 'vestiq-session'
const DURACION_S = 7 * 24 * 60 * 60
const MIN_LARGO_SECRETO = 32

const sha256 = (valor: string) => createHash('sha256').update(valor).digest()

/** Comparación en tiempo constante de dos secretos. */
export function secretosIguales(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b))
}

// --- Token --------------------------------------------------------------------------------
interface CargaSesion { uid: string; exp: number; pv: string }

let secretoEfimero: string | null = null

function secretoDeSesion(event?: H3Event): string {
  const { sessionSecret } = useRuntimeConfig(event)
  if (typeof sessionSecret === 'string' && sessionSecret.length >= MIN_LARGO_SECRETO) return sessionSecret
  if (!import.meta.dev) {
    throw apiError(503, `El servidor no tiene configurada NUXT_SESSION_SECRET (mínimo ${MIN_LARGO_SECRETO} caracteres).`)
  }
  // Solo desarrollo: secreto aleatorio por proceso (las sesiones se pierden al reiniciar).
  if (!secretoEfimero) {
    secretoEfimero = randomBytes(32).toString('hex')
    console.warn('[auth] NUXT_SESSION_SECRET no definido: se usa un secreto temporal (solo desarrollo).')
  }
  return secretoEfimero
}

/** Huella corta del hash de contraseña: cambia cuando el usuario cambia su contraseña. */
const huella = (passwordHash: string | null | undefined) =>
  createHash('sha256').update(passwordHash ?? '').digest('base64url').slice(0, 16)

const firma = (cuerpo: string, secreto: string) => createHmac('sha256', secreto).update(cuerpo).digest('base64url')

export function firmarSesion(carga: CargaSesion, secreto: string): string {
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url')
  return `${cuerpo}.${firma(cuerpo, secreto)}`
}

export function verificarSesion(token: string, secreto: string, ahoraS = Math.floor(Date.now() / 1000)): CargaSesion | null {
  const [cuerpo, recibida, ...resto] = token.split('.')
  if (!cuerpo || !recibida || resto.length) return null
  const esperada = Buffer.from(firma(cuerpo, secreto))
  const actual = Buffer.from(recibida)
  if (esperada.length !== actual.length || !timingSafeEqual(esperada, actual)) return null
  try {
    const carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Partial<CargaSesion>
    if (typeof carga.uid !== 'string' || typeof carga.pv !== 'string' || typeof carga.exp !== 'number') return null
    if (!Number.isFinite(carga.exp) || carga.exp <= ahoraS) return null
    return { uid: carga.uid, exp: carga.exp, pv: carga.pv }
  } catch {
    return null
  }
}

// --- API de sesión ----------------------------------------------------------------------------
/** Emite la cookie de sesión para `usuario` (que debe incluir `passwordHash`). */
export async function iniciarSesion(event: H3Event, usuario: UserDocument): Promise<void> {
  const { trustProxy } = useRuntimeConfig(event)
  const exp = Math.floor(Date.now() / 1000) + DURACION_S
  const token = firmarSesion({ uid: String(usuario.id), exp, pv: huella(usuario.passwordHash) }, secretoDeSesion(event))
  setCookie(event, COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    // `Secure` solo sobre HTTPS (en http://localhost de desarrollo el navegador la descartaría).
    secure: getRequestProtocol(event, { xForwardedProto: Boolean(trustProxy) }) === 'https',
    path: '/',
    maxAge: DURACION_S,
  })
  event.context.usuarioSesion = usuario
}

export async function cerrarSesion(event: H3Event): Promise<void> {
  deleteCookie(event, COOKIE_SESION, { path: '/' })
  event.context.usuarioSesion = null
}

/** Usuario de la sesión actual o `null`. Resultado cacheado por petición. */
export async function getUsuarioActual(event: H3Event): Promise<UserDocument | null> {
  if (event.context.usuarioSesion !== undefined) return event.context.usuarioSesion as UserDocument | null

  let usuario: UserDocument | null = null
  const token = getCookie(event, COOKIE_SESION)
  if (token) {
    const carga = verificarSesion(token, secretoDeSesion(event))
    if (carga && /^[a-f\d]{24}$/i.test(carga.uid)) {
      const encontrado = await User.findOne({ _id: carga.uid, estadoRegistro: 'activo' }).select('+passwordHash')
      if (encontrado && huella(encontrado.passwordHash) === carga.pv) usuario = encontrado
    }
    if (!usuario) deleteCookie(event, COOKIE_SESION, { path: '/' }) // cookie vencida o inválida
  }
  event.context.usuarioSesion = usuario
  return usuario
}

/** Exige sesión iniciada (401 si no). */
export async function requireUsuario(event: H3Event): Promise<UserDocument> {
  const usuario = await getUsuarioActual(event)
  if (!usuario) throw apiError(401, 'Inicie sesión para continuar.')
  return usuario
}

/** Exige sesión con rol `admin` (401 sin sesión, 403 si es cliente). Devuelve el administrador. */
export async function requireAdmin(event: H3Event): Promise<UserDocument> {
  const usuario = await requireUsuario(event)
  if (usuario.rol !== 'admin') throw apiError(403, 'Acceso restringido a administradores.')
  return usuario
}
