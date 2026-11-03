<script setup lang="ts">
import { calcularTotales, formatearBs } from '~~/shared/utils/money'

useSeoMeta({ title: 'Carrito · Vestiq', robots: 'noindex' })

const cart = useCartStore()
const avisos = ref<string[]>([])
const sincronizando = ref(false)

// El carrito vive en localStorage: se lee tras montar la app (plugins/cart.client.ts). Cuando
// está listo se contrastan precio y stock con el servidor, por si cambiaron desde que se agregó.
async function sincronizar() {
  sincronizando.value = true
  try {
    avisos.value = await cart.sincronizar()
  } finally {
    sincronizando.value = false
  }
}
watch(() => cart.hidratado, (listo) => { if (listo) sincronizar() }, { immediate: true })

// El IVA (13%) está contenido en el precio; el envío se calcula en el checkout según la ciudad.
const desglose = computed(() => calcularTotales(cart.subtotal, 0))
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-extrabold text-stone-900">Su carrito</h1>

    <div v-if="!cart.hidratado" class="tarjeta py-14 text-center text-stone-500" role="status">Cargando su carrito…</div>

    <div v-else-if="!cart.items.length" class="tarjeta py-14 text-center">
      <p class="text-lg font-semibold text-stone-800">Su carrito está vacío</p>
      <p class="mt-1 text-sm text-stone-500">Explore la tienda y agregue lo que le guste.</p>
      <NuxtLink to="/productos" class="btn-primario mt-5">Ir a la tienda</NuxtLink>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div class="space-y-3">
        <div v-if="avisos.length" class="aviso-info space-y-1" role="status">
          <p v-for="a in avisos" :key="a">{{ a }}</p>
        </div>

        <ul class="tarjeta divide-y divide-stone-100 p-0">
          <li v-for="i in cart.items" :key="i.sku" class="flex gap-4 p-4">
            <NuxtLink :to="`/productos/${i.slug}`" class="shrink-0">
              <img :src="i.imagen" :alt="i.nombre" class="h-24 w-20 rounded-lg object-cover" loading="lazy" />
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/productos/${i.slug}`" class="block truncate font-semibold text-stone-900 hover:underline">{{ i.nombre }}</NuxtLink>
              <p class="text-xs text-stone-500">{{ i.color }} · Talla {{ i.talla }} · <span class="font-mono">{{ i.sku }}</span></p>
              <p class="mt-1 text-sm text-stone-600">{{ formatearBs(i.precio) }} c/u</p>
              <div class="mt-2 flex items-center gap-3">
                <div class="inline-flex items-center rounded-lg border border-stone-300" role="group" :aria-label="`Cantidad de ${i.nombre}`">
                  <button type="button" class="px-3 py-1 text-lg leading-none hover:bg-stone-100 disabled:opacity-40" :disabled="i.cantidad <= 1" aria-label="Quitar una unidad" @click="cart.cambiarCantidad(i.sku, i.cantidad - 1)">−</button>
                  <span class="min-w-8 text-center text-sm font-semibold" aria-live="polite">{{ i.cantidad }}</span>
                  <button type="button" class="px-3 py-1 text-lg leading-none hover:bg-stone-100 disabled:opacity-40" :disabled="i.cantidad >= i.stock" aria-label="Agregar una unidad" @click="cart.cambiarCantidad(i.sku, i.cantidad + 1)">+</button>
                </div>
                <button type="button" class="text-xs font-medium text-red-600 hover:underline" @click="cart.quitar(i.sku)">Quitar</button>
              </div>
              <p v-if="i.cantidad >= i.stock" class="mt-1 text-xs text-amber-700">Máximo disponible: {{ i.stock }}</p>
            </div>
            <p class="shrink-0 text-sm font-bold">{{ formatearBs(i.precio * i.cantidad) }}</p>
          </li>
        </ul>

        <button type="button" class="text-sm text-stone-500 hover:underline" @click="cart.vaciar()">Vaciar carrito</button>
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start" aria-labelledby="h-res">
        <div class="tarjeta space-y-4">
          <h2 id="h-res" class="text-lg font-bold">Resumen</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-stone-600">Subtotal ({{ cart.cantidadTotal }} prenda(s))</dt><dd class="font-semibold">{{ formatearBs(cart.subtotal) }}</dd></div>
            <div class="flex justify-between text-xs text-stone-500"><dt>Importe sin IVA</dt><dd>{{ formatearBs(desglose.importeSinIva) }}</dd></div>
            <div class="flex justify-between text-xs text-stone-500"><dt>IVA 13% incluido</dt><dd>{{ formatearBs(desglose.iva) }}</dd></div>
            <p class="text-xs text-stone-500">El envío se calcula en el checkout según su ciudad.</p>
          </dl>
          <NuxtLink to="/checkout" class="btn-primario w-full" :aria-disabled="sincronizando">Continuar al checkout</NuxtLink>
          <NuxtLink to="/productos" class="btn-secundario w-full">Seguir comprando</NuxtLink>
        </div>
      </aside>
    </div>
  </div>
</template>
