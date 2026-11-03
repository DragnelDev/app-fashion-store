<script setup lang="ts">
import type { ProductoDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Editar producto · Vestiq Admin', robots: 'noindex' })

const route = useRoute()
const { data: producto, error, refresh } = await useFetch<ProductoDTO>(() => `/api/admin/products/${route.params.id}`)
if (error.value || !producto.value) {
  throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado', fatal: true })
}

const guardado = ref(false)
async function alGuardar(p: ProductoDTO) {
  producto.value = p // nuevo updatedAt para próximas ediciones
  guardado.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function recargar() {
  guardado.value = false
  await refresh()
}
</script>

<template>
  <div v-if="producto" class="max-w-3xl space-y-5">
    <div>
      <NuxtLink to="/admin/productos" class="text-sm text-stone-500 hover:underline">← Productos</NuxtLink>
      <h1 class="text-2xl font-extrabold text-stone-900">Editar: {{ producto.nombre }}</h1>
      <p class="text-xs text-stone-500">Slug: {{ producto.slug }} · <NuxtLink :to="`/productos/${producto.slug}`" target="_blank" class="underline">Ver en la tienda</NuxtLink></p>
    </div>
    <p v-if="guardado" class="aviso-ok" role="status">Cambios guardados.</p>
    <AdminProductoForm :producto="producto" @guardado="alGuardar" @recargar="recargar" />
  </div>
</template>
