<script setup lang="ts">
const cart = useCartStore()
const auth = useAuthStore()
const { public: publica } = useRuntimeConfig()
const menuAbierto = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuAbierto.value = false })

const enlaceClase = 'rounded-lg px-2 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <NuxtLink to="/" class="text-2xl font-extrabold tracking-tight text-brand-800">{{ publica.siteName }}</NuxtLink>

        <button type="button" class="btn-secundario btn-sm md:hidden" :aria-expanded="menuAbierto" aria-controls="menu-principal" @click="menuAbierto = !menuAbierto">
          {{ menuAbierto ? 'Cerrar' : 'Menú' }}
        </button>

        <nav
          id="menu-principal" aria-label="Principal"
          class="absolute inset-x-0 top-full flex-col items-stretch gap-1 border-b border-stone-200 bg-white p-4 text-sm font-medium md:static md:flex md:flex-row md:items-center md:gap-3 md:border-0 md:bg-transparent md:p-0"
          :class="menuAbierto ? 'flex' : 'hidden'"
        >
          <NuxtLink to="/productos" :class="enlaceClase">Tienda</NuxtLink>

          <!-- La sesión viaja en el payload de Nuxt: el HTML del servidor ya refleja si hay usuario. -->
          <template v-if="auth.autenticado">
            <NuxtLink v-if="auth.esAdmin" to="/admin" :class="enlaceClase">Panel admin</NuxtLink>
            <NuxtLink to="/cuenta" :class="enlaceClase">Mi cuenta</NuxtLink>
            <button type="button" :class="[enlaceClase, 'text-left']" @click="auth.logout()">Salir</button>
          </template>
          <template v-else>
            <NuxtLink to="/login" :class="enlaceClase">Ingresar</NuxtLink>
            <NuxtLink to="/registro" :class="enlaceClase">Crear cuenta</NuxtLink>
          </template>

          <NuxtLink to="/carrito" class="relative inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100" aria-label="Ir al carrito">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01" /></svg>
            Carrito
            <ClientOnly>
              <span v-if="cart.cantidadTotal" class="ml-1 rounded-full bg-brand-800 px-2 py-0.5 text-xs text-white">{{ cart.cantidadTotal }}</span>
            </ClientOnly>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500 print:hidden">
      <p>{{ publica.siteName }} · Precios en bolivianos (Bs.) con IVA incluido · Envíos a toda Bolivia</p>
    </footer>
  </div>
</template>
