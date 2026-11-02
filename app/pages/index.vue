<script setup lang="ts">
import { TALLAS_SUGERIDAS } from '~~/shared/utils/bolivia'
import type { CategoriaDTO, Paginado, ProductoDTO } from '~~/shared/types'

useSeoMeta({ title: 'Vestiq · Moda en Bolivia', description: 'Ropa con envíos a toda Bolivia. Precios en Bs. con IVA incluido.' })

const route = useRoute()
const router = useRouter()

const q = computed(() => String(route.query.q ?? ''))
const categoria = computed(() => String(route.query.categoria ?? ''))
const talla = computed(() => String(route.query.talla ?? ''))
const orden = computed(() => String(route.query.orden ?? 'recientes'))
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))

const { data: categorias } = await useFetch<CategoriaDTO[]>('/api/categories', { default: () => [] })
const { data, status, error, refresh } = await useFetch<Paginado<ProductoDTO>>('/api/products', {
  query: computed(() => ({
    categoria: categoria.value || undefined,
    talla: talla.value || undefined,
    q: q.value || undefined,
    orden: orden.value,
    page: page.value,
    limit: 12,
  })),
})

function filtrar(cambios: Record<string, string | number | undefined>) {
  // Cualquier cambio de filtro vuelve a la página 1 (salvo que se indique `page`).
  const query: Record<string, unknown> = { ...route.query, ...cambios, page: cambios.page ?? undefined }
  for (const k of Object.keys(query)) if (query[k] === '' || query[k] === undefined) delete query[k]
  router.push({ query: query as Record<string, string | number> })
}

const busqueda = ref(q.value)
watch(q, (v) => { busqueda.value = v })
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 px-6 py-10 text-white sm:px-10">
      <h1 class="text-3xl font-extrabold sm:text-4xl">Moda que llega a todo el país</h1>
      <p class="mt-2 max-w-xl text-brand-100">Pague con QR, transferencia o contra entrega. Facturamos con su NIT o CI.</p>
    </section>

    <section aria-label="Filtros" class="flex flex-wrap items-end gap-3">
      <form class="flex-1 sm:max-w-xs" role="search" @submit.prevent="filtrar({ q: busqueda.trim() })">
        <label for="buscar" class="campo-etiqueta">Buscar</label>
        <input id="buscar" v-model="busqueda" type="search" class="campo" placeholder="Camisa, vestido…" />
      </form>
      <div>
        <label for="talla" class="campo-etiqueta">Talla</label>
        <select id="talla" class="campo" :value="talla" @change="filtrar({ talla: ($event.target as HTMLSelectElement).value })">
          <option value="">Todas</option>
          <option v-for="t in TALLAS_SUGERIDAS" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div>
        <label for="orden" class="campo-etiqueta">Ordenar</label>
        <select id="orden" class="campo" :value="orden" @change="filtrar({ orden: ($event.target as HTMLSelectElement).value })">
          <option value="recientes">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
      </div>
    </section>

    <nav aria-label="Categorías" class="flex flex-wrap gap-2">
      <button type="button" class="rounded-full border px-4 py-1.5 text-sm font-medium transition" :class="!categoria ? 'border-brand-800 bg-brand-800 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'" @click="filtrar({ categoria: undefined })">Todo</button>
      <button
        v-for="c in categorias" :key="c._id" type="button"
        class="rounded-full border px-4 py-1.5 text-sm font-medium transition"
        :class="categoria === c.slug ? 'border-brand-800 bg-brand-800 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'"
        @click="filtrar({ categoria: c.slug })"
      >{{ c.nombre }}</button>
    </nav>

    <div v-if="error" class="tarjeta text-center" role="alert">
      <p class="text-stone-700">No pudimos cargar los productos.</p>
      <button type="button" class="btn-secundario mt-3" @click="refresh()">Reintentar</button>
    </div>

    <template v-else>
      <p class="text-sm text-stone-500" aria-live="polite">{{ status === 'pending' ? 'Cargando…' : `${data?.total ?? 0} producto(s)` }}</p>

      <ul v-if="data?.items.length" class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <li v-for="p in data.items" :key="p._id"><ProductCard :producto="p" /></li>
      </ul>
      <div v-else-if="status !== 'pending'" class="tarjeta py-12 text-center text-stone-600">No encontramos productos con esos filtros.</div>

      <nav v-if="data && data.pages > 1" class="flex items-center justify-center gap-3" aria-label="Paginación">
        <button type="button" class="btn-secundario" :disabled="page <= 1" @click="filtrar({ page: page - 1 })">← Anterior</button>
        <span class="text-sm text-stone-600">Página {{ data.page }} de {{ data.pages }}</span>
        <button type="button" class="btn-secundario" :disabled="page >= data.pages" @click="filtrar({ page: page + 1 })">Siguiente →</button>
      </nav>
    </template>
  </div>
</template>
