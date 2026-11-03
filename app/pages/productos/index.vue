<script setup lang="ts">
import { formatearBs } from '~~/shared/utils/money'
import type { CategoriaDTO, FiltrosDTO, Paginado, ProductoDTO } from '~~/shared/types'

useSeoMeta({ title: 'Tienda · Vestiq', description: 'Catálogo de ropa con filtros por categoría, color, talla y precio. Precios en Bs. con IVA incluido.' })

const route = useRoute()
const router = useRouter()

const val = (k: string) => String(route.query[k] ?? '')
const num = (k: string) => (val(k) === '' || Number.isNaN(Number(val(k))) ? undefined : Number(val(k)))
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))
const orden = computed(() => val('orden') || 'recientes')

// --- Datos --------------------------------------------------------------------------
const { data: categorias } = await useFetch<CategoriaDTO[]>('/api/categories', { default: () => [] })
// Las facetas (colores, tallas y precios con stock) dependen de la categoría elegida.
const { data: facetas } = await useFetch<FiltrosDTO>('/api/products/filtros', {
  query: computed(() => ({ categoria: val('categoria') || undefined })),
  default: () => ({ colores: [], tallas: [], precioMin: 0, precioMax: 0 }),
})
const { data, status, error, refresh } = await useFetch<Paginado<ProductoDTO>>('/api/products', {
  query: computed(() => ({
    categoria: val('categoria') || undefined,
    color: val('color') || undefined,
    talla: val('talla') || undefined,
    precioMin: num('precioMin'),
    precioMax: num('precioMax'),
    q: val('q') || undefined,
    orden: orden.value,
    page: page.value,
    limit: 12,
  })),
})

// --- Filtros (el estado vive en la URL: se puede compartir y funciona el botón «atrás») ------------
function filtrar(cambios: Record<string, string | number | undefined>) {
  const query: Record<string, unknown> = { ...route.query, ...cambios }
  if (!('page' in cambios)) delete query.page // cualquier cambio de filtro vuelve a la página 1
  for (const k of Object.keys(query)) if (query[k] === '' || query[k] === undefined) delete query[k]
  router.push({ query: query as Record<string, string | number> })
}
const alternar = (k: 'color' | 'talla', valor: string) => filtrar({ [k]: val(k) === valor ? undefined : valor })

const busqueda = ref(val('q'))
const minimo = ref(val('precioMin'))
const maximo = ref(val('precioMax'))
watch(() => route.query, () => {
  busqueda.value = val('q')
  minimo.value = val('precioMin')
  maximo.value = val('precioMax')
})

function aplicarPrecio() {
  const a = minimo.value === '' ? undefined : Math.max(0, Number(minimo.value))
  const b = maximo.value === '' ? undefined : Math.max(0, Number(maximo.value))
  // Si están invertidos se intercambian en lugar de devolver siempre cero resultados.
  const [desde, hasta] = a !== undefined && b !== undefined && a > b ? [b, a] : [a, b]
  filtrar({ precioMin: Number.isFinite(desde) ? desde : undefined, precioMax: Number.isFinite(hasta) ? hasta : undefined })
}

const hayFiltros = computed(() => ['categoria', 'color', 'talla', 'precioMin', 'precioMax', 'q'].some((k) => val(k) !== ''))
const limpiar = () => router.push({ query: orden.value !== 'recientes' ? { orden: orden.value } : {} })
const categoriaActiva = computed(() => categorias.value.find((c) => c.slug === val('categoria')))
const mostrarFiltros = ref(false)

