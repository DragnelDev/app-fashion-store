/** Solo para visitantes sin sesión (login / registro). Uso: definePageMeta({ middleware: 'guest' }) */
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()
  if (auth.autenticado) return navigateTo(auth.esAdmin ? '/admin' : '/cuenta')
})
