/** Clave de administración (cabecera x-admin-key). Se guarda solo en sessionStorage de la pestaña. */
const CLAVE = 'vestiq.admin-key'

export function useAdminKey() {
  const clave = useState<string>('admin-key', () => '')
  onMounted(() => {
    try { clave.value = sessionStorage.getItem(CLAVE) ?? '' } catch { /* sin almacenamiento */ }
  })
  watch(clave, (v) => {
    try { v ? sessionStorage.setItem(CLAVE, v) : sessionStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
  })
  return clave
}

/** Mensaje legible a partir de un error de $fetch / useFetch. */
export function mensajeDeError(error: unknown): string {
  const e = error as { data?: { message?: string }; statusMessage?: string; message?: string }
  return e?.data?.message || e?.statusMessage || e?.message || 'Ocurrió un error inesperado.'
}