/** Punto de color orientativo para los nombres más comunes; el resto usa un gris neutro. */
const HEX: Record<string, string> = {
  negro: '#111827', blanco: '#ffffff', gris: '#9ca3af', rojo: '#dc2626', azul: '#2563eb', celeste: '#7dd3fc',
  verde: '#16a34a', amarillo: '#facc15', naranja: '#f97316', rosado: '#f472b6', rosa: '#f472b6', morado: '#7c3aed',
  beige: '#e7d9c0', marron: '#78350f', marrón: '#78350f', café: '#78350f', crema: '#fdf6e3',
}
const punto = (c: string) => HEX[c.trim().toLowerCase()] ?? '#d6d3d1'
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-extrabold text-stone-900">{{ categoriaActiva?.nombre ?? 'Toda la tienda' }}</h1>
        <p class="text-sm text-stone-500" aria-live="polite">{{ status === 'pending' ? 'Cargando…' : `${data?.total ?? 0} producto(s)` }}</p>
      </div>
      <div class="flex items-end gap-3">
        <button type="button" class="btn-secundario lg:hidden" :aria-expanded="mostrarFiltros" aria-controls="filtros" @click="mostrarFiltros = !mostrarFiltros">
          {{ mostrarFiltros ? 'Ocultar filtros' : 'Filtros' }}
        </button>
        <div>
          <label for="orden" class="campo-etiqueta">Ordenar</label>
          <select id="orden" class="campo" :value="orden" @change="filtrar({ orden: ($event.target as HTMLSelectElement).value })">
            <option value="recientes">Más recientes</option>
            <option value="precio_asc">Precio: menor a mayor</option>
            <option value="precio_desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside id="filtros" aria-label="Filtros" class="space-y-5 lg:block" :class="mostrarFiltros ? 'block' : 'hidden'">
        <form class="tarjeta space-y-5" @submit.prevent="filtrar({ q: busqueda.trim() })">
          <div role="search">
            <label for="buscar" class="campo-etiqueta">Buscar</label>
            <input id="buscar" v-model="busqueda" type="search" class="campo" placeholder="Camisa, vestido…" />
          </div>

          <fieldset>
            <legend class="campo-etiqueta">Categoría</legend>
            <ul class="space-y-1 text-sm">
              <li>
                <button type="button" class="w-full rounded-lg px-2 py-1 text-left hover:bg-stone-100" :class="!val('categoria') ? 'bg-brand-50 font-semibold text-brand-900' : 'text-stone-700'" :aria-pressed="!val('categoria')" @click="filtrar({ categoria: undefined, color: undefined, talla: undefined })">Todas</button>
              </li>
              <li v-for="c in categorias" :key="c._id">
                <button type="button" class="w-full rounded-lg px-2 py-1 text-left hover:bg-stone-100" :class="val('categoria') === c.slug ? 'bg-brand-50 font-semibold text-brand-900' : 'text-stone-700'" :aria-pressed="val('categoria') === c.slug" @click="filtrar({ categoria: c.slug, color: undefined, talla: undefined })">{{ c.nombre }}</button>
              </li>
            </ul>
          </fieldset>

          <fieldset v-if="facetas.tallas.length">
            <legend class="campo-etiqueta">Talla</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in facetas.tallas" :key="t" type="button"
                class="min-w-10 rounded-lg border px-2.5 py-1 text-sm font-medium"
                :class="val('talla') === t ? 'border-brand-800 bg-brand-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'"
                :aria-pressed="val('talla') === t" @click="alternar('talla', t)"
              >{{ t }}</button>
            </div>
          </fieldset>

          <fieldset v-if="facetas.colores.length">
            <legend class="campo-etiqueta">Color</legend>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in facetas.colores" :key="c" type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium"
                :class="val('color').toLowerCase() === c.toLowerCase() ? 'border-brand-800 bg-brand-50 text-brand-900' : 'border-stone-300 bg-white hover:bg-stone-100'"
                :aria-pressed="val('color').toLowerCase() === c.toLowerCase()" @click="alternar('color', c)"
              >
                <span class="h-3 w-3 rounded-full border border-stone-300" :style="{ backgroundColor: punto(c) }" aria-hidden="true" />{{ c }}
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend class="campo-etiqueta">Precio (Bs.)</legend>
            <div class="flex items-center gap-2">
              <label class="sr-only" for="pmin">Precio mínimo</label>
              <input id="pmin" v-model="minimo" type="number" min="0" step="1" inputmode="numeric" class="campo" :placeholder="facetas.precioMax ? String(facetas.precioMin) : 'Mín.'" />
              <span class="text-stone-400" aria-hidden="true">–</span>
              <label class="sr-only" for="pmax">Precio máximo</label>
              <input id="pmax" v-model="maximo" type="number" min="0" step="1" inputmode="numeric" class="campo" :placeholder="facetas.precioMax ? String(facetas.precioMax) : 'Máx.'" />
            </div>
            <button type="button" class="btn-secundario btn-sm mt-2 w-full" @click="aplicarPrecio">Aplicar precio</button>
            <p v-if="facetas.precioMax" class="mt-1 text-[11px] text-stone-500">Desde {{ formatearBs(facetas.precioMin) }} hasta {{ formatearBs(facetas.precioMax) }}</p>
          </fieldset>

          <div class="flex gap-2">
            <button type="submit" class="btn-primario btn-sm flex-1">Buscar</button>
            <button v-if="hayFiltros" type="button" class="btn-secundario btn-sm" @click="limpiar">Limpiar</button>
          </div>
        </form>
      </aside>

      <section aria-label="Productos" class="min-w-0 space-y-4">
        <ul v-if="hayFiltros" class="flex flex-wrap gap-2 text-xs" aria-label="Filtros activos">
          <li v-if="val('q')"><button type="button" class="insignia-gris" @click="filtrar({ q: undefined })">Búsqueda: {{ val('q') }} ×</button></li>
          <li v-if="categoriaActiva"><button type="button" class="insignia-gris" @click="filtrar({ categoria: undefined })">{{ categoriaActiva.nombre }} ×</button></li>
          <li v-if="val('talla')"><button type="button" class="insignia-gris" @click="filtrar({ talla: undefined })">Talla {{ val('talla') }} ×</button></li>
          <li v-if="val('color')"><button type="button" class="insignia-gris" @click="filtrar({ color: undefined })">{{ val('color') }} ×</button></li>
          <li v-if="val('precioMin') || val('precioMax')"><button type="button" class="insignia-gris" @click="filtrar({ precioMin: undefined, precioMax: undefined })">Bs {{ val('precioMin') || '0' }} – {{ val('precioMax') || '∞' }} ×</button></li>
        </ul>

        <div v-if="error" class="tarjeta text-center" role="alert">
          <p class="text-stone-700">No pudimos cargar los productos.</p>
          <button type="button" class="btn-secundario mt-3" @click="refresh()">Reintentar</button>
        </div>

        <template v-else>
          <ul v-if="data?.items.length" class="grid grid-cols-2 gap-4 md:grid-cols-3">
            <li v-for="p in data.items" :key="p._id"><ProductCard :producto="p" /></li>
          </ul>
          <div v-else-if="status !== 'pending'" class="tarjeta py-12 text-center text-stone-600">
            No encontramos productos con esos filtros.
            <button v-if="hayFiltros" type="button" class="mt-3 block w-full text-sm font-semibold text-brand-800 underline" @click="limpiar">Quitar filtros</button>
          </div>

          <nav v-if="data && data.pages > 1" class="flex items-center justify-center gap-3" aria-label="Paginación">
            <button type="button" class="btn-secundario" :disabled="page <= 1" @click="filtrar({ page: page - 1 })">← Anterior</button>
            <span class="text-sm text-stone-600">Página {{ data.page }} de {{ data.pages }}</span>
            <button type="button" class="btn-secundario" :disabled="page >= data.pages" @click="filtrar({ page: page + 1 })">Siguiente →</button>
          </nav>
        </template>
      </section>
    </div>
  </div>
</template>
