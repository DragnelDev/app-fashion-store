/**
 * Validación de configuración al arrancar: en producción falla de inmediato (en lugar de
 * descubrirlo con el primer inicio de sesión) si falta el secreto con el que se firman las sesiones.
 */
export default defineNitroPlugin(() => {
  const { sessionSecret } = useRuntimeConfig()
  if (typeof sessionSecret === 'string' && sessionSecret.length >= 32) return

  const mensaje = '[config] NUXT_SESSION_SECRET debe tener al menos 32 caracteres. Genere uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  if (import.meta.dev) console.warn(`${mensaje} (en desarrollo se usa un secreto temporal).`)
  else throw new Error(mensaje)
})
