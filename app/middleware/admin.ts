/**
 * Requiere rol `admin`. Uso: definePageMeta({ middleware: 'admin' })
 * (La API vuelve a comprobar el rol en cada endpoint: esto solo evita mostrar pantallas inútiles.)
 */
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (!auth.autenticado) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!auth.esAdmin) return abortNavigation(createError({ statusCode: 403, statusMessage: 'Acceso restringido a administradores.' }))
})
