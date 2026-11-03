<script setup lang="ts">
const auth = useAuthStore()
const { public: publica } = useRuntimeConfig()
const route = useRoute()

const enlaces = [
  { to: '/admin', texto: 'Dashboard', exacto: true },
  { to: '/admin/productos', texto: 'Productos', exacto: false },
  { to: '/admin/categorias', texto: 'Categorías', exacto: false },
  { to: '/admin/pedidos', texto: 'Pedidos', exacto: false },
]
const activo = (e: { to: string; exacto: boolean }) => (e.exacto ? route.path === e.to : route.path.startsWith(e.to))
</script>

<template>
  <div class="flex min-h-screen flex-col bg-stone-50 md:flex-row print:block">
    <aside class="border-b border-stone-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r print:hidden">
      <div class="flex items-center justify-between px-4 py-3 md:block">
        <NuxtLink to="/admin" class="text-xl font-extrabold tracking-tight text-brand-800">{{ publica.siteName }} <span class="text-xs font-semibold text-stone-500">Admin</span></NuxtLink>
      </div>
      <nav aria-label="Administración" class="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
        <NuxtLink
          v-for="e in enlaces" :key="e.to" :to="e.to"
          class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="activo(e) ? 'bg-brand-50 text-brand-900' : 'text-stone-600 hover:bg-stone-100'"
          :aria-current="activo(e) ? 'page' : undefined"
        >{{ e.texto }}</NuxtLink>
        <NuxtLink to="/" class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100 md:mt-4">← Ver tienda</NuxtLink>
      </nav>
      <div class="hidden border-t border-stone-200 p-4 text-sm md:mt-6 md:block">
        <p class="truncate font-medium text-stone-800">{{ auth.nombreCompleto }}</p>
        <p class="truncate text-xs text-stone-500">{{ auth.usuario?.email }}</p>
        <button type="button" class="btn-secundario btn-sm mt-3 w-full" @click="auth.logout()">Cerrar sesión</button>
      </div>
      <div class="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-xs md:hidden">
        <span class="truncate text-stone-600">{{ auth.nombreCompleto }}</span>
        <button type="button" class="btn-secundario btn-sm" @click="auth.logout()">Cerrar sesión</button>
      </div>
    </aside>

    <main class="min-w-0 flex-1 px-4 py-6 md:px-8">
      <slot />
    </main>
  </div>
</template>
