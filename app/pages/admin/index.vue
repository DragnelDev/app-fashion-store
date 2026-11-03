<script setup lang="ts">
import { ESTADOS_PEDIDO, ETIQUETA_ESTADO_PEDIDO } from '~~/shared/utils/bolivia'
import { formatearBs } from '~~/shared/utils/money'
import type { AdminStatsDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Dashboard · Vestiq Admin', robots: 'noindex' })

const { data: stats, error, refresh } = await useFetch<AdminStatsDTO>('/api/admin/stats')

const fecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' })
const fechaCorta = (iso: string) => fecha.format(new Date(iso))

// Gráfico de ventas (SVG): barras por día de los últimos 30 días.
const ANCHO = 600
const ALTO = 160
const barras = computed(() => {
  const serie = stats.value?.ventasUltimos30Dias ?? []
  const max = Math.max(1, ...serie.map((s) => s.total))
  const paso = ANCHO / Math.max(serie.length, 1)
  return serie.map((s, i) => {
    const h = Math.max(2, (s.total / max) * (ALTO - 20))
    return { x: i * paso + paso * 0.15, w: paso * 0.7, y: ALTO - h, h, ...s }
  })
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-extrabold text-stone-900">Dashboard</h1>

    <div v-if="error" class="aviso-error" role="alert">
      No se pudieron cargar los indicadores.
      <button type="button" class="ml-2 underline" @click="refresh()">Reintentar</button>
    </div>

    <template v-else-if="stats">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        <div class="tarjeta">
          <p class="campo-etiqueta">Ventas confirmadas</p>
          <p class="text-2xl font-bold text-stone-900">{{ formatearBs(stats.ventas.total) }}</p>
          <p class="text-xs text-stone-500">IVA incluido · {{ stats.ventas.pedidos }} pedido(s)</p>
          <p class="mt-1 text-xs text-stone-500">IVA 13% contenido: <strong>{{ formatearBs(stats.ventas.iva) }}</strong></p>
        </div>
        <NuxtLink :to="{ path: '/admin/pedidos', query: { estadoPago: 'pendiente' } }" class="tarjeta block hover:border-brand-300">
          <p class="campo-etiqueta">Pagos por confirmar</p>
          <p class="text-2xl font-bold" :class="stats.pagosPorConfirmar ? 'text-amber-700' : 'text-stone-900'">{{ stats.pagosPorConfirmar }}</p>
          <p class="text-xs text-stone-500">Comprobantes QR/transferencia por revisar</p>
        </NuxtLink>
        <div class="tarjeta">
          <p class="campo-etiqueta">Productos</p>
          <p class="text-2xl font-bold text-stone-900">{{ stats.productos.activos }} <span class="text-sm font-medium text-stone-500">activos</span></p>
          <p class="text-xs text-stone-500">{{ stats.productos.inactivos }} inactivo(s)</p>
        </div>
        <div class="tarjeta">
          <p class="campo-etiqueta">Pedidos por estado</p>
          <ul class="space-y-1 text-sm">
            <li v-for="e in ESTADOS_PEDIDO" :key="e" class="flex justify-between">
              <NuxtLink :to="{ path: '/admin/pedidos', query: { estadoPedido: e } }" class="text-stone-600 hover:underline">{{ ETIQUETA_ESTADO_PEDIDO[e] }}</NuxtLink>
              <strong>{{ stats.pedidosPorEstado[e] }}</strong>
            </li>
          </ul>
        </div>
      </section>

      <section class="tarjeta" aria-labelledby="t-ventas">
        <h2 id="t-ventas" class="mb-3 font-semibold text-stone-900">Ventas de los últimos 30 días</h2>
        <p v-if="!barras.length" class="text-sm text-stone-500">Aún no hay ventas confirmadas en este período.</p>
        <svg v-else :viewBox="`0 0 ${ANCHO} ${ALTO}`" class="h-40 w-full" role="img" aria-label="Gráfico de barras de ventas diarias">
          <g v-for="b in barras" :key="b.fecha">
            <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" class="fill-brand-700">
              <title>{{ b.fecha }}: {{ formatearBs(b.total) }} ({{ b.pedidos }} pedido(s))</title>
            </rect>
          </g>
        </svg>
      </section>

      <div class="grid gap-6 xl:grid-cols-2">
        <section class="tarjeta overflow-x-auto" aria-labelledby="t-stock">
          <h2 id="t-stock" class="mb-3 font-semibold text-stone-900">Stock bajo (≤ 3 unidades)</h2>
          <p v-if="!stats.stockBajo.length" class="text-sm text-stone-500">Todo el inventario tiene stock suficiente.</p>
          <table v-else class="tabla">
            <thead><tr><th>Producto</th><th>Variante</th><th class="text-right">Stock</th></tr></thead>
            <tbody>
              <tr v-for="s in stats.stockBajo" :key="s.sku">
                <td><NuxtLink :to="`/admin/productos/${s.productoId}`" class="font-medium hover:underline">{{ s.nombre }}</NuxtLink></td>
                <td class="text-stone-600">{{ s.color }} / {{ s.talla }} <span class="font-mono text-xs text-stone-400">{{ s.sku }}</span></td>
                <td class="text-right font-semibold" :class="s.stock === 0 ? 'text-red-600' : 'text-amber-700'">{{ s.stock }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="tarjeta overflow-x-auto" aria-labelledby="t-rec">
          <h2 id="t-rec" class="mb-3 font-semibold text-stone-900">Últimos pedidos</h2>
          <p v-if="!stats.recientes.length" class="text-sm text-stone-500">Todavía no hay pedidos.</p>
          <table v-else class="tabla">
            <thead><tr><th>Pedido</th><th>Fecha</th><th class="text-right">Total</th><th>Estado</th></tr></thead>
            <tbody>
              <tr v-for="p in stats.recientes" :key="p._id">
                <td><NuxtLink :to="`/admin/pedidos/${p.numero}`" class="font-mono text-xs font-semibold hover:underline">{{ p.numero }}</NuxtLink></td>
                <td class="text-xs text-stone-500">{{ fechaCorta(p.createdAt) }}</td>
                <td class="text-right">{{ formatearBs(p.totales.total) }}</td>
                <td><EstadoBadge tipo="pedido" :valor="p.estadoPedido" /></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </div>
</template>
