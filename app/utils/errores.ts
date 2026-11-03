/** Mensaje legible a partir de un error de $fetch / useFetch. */
export function mensajeDeError(error: unknown): string {
  const e = error as { data?: { message?: string }; statusMessage?: string; message?: string }
  return e?.data?.message || e?.statusMessage || e?.message || 'Ocurrió un error inesperado.'
}

/** Errores por campo (`{ "envio.ciudad": "…" }`) que devuelve la API en un 422, o `{}`. */
export function erroresDeApi(error: unknown): Record<string, string> {
  return (error as { data?: { data?: { errores?: Record<string, string> } } })?.data?.data?.errores ?? {}
}

/** Solo rutas internas: evita redirecciones abiertas con `?redirect=https://…` o `//host`. */
export function rutaInternaSegura(ruta: unknown, porDefecto = '/'): string {
  return typeof ruta === 'string' && ruta.startsWith('/') && !ruta.startsWith('//') && !ruta.includes('\\') ? ruta : porDefecto
}
