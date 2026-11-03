<script setup lang="ts">
import { formatearBs } from '~~/shared/utils/money'
import type { Paginado, PedidoDTO } from '~~/shared/types'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Mis pedidos · Vestiq', robots: 'noindex' })

const page = ref(1)
const { data, status, error, refresh } = await useFetch<Paginado<PedidoDTO>>('/api/orders', {
  query: computed(() => ({ page: page.value, limit: 10 })),
})

const fecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' })
const resumen = (p: PedidoDTO) => {
  const unidades = p.items.reduce((s, i) => s + i.cantidad, 0)
  return `${unidades} prenda(s) · ${p.items[0]?.nombre ?? ''}${p.items.length > 1 ? ` y ${p.items.length - 1} más` : ''}`
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-5 text-2xl font-extrabold text-stone-900">Mi cuenta</h1>
    <CuentaTabs />

    <div v-if="error" class="aviso-error" role="alert">No se pudieron cargar sus pedidos. <button type="button" class="underline" @click="refresh()">Reintentar</button></div>

    <div v-else-if="!data?.items.length && status !== 'pending'" class="tarjeta py-12 text-center">
      <p class="font-semibold text-stone-800">Todavía no tiene pedidos</p>
      <p class="mt-1 text-sm text-stone-500">Los pedidos hechos con su cuenta aparecerán aquí.</p>
      <NuxtLink to="/productos" class="btn-primario mt-5">Ir a la tienda</NuxtLink>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="p in data?.items ?? []" :key="p._id">
        <NuxtLink :to="`/pedido/${p.numero}`" class="tarjeta block transition hover:border-brand-300 hover:shadow-md">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-mono text-sm font-bold text-brand-800">{{ p.numero }}</p>
              <p class="text-xs text-stone-500">{{ fecha.format(new Date(p.createdAt)) }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <EstadoBadge tipo="pedido" :valor="p.estadoPedido" />
              <EstadoBadge tipo="pago" :valor="p.estadoPago" />
            </div>
          </div>
          <div class="mt-3 flex items-end justify-between gap-3">
            <p class="truncate text-sm text-stone-600">{{ resumen(p) }}</p>
            <p class="shrink-0 font-bold text-stone-900">{{ formatearBs(p.totales.total) }}</p>
          </div>
          <p v-if="p.metodoPago !== 'contra_entrega' && p.estadoPago !== 'pagado' && p.estadoPedido !== 'cancelado' && !p.comprobantePagoUrl" class="mt-2 text-xs font-semibold text-amber-700">Falta adjuntar el comprobante de pago</p>
          <p v-else-if="p.estadoPago === 'rechazado'" class="mt-2 text-xs font-semibold text-red-700">Comprobante rechazado: adjunte uno nuevo</p>
        </NuxtLink>
      </li>
    </ul>

    <nav v-if="data && data.pages > 1" class="mt-5 flex items-center justify-center gap-3" aria-label="Paginación">
      <button type="button" class="btn-secundario" :disabled="page <= 1" @click="page--">← Anterior</button>
      <span class="text-sm text-stone-600">Página {{ data.page }} de {{ data.pages }}</span>
      <button type="button" class="btn-secundario" :disabled="page >= data.pages" @click="page++">Siguiente →</button>
    </nav>
  </div>
</template>
