<script setup lang="ts">
import { formatearBs } from '~~/shared/utils/money'
import type { ProductoDTO } from '~~/shared/types'

const props = defineProps<{ producto: ProductoDTO }>()
const tallas = computed(() => [...new Set(props.producto.variantes.filter((v) => v.stock > 0).map((v) => v.talla))])
const agotado = computed(() => props.producto.stockTotal <= 0)
</script>

<template>
  <NuxtLink :to="`/productos/${producto.slug}`" class="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-600/40">
    <div class="relative aspect-[4/5] overflow-hidden bg-stone-100">
      <img :src="producto.imagenes[0]" :alt="producto.nombre" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <span v-if="agotado" class="absolute left-3 top-3 rounded-full bg-stone-900/80 px-3 py-1 text-xs font-semibold text-white">Agotado</span>
    </div>
    <div class="space-y-1 p-4">
      <p v-if="producto.categoria" class="text-xs font-medium uppercase tracking-wide text-stone-500">{{ producto.categoria.nombre }}</p>
      <h3 class="font-semibold text-stone-900">{{ producto.nombre }}</h3>
      <p class="text-lg font-bold text-brand-800">{{ formatearBs(producto.precio) }}</p>
      <p v-if="tallas.length" class="text-xs text-stone-500">Tallas: {{ tallas.join(' · ') }}</p>
    </div>
  </NuxtLink>
</template>
