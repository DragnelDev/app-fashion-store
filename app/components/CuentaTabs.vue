<script setup lang="ts">
/** Navegación de «Mi cuenta». */
const route = useRoute()
const enlaces = [
  { to: '/cuenta', texto: 'Mis datos' },
  { to: '/cuenta/pedidos', texto: 'Mis pedidos' },
]
</script>

<template>
  <nav aria-label="Mi cuenta" class="mb-6 flex gap-2 border-b border-stone-200">
    <NuxtLink
      v-for="e in enlaces" :key="e.to" :to="e.to"
      class="-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition"
      :class="route.path === e.to ? 'border-brand-800 text-brand-900' : 'border-transparent text-stone-500 hover:text-stone-800'"
      :aria-current="route.path === e.to ? 'page' : undefined"
    >{{ e.texto }}</NuxtLink>
  </nav>
</template>
