<script setup lang="ts">
import type { CategoriaDTO, Paginado, ProductoDTO } from '~~/shared/types'

useSeoMeta({
  title: 'Vestiq · Moda en Bolivia',
  description: 'Ropa con envíos a toda Bolivia. Pague con QR, transferencia o contra entrega. Precios en Bs. con IVA incluido.',
})

const { data: categorias } = await useFetch<CategoriaDTO[]>('/api/categories', { default: () => [] })
const { data: novedades, error, refresh } = await useFetch<Paginado<ProductoDTO>>('/api/products', {
  query: { orden: 'recientes', limit: 8 },
})

const beneficios = [
  { titulo: 'Envíos a todo el país', texto: 'La Paz, El Alto, Santa Cruz, Cochabamba y más ciudades.' },
  { titulo: 'Pago local', texto: 'QR (Simple QR), transferencia o efectivo contra entrega.' },
  { titulo: 'Facturación con NIT o CI', texto: 'Su recibo detalla el IVA (13%) en bolivianos.' },
]
</script>

<template>
  <div class="space-y-12">
    <section class="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 px-6 py-12 text-white sm:px-10">
      <h1 class="max-w-xl text-3xl font-extrabold sm:text-5xl">Moda que llega a todo el país</h1>
      <p class="mt-3 max-w-xl text-brand-100">Prendas para cada ocasión, con precios finales en bolivianos (IVA incluido) y pagos pensados para Bolivia.</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <NuxtLink to="/productos" class="btn bg-white text-brand-900 hover:bg-brand-50">Ver la tienda</NuxtLink>
        <NuxtLink to="/registro" class="btn border border-white/60 text-white hover:bg-white/10">Crear mi cuenta</NuxtLink>
      </div>
    </section>

    <section aria-label="Beneficios" class="grid gap-4 sm:grid-cols-3">
      <div v-for="b in beneficios" :key="b.titulo" class="tarjeta">
        <h2 class="font-bold text-stone-900">{{ b.titulo }}</h2>
        <p class="mt-1 text-sm text-stone-600">{{ b.texto }}</p>
      </div>
    </section>

    <section v-if="categorias.length" aria-labelledby="t-cat">
      <h2 id="t-cat" class="mb-4 text-2xl font-extrabold text-stone-900">Compre por categoría</h2>
      <ul class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <li v-for="c in categorias" :key="c._id">
          <NuxtLink
            :to="{ path: '/productos', query: { categoria: c.slug } }"
            class="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-200 to-stone-100 p-4 focus:outline-none focus:ring-2 focus:ring-brand-600/40"
          >
            <img v-if="c.imagenUrl" :src="c.imagenUrl" :alt="''" loading="lazy" class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            <span class="relative rounded-lg bg-white/90 px-3 py-1 text-sm font-bold text-stone-900">{{ c.nombre }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="t-nov">
      <div class="mb-4 flex items-end justify-between">
        <h2 id="t-nov" class="text-2xl font-extrabold text-stone-900">Novedades</h2>
        <NuxtLink to="/productos" class="text-sm font-semibold text-brand-800 hover:underline">Ver todo →</NuxtLink>
      </div>
      <div v-if="error" class="tarjeta text-center" role="alert">
        <p class="text-stone-700">No pudimos cargar los productos.</p>
        <button type="button" class="btn-secundario mt-3" @click="refresh()">Reintentar</button>
      </div>
      <ul v-else-if="novedades?.items.length" class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <li v-for="p in novedades.items" :key="p._id"><ProductCard :producto="p" /></li>
      </ul>
      <p v-else class="tarjeta py-10 text-center text-stone-600">Pronto tendremos productos nuevos.</p>
    </section>
  </div>
</template>
