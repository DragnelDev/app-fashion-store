/** Carga la sesión una vez por petición (SSR); el estado llega hidratado al cliente. */
export default defineNuxtPlugin(async (nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia)
  if (import.meta.server) {
    // Sin cookie de sesión no hace falta consultar la API.
    const { cookie } = useRequestHeaders(['cookie'])
    if (cookie?.includes('vestiq-session=')) await auth.cargar()
    else auth.cargado = true
  } else if (!auth.cargado) {
    await auth.cargar()
  }
})
