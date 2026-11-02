<script setup lang="ts">
const { cantidadTotal } = useCart()
const { public: publica } = useRuntimeConfig()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur print:hidden">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="text-2xl font-extrabold tracking-tight text-brand-800">{{ publica.siteName }}</NuxtLink>
        <nav class="flex items-center gap-5 text-sm font-medium">
          <NuxtLink to="/" class="text-stone-600 hover:text-stone-900">Tienda</NuxtLink>
          <NuxtLink to="/checkout" class="relative inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100" aria-label="Ir al carrito">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01" /></svg>
            Carrito
            <ClientOnly>
              <span v-if="cantidadTotal" class="ml-1 rounded-full bg-brand-800 px-2 py-0.5 text-xs text-white">{{ cantidadTotal }}</span>
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
