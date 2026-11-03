import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Hash de contraseñas con scrypt (módulo `node:crypto`, sin dependencias nativas).
 * Formato almacenado: `scrypt$N$r$p$saltBase64$hashBase64` — los parámetros viajan con el hash,
 * así se pueden endurecer en el futuro sin invalidar las contraseñas existentes.
 */
const N = 2 ** 15
const R = 8
const P = 1
const LARGO_CLAVE = 64
const MAXMEM = 128 * 1024 * 1024

const derivar = (password: string, salt: Buffer, n: number, r: number, p: number, largo: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const opciones: ScryptOptions = { N: n, r, p, maxmem: MAXMEM }
    scryptCb(password.normalize('NFKC'), salt, largo, opciones, (error, clave) => (error ? reject(error) : resolve(clave)))
  })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const clave = await derivar(password, salt, N, R, P, LARGO_CLAVE)
  return ['scrypt', N, R, P, salt.toString('base64'), clave.toString('base64')].join('$')
}

export async function verificarPassword(password: string, almacenado: string | null | undefined): Promise<boolean> {
  const partes = (almacenado ?? '').split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = partes as [string, string, string, string, string, string]
  const esperado = Buffer.from(hashB64, 'base64')
  const clave = await derivar(password, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p), esperado.length)
  return clave.length === esperado.length && timingSafeEqual(clave, esperado)
}

/** Hash ficticio para igualar el tiempo de respuesta cuando el email no existe (anti-enumeración). */
let hashFicticio: Promise<string> | null = null
export async function verificarPasswordFicticia(password: string): Promise<void> {
  hashFicticio ??= hashPassword('vestiq-ficticia-1')
  await verificarPassword(password, await hashFicticio)
}
