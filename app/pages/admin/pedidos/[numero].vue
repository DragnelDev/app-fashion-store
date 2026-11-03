<script setup lang="ts">
import {
  ETIQUETA_DOCUMENTO, ETIQUETA_ESTADO_PEDIDO, ETIQUETA_METODO_PAGO, TRANSICIONES_PEDIDO,
  type EstadoPago, type EstadoPedido,
} from '~~/shared/utils/bolivia'
import { formatearBs } from '~~/shared/utils/money'
import type { PedidoDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Pedido · Vestiq Admin', robots: 'noindex' })

const route = useRoute()
const numero = String(route.params.numero).toUpperCase()
const { data: pedido, error } = await useFetch<PedidoDTO>(`/api/admin/orders/${numero}`)
if (error.value || !pedido.value) {
  throw createError({ statusCode: 404, statusMessage: 'Pedido no encontrado', fatal: true })
}

const fecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz' })
const fmt = (iso: string) => fecha.format(new Date(iso))

const accionando = ref(false)
const errorAccion = ref('')
const mensaje = ref('')

const siguientes = computed<readonly EstadoPedido[]>(() => (pedido.value ? TRANSICIONES_PEDIDO[pedido.value.estadoPedido] : []))
const prepago = computed(() => pedido.value?.metodoPago !== 'contra_entrega')
const puedeRevisarPago = computed(() => !!pedido.value && prepago.value && pedido.value.estadoPedido !== 'cancelado')
const telefonoWa = computed(() => (pedido.value?.envio.telefono ?? '').replace(/\D/g, ''))

async function patch(body: { estadoPedido?: EstadoPedido; estadoPago?: EstadoPago; nota?: string }) {
  accionando.value = true
  errorAccion.value = ''
  mensaje.value = ''
  try {
    pedido.value = await $fetch<PedidoDTO>(`/api/admin/orders/${numero}`, { method: 'PATCH', body })
    mensaje.value = 'Pedido actualizado.'
  } catch (e) {
    errorAccion.value = mensajeDeError(e)
  } finally {
    accionando.value = false
  }
}

function cambiarPedido(destino: EstadoPedido) {
  const aviso = destino === 'cancelado'
    ? `¿Cancelar el pedido ${numero}? Se devolverá el stock al inventario. Esta acción no se puede deshacer.`
    : `¿Pasar el pedido ${numero} a «${ETIQUETA_ESTADO_PEDIDO[destino]}»?`
  if (confirm(aviso)) patch({ estadoPedido: destino })
}
const imprimir = () => window.print()

function confirmarPago() {
  if (confirm('¿Confirmar que el pago fue recibido?')) patch({ estadoPago: 'pagado' })
}
function rechazarComprobante() {
  const motivo = prompt('Motivo del rechazo (el cliente podrá subir otro comprobante):')
  if (motivo === null) return
  patch({ estadoPago: 'rechazado', nota: motivo.trim() || undefined })
}
</script>

<template>
  <div v-if="pedido" class="max-w-5xl space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <NuxtLink to="/admin/pedidos" class="text-sm text-stone-500 hover:underline print:hidden">← Pedidos</NuxtLink>
        <h1 class="font-mono text-2xl font-extrabold text-stone-900">{{ pedido.numero }}</h1>
        <p class="text-sm text-stone-500">Creado el {{ fmt(pedido.createdAt) }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <EstadoBadge tipo="pedido" :valor="pedido.estadoPedido" />
        <EstadoBadge tipo="pago" :valor="pedido.estadoPago" />
        <button type="button" class="btn-secundario btn-sm print:hidden" @click="imprimir">Imprimir</button>
      </div>
    </div>

    <p v-if="mensaje" class="aviso-ok print:hidden" role="status">{{ mensaje }}</p>
    <p v-if="errorAccion" class="aviso-error print:hidden" role="alert">{{ errorAccion }}</p>

    <section v-if="siguientes.length" class="tarjeta print:hidden" aria-labelledby="t-estado">
      <h2 id="t-estado" class="mb-3 font-semibold text-stone-900">Cambiar estado del pedido</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="e in siguientes" :key="e" type="button" :disabled="accionando"
          :class="e === 'cancelado' ? 'btn-peligro' : 'btn-primario'" @click="cambiarPedido(e)"
        >{{ e === 'cancelado' ? 'Cancelar pedido' : `Marcar como ${ETIQUETA_ESTADO_PEDIDO[e].toLowerCase()}` }}</button>
      </div>
      <p v-if="prepago && pedido.estadoPago !== 'pagado'" class="mt-2 text-xs text-stone-500">Para enviar o entregar un pedido prepagado primero debe confirmarse el pago.</p>
    </section>

    <div class="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <section class="tarjeta overflow-x-auto" aria-labelledby="t-items">
        <h2 id="t-items" class="mb-3 font-semibold text-stone-900">Productos</h2>
        <table class="tabla">
          <thead><tr><th class="w-14"><span class="sr-only">Imagen</span></th><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P. unit.</th><th class="text-right">Subtotal</th></tr></thead>
          <tbody>
            <tr v-for="i in pedido.items" :key="i.sku">
              <td><img v-if="i.imagen" :src="i.imagen" alt="" class="h-12 w-12 rounded-lg object-cover" loading="lazy" /></td>
              <td>
                <p class="font-medium text-stone-900">{{ i.nombre }}</p>
                <p class="text-xs text-stone-500">{{ i.color }} / {{ i.talla }} · <span class="font-mono">{{ i.sku }}</span></p>
              </td>
              <td class="text-right">{{ i.cantidad }}</td>
              <td class="text-right">{{ formatearBs(i.precioUnitario) }}</td>
              <td class="text-right font-medium">{{ formatearBs(i.subtotal) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="tarjeta" aria-labelledby="t-fiscal">
        <h2 id="t-fiscal" class="mb-3 font-semibold text-stone-900">Desglose fiscal (Bs.)</h2>
        <dl class="space-y-1.5 text-sm">
          <div class="flex justify-between"><dt class="text-stone-600">Subtotal (IVA incluido)</dt><dd>{{ formatearBs(pedido.totales.subtotal) }}</dd></div>
          <div class="flex justify-between"><dt class="text-stone-600">Envío</dt><dd>{{ formatearBs(pedido.totales.envio) }}</dd></div>
          <div class="flex justify-between border-t border-stone-200 pt-1.5 text-base font-bold"><dt>Total</dt><dd>{{ formatearBs(pedido.totales.total) }}</dd></div>
          <div class="flex justify-between text-stone-600"><dt>Importe sin IVA</dt><dd>{{ formatearBs(pedido.totales.importeSinIva) }}</dd></div>
          <div class="flex justify-between text-stone-600"><dt>IVA {{ Math.round(pedido.totales.ivaTasa * 100) }}% incluido</dt><dd>{{ formatearBs(pedido.totales.iva) }}</dd></div>
        </dl>
      </section>
    </div>

    <div class="grid gap-5 md:grid-cols-2">
      <section class="tarjeta" aria-labelledby="t-fact">
        <h2 id="t-fact" class="mb-3 font-semibold text-stone-900">Facturación</h2>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-stone-500">Documento</dt>
          <dd>{{ ETIQUETA_DOCUMENTO[pedido.facturacion.tipoDocumento] }}: <strong>{{ pedido.facturacion.numeroDocumento }}</strong><template v-if="pedido.facturacion.complemento">-{{ pedido.facturacion.complemento }}</template></dd>
          <dt class="text-stone-500">Razón social</dt><dd>{{ pedido.facturacion.razonSocial }}</dd>
          <dt class="text-stone-500">Correo</dt><dd class="break-all">{{ pedido.email }}</dd>
        </dl>
      </section>

      <section class="tarjeta" aria-labelledby="t-envio">
        <h2 id="t-envio" class="mb-3 font-semibold text-stone-900">Envío</h2>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt class="text-stone-500">Destinatario</dt><dd>{{ pedido.envio.nombreDestinatario }}</dd>
          <dt class="text-stone-500">Teléfono</dt>
          <dd>
            <a :href="`tel:${pedido.envio.telefono}`" class="underline">{{ pedido.envio.telefono }}</a>
            <a :href="`https://wa.me/${telefonoWa}`" target="_blank" rel="noopener" class="ml-2 text-xs text-emerald-700 underline print:hidden">WhatsApp</a>
          </dd>
          <dt class="text-stone-500">Ciudad</dt><dd>{{ pedido.envio.ciudad }}</dd>
          <dt class="text-stone-500">Zona</dt><dd>{{ pedido.envio.zona }}</dd>
          <dt class="text-stone-500">Dirección</dt><dd>{{ pedido.envio.direccion }}</dd>
          <template v-if="pedido.envio.referencia"><dt class="text-stone-500">Referencia</dt><dd>{{ pedido.envio.referencia }}</dd></template>
        </dl>
        <p v-if="pedido.notas" class="mt-3 rounded-lg bg-stone-50 p-2 text-sm text-stone-600">Nota del cliente: {{ pedido.notas }}</p>
      </section>
    </div>

    <section class="tarjeta space-y-3" aria-labelledby="t-pago">
      <h2 id="t-pago" class="font-semibold text-stone-900">Pago · {{ ETIQUETA_METODO_PAGO[pedido.metodoPago] }}</h2>
      <p v-if="pedido.pagadoEn" class="text-sm text-emerald-700">Pago confirmado el {{ fmt(pedido.pagadoEn) }}.</p>
      <template v-if="prepago">
        <a v-if="pedido.comprobantePagoUrl" :href="pedido.comprobantePagoUrl" target="_blank" rel="noopener" class="block w-fit" title="Abrir en una pestaña nueva">
          <img :src="pedido.comprobantePagoUrl" alt="Comprobante de pago" class="max-h-96 rounded-lg border border-stone-200 object-contain" loading="lazy" />
        </a>
        <p v-else class="text-sm text-stone-500">El cliente aún no adjuntó el comprobante{{ pedido.estadoPago === 'rechazado' ? ' (el anterior fue rechazado)' : '' }}.</p>
        <div v-if="puedeRevisarPago" class="flex flex-wrap gap-2 print:hidden">
          <button v-if="pedido.estadoPago !== 'pagado'" type="button" class="btn-primario" :disabled="accionando || !pedido.comprobantePagoUrl" @click="confirmarPago">Confirmar pago</button>
          <button v-if="pedido.estadoPago !== 'rechazado' && pedido.comprobantePagoUrl" type="button" class="btn-peligro" :disabled="accionando" @click="rechazarComprobante">Rechazar comprobante</button>
          <button v-if="pedido.estadoPago === 'pagado'" type="button" class="btn-secundario" :disabled="accionando" @click="patch({ estadoPago: 'pendiente', nota: 'Pago revertido por el administrador' })">Revertir confirmación</button>
        </div>
      </template>
      <p v-else class="text-sm text-stone-600">Se cobra en efectivo al entregar; al marcar «Entregado» el pago se registra como pagado.</p>
    </section>

    <section class="tarjeta" aria-labelledby="t-hist">
      <h2 id="t-hist" class="mb-3 font-semibold text-stone-900">Historial</h2>
      <ol v-if="pedido.historial.length" class="space-y-3 border-l-2 border-stone-200 pl-4">
        <li v-for="(h, i) in pedido.historial" :key="i" class="relative text-sm">
          <span class="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-700" aria-hidden="true" />
          <p class="font-medium text-stone-900">{{ h.tipo === 'pedido' ? 'Pedido' : 'Pago' }}: {{ h.de === '-' ? 'creado' : h.de }} → {{ h.a }}</p>
          <p class="text-xs text-stone-500">{{ fmt(h.fecha) }}<template v-if="h.nota"> · {{ h.nota }}</template></p>
        </li>
      </ol>
      <p v-else class="text-sm text-stone-500">Sin movimientos registrados.</p>
    </section>
  </div>
</template>
