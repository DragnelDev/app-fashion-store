<script setup lang="ts">
import { ESTADOS_PAGO, ESTADOS_PEDIDO, ETIQUETA_ESTADO_PAGO, ETIQUETA_ESTADO_PEDIDO, ETIQUETA_METODO_PAGO, METODOS_PAGO } from '~~/shared/utils/bolivia'
import { formatearBs } from '~~/shared/utils/money'
import type { Paginado, PedidoDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Pedidos · Vestiq Admin', robots: 'noindex' })

const route = useRoute()
const router = useRouter()

const val = (k: string) => String(route.query[k] ?? '')
const page = computed(() => Math.max(1, Number(route.query.page ?? 1) || 1))
const busqueda = ref(val('q'))
watch(() => route.query.q, () => { busqueda.value = val('q') })

const { data, status, error, refresh } = await useFetch<Paginado<PedidoDTO>>('/api/admin/orders', {
  query: computed(() => ({
    estadoPedido: val('estadoPedido') || undefined,
    estadoPago: val('estadoPago') || undefined,
    metodoPago: val('metodoPago') || undefined,
    q: val('q') || undefined,
    page: page.value,
    limit: 20,
  })),
})

function filtrar(cambios: Record<string, string | number | undefined>) {
  const query: Record<string, unknown> = { ...route.query, ...cambios }
  if (!('page' in cambios)) delete query.page
  for (const k of Object.keys(query)) if (query[k] === '' || query[k] === undefined) delete query[k]
  router.push({ query: query as Record<string, string | number> })
}
const alCambiar = (k: string) => (e: Event) => filtrar({ [k]: (e.target as HTMLSelectElement).value })

const fecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' })
const porRevisar = (p: PedidoDTO) => p.metodoPago !== 'contra_entrega' && p.estadoPago === 'pendiente' && !!p.comprobantePagoUrl
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-extrabold text-stone-900">Pedidos</h1>

    <section class="flex flex-wrap items-end gap-3" aria-label="Filtros">
      <form class="min-w-48 flex-1 sm:max-w-xs" role="search" @submit.prevent="filtrar({ q: busqueda.trim() })">
        <label for="q" class="campo-etiqueta">Buscar</label>
        <input id="q" v-model="busqueda" type="search" class="campo" placeholder="Nº, correo, documento, nombre…" />
      </form>
      <div>
        <label for="f-ped" class="campo-etiqueta">Pedido</label>
        <select id="f-ped" class="campo" :value="val('estadoPedido')" @change="alCambiar('estadoPedido')($event)">
          <option value="">Todos</option>
          <option v-for="e in ESTADOS_PEDIDO" :key="e" :value="e">{{ ETIQUETA_ESTADO_PEDIDO[e] }}</option>
        </select>
      </div>
      <div>
        <label for="f-pago" class="campo-etiqueta">Pago</label>
        <select id="f-pago" class="campo" :value="val('estadoPago')" @change="alCambiar('estadoPago')($event)">
          <option value="">Todos</option>
          <option v-for="e in ESTADOS_PAGO" :key="e" :value="e">{{ ETIQUETA_ESTADO_PAGO[e] }}</option>
        </select>
      </div>
      <div>
        <label for="f-met" class="campo-etiqueta">Método</label>
        <select id="f-met" class="campo" :value="val('metodoPago')" @change="alCambiar('metodoPago')($event)">
          <option value="">Todos</option>
          <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ ETIQUETA_METODO_PAGO[m] }}</option>
        </select>
      </div>
    </section>

    <div v-if="error" class="aviso-error" role="alert">No se pudo cargar el listado. <button type="button" class="underline" @click="refresh()">Reintentar</button></div>

    <div v-else class="tarjeta overflow-x-auto p-0">
      <table class="tabla">
        <thead><tr><th>Pedido</th><th>Fecha</th><th>Destinatario</th><th>Ciudad</th><th>Pago</th><th class="text-right">Total</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="p in data?.items ?? []" :key="p._id">
            <td><NuxtLink :to="`/admin/pedidos/${p.numero}`" class="font-mono text-xs font-semibold text-brand-800 hover:underline">{{ p.numero }}</NuxtLink></td>
            <td class="whitespace-nowrap text-xs text-stone-500">{{ fecha.format(new Date(p.createdAt)) }}</td>
            <td>
              <p class="font-medium text-stone-900">{{ p.envio.nombreDestinatario }}</p>
              <p class="text-xs text-stone-500">{{ p.email }}</p>
            </td>
            <td class="text-stone-600">{{ p.envio.ciudad }}</td>
            <td>
              <EstadoBadge tipo="metodo" :valor="p.metodoPago" />
              <p v-if="porRevisar(p)" class="mt-1 text-xs font-semibold text-amber-700">● Comprobante por revisar</p>
            </td>
            <td class="whitespace-nowrap text-right font-medium">{{ formatearBs(p.totales.total) }}</td>
            <td class="space-y-1">
              <EstadoBadge tipo="pedido" :valor="p.estadoPedido" />
              <div><EstadoBadge tipo="pago" :valor="p.estadoPago" /></div>
            </td>
          </tr>
          <tr v-if="!data?.items.length && status !== 'pending'"><td colspan="7" class="py-10 text-center text-stone-500">No hay pedidos con esos filtros.</td></tr>
        </tbody>
      </table>
    </div>

    <nav v-if="data && data.pages > 1" class="flex items-center justify-center gap-3" aria-label="Paginación">
      <button type="button" class="btn-secundario" :disabled="page <= 1" @click="filtrar({ page: page - 1 })">← Anterior</button>
      <span class="text-sm text-stone-600">Página {{ data.page }} de {{ data.pages }} · {{ data.total }} pedido(s)</span>
      <button type="button" class="btn-secundario" :disabled="page >= data.pages" @click="filtrar({ page: page + 1 })">Siguiente →</button>
    </nav>
  </div>
</template>
