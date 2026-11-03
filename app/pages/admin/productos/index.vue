<script setup lang="ts">
import { formatearBs } from '~~/shared/utils/money'
import type { Paginado, ProductoDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Productos · Vestiq Admin', robots: 'noindex' })

const route = useRoute()
const router = useRouter()

const q = computed(() => String(route.query.q ?? ''))
const estado = computed(() => String(route.query.estado ?? ''))
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))
const busqueda = ref(q.value)
watch(q, (v) => { busqueda.value = v })

const { data, status, error, refresh } = await useFetch<Paginado<ProductoDTO>>('/api/admin/products', {
  query: computed(() => ({ q: q.value || undefined, estado: estado.value || undefined, page: page.value, limit: 20 })),
})

function filtrar(cambios: Record<string, string | number | undefined>) {
  const query: Record<string, unknown> = { ...route.query, ...cambios }
  if (!('page' in cambios)) delete query.page
  for (const k of Object.keys(query)) if (query[k] === '' || query[k] === undefined) delete query[k]
  router.push({ query: query as Record<string, string | number> })
}

const mensaje = ref('')
const errorAccion = ref('')

async function eliminar(p: ProductoDTO) {
  if (!confirm(`¿Eliminar «${p.nombre}»? Dejará de mostrarse en la tienda (los pedidos existentes se conservan).`)) return
  errorAccion.value = ''
  mensaje.value = ''
  try {
    await $fetch(`/api/admin/products/${p._id}`, { method: 'DELETE' })
    mensaje.value = `«${p.nombre}» fue eliminado.`
    await refresh()
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-extrabold text-stone-900">Productos</h1>
      <NuxtLink to="/admin/productos/nuevo" class="btn-primario">+ Nuevo producto</NuxtLink>
    </div>

    <section class="flex flex-wrap items-end gap-3" aria-label="Filtros">
      <form class="min-w-48 flex-1 sm:max-w-xs" role="search" @submit.prevent="filtrar({ q: busqueda.trim() })">
        <label for="q" class="campo-etiqueta">Buscar (nombre o SKU)</label>
        <input id="q" v-model="busqueda" type="search" class="campo" />
      </form>
      <div>
        <label for="estado" class="campo-etiqueta">Estado</label>
        <select id="estado" class="campo" :value="estado" @change="filtrar({ estado: ($event.target as HTMLSelectElement).value })">
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>
    </section>

    <p v-if="mensaje" class="aviso-ok" role="status">{{ mensaje }}</p>
    <p v-if="errorAccion" class="aviso-error" role="alert">{{ errorAccion }}</p>
    <div v-if="error" class="aviso-error" role="alert">No se pudo cargar el listado. <button type="button" class="underline" @click="refresh()">Reintentar</button></div>

    <div v-else class="tarjeta overflow-x-auto p-0">
      <table class="tabla">
        <thead>
          <tr><th class="w-16"><span class="sr-only">Imagen</span></th><th>Producto</th><th>Categoría</th><th class="text-right">Precio</th><th class="text-right">Stock</th><th>Estado</th><th class="text-right">Acciones</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in data?.items ?? []" :key="p._id">
            <td><img :src="p.imagenes[0]" alt="" class="h-12 w-12 rounded-lg border border-stone-200 object-cover" loading="lazy" /></td>
            <td>
              <NuxtLink :to="`/admin/productos/${p._id}`" class="font-medium text-stone-900 hover:underline">{{ p.nombre }}</NuxtLink>
              <p class="text-xs text-stone-500">{{ p.variantes.length }} variante(s)</p>
            </td>
            <td class="text-stone-600">{{ p.categoria?.nombre ?? '—' }}</td>
            <td class="text-right">{{ formatearBs(p.precio) }}</td>
            <td class="text-right font-semibold" :class="p.stockTotal <= 0 ? 'text-red-600' : ''">{{ p.stockTotal }}</td>
            <td><EstadoBadge tipo="registro" :valor="p.estadoRegistro" /></td>
            <td class="whitespace-nowrap text-right">
              <NuxtLink :to="`/admin/productos/${p._id}`" class="btn-secundario btn-sm">Editar</NuxtLink>
              <button type="button" class="btn-peligro btn-sm ml-1" @click="eliminar(p)">Eliminar</button>
            </td>
          </tr>
          <tr v-if="!data?.items.length && status !== 'pending'"><td colspan="7" class="py-10 text-center text-stone-500">No hay productos con esos filtros.</td></tr>
        </tbody>
      </table>
    </div>

    <nav v-if="data && data.pages > 1" class="flex items-center justify-center gap-3" aria-label="Paginación">
      <button type="button" class="btn-secundario" :disabled="page <= 1" @click="filtrar({ page: page - 1 })">← Anterior</button>
      <span class="text-sm text-stone-600">Página {{ data.page }} de {{ data.pages }} · {{ data.total }} producto(s)</span>
      <button type="button" class="btn-secundario" :disabled="page >= data.pages" @click="filtrar({ page: page + 1 })">Siguiente →</button>
    </nav>
  </div>
</template>
