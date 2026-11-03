/** Requiere sesión iniciada. Uso: definePageMeta({ middleware: 'auth' }) */
export default defineNuxtRouteMiddleware((to) => {
  if (!useAuthStore().autenticado) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
