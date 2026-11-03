import type { LoginInput, PerfilInput, RegistroInput } from '~~/shared/schemas/auth'
import type { UsuarioDTO } from '~~/shared/types'

/**
 * Sesión del usuario. El estado se carga en el servidor (plugins/auth.ts) a partir de la cookie
 * httpOnly y viaja al cliente en el payload de Nuxt: no hay parpadeo de «invitado → usuario».
 * La seguridad real está en la API (`requireAdmin` / `requireUsuario`); los middlewares de ruta
 * (auth, admin, guest) solo cuidan la experiencia de navegación.
 */
export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<UsuarioDTO | null>(null)
  const cargado = ref(false)

  const autenticado = computed(() => usuario.value !== null)
  const esAdmin = computed(() => usuario.value?.rol === 'admin')
  const nombreCompleto = computed(() => (usuario.value ? `${usuario.value.nombre} ${usuario.value.apellido}` : ''))

  /** Consulta /api/auth/me (en SSR reenvía la cookie de la petición entrante). */
  async function cargar() {
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    try {
      usuario.value = await fetcher<UsuarioDTO | null>('/api/auth/me')
    } catch {
      usuario.value = null
    }
    cargado.value = true
  }

  async function login(datos: LoginInput) {
    usuario.value = await $fetch<UsuarioDTO>('/api/auth/login', { method: 'POST', body: datos })
    return usuario.value
  }

  async function registrar(datos: RegistroInput) {
    usuario.value = await $fetch<UsuarioDTO>('/api/auth/register', { method: 'POST', body: datos })
    return usuario.value
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      usuario.value = null
    }
    await navigateTo('/')
  }

  async function actualizarPerfil(datos: PerfilInput) {
    usuario.value = await $fetch<UsuarioDTO>('/api/auth/me', { method: 'PATCH', body: datos })
    return usuario.value
  }

  return { usuario, cargado, autenticado, esAdmin, nombreCompleto, cargar, login, registrar, logout, actualizarPerfil }
})
