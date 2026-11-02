<script setup lang="ts">
import { ETIQUETA_DOCUMENTO } from '~~/shared/utils/bolivia'
import { formatearBs } from '~~/shared/utils/money'
import type { PedidoDTO } from '~~/shared/types'

const route = useRoute()
useSeoMeta({ title: () => `Pedido ${route.params.numero} · Vestiq`, robots: 'noindex' })

const token = computed(() => String(route.query.t ?? ''))
const { data: pedido, error, refresh } = await useFetch<PedidoDTO>(() => `/api/orders/${route.params.numero}`, {
  query: { t: token },
})

const etiquetaPedido: Record<string, string> = { pendiente: 'Pendiente', procesando: 'Procesando', enviado: 'Enviado', entregado: 'Entregado' }
const etiquetaMetodo: Record<string, string> = { qr: 'Pago por QR', transferencia: 'Transferencia bancaria', contra_entrega: 'Contra entrega (efectivo)' }

const comprobante = ref<string[]>([])
const guardando = ref(false)
const mensaje = ref('')
const errorComprobante = ref('')

const puedeAdjuntar = computed(() => pedido.value && pedido.value.metodoPago !== 'contra_entrega' && pedido.value.estadoPago === 'pendiente')

const imprimir = () => window.print()

async function guardarComprobante() {
  if (!comprobante.value[0]) return
  guardando.value = true
  errorComprobante.value = ''
  mensaje.value = ''
  try {
    await $fetch(`/api/orders/${route.params.numero}/comprobante`, {
      method: 'PATCH',
      body: { token: token.value, url: comprobante.value[0] },
    })
    comprobante.value = []
    mensaje.value = 'Comprobante recibido. Confirmaremos su pago a la brevedad.'
    await refresh()
  } catch (e) {
    errorComprobante.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div v-if="error || !pedido" class="tarjeta mx-auto max-w-lg py-12 text-center">
    <p class="text-lg font-semibold">No encontramos este pedido</p>
    <p class="mt-1 text-sm text-stone-500">Verifique que el enlace esté completo (incluye un código de acceso).</p>
    <NuxtLink to="/" class="btn-primario mt-5">Volver a la tienda</NuxtLink>
  </div>

  <article v-else class="mx-auto max-w-3xl space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-emerald-700 print:hidden">¡Gracias por su compra!</p>
        <h1 class="text-2xl font-extrabold">Pedido {{ pedido.numero }}</h1>
        <p class="text-sm text-stone-500">{{ new Date(pedido.createdAt).toLocaleString('es-BO') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">Pedido: {{ etiquetaPedido[pedido.estadoPedido] }}</span>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="pedido.estadoPago === 'pagado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">
          Pago: {{ pedido.estadoPago === 'pagado' ? 'Pagado' : 'Pendiente' }}
        </span>
        <button type="button" class="btn-secundario print:hidden" @click="imprimir">Imprimir recibo</button>
      </div>
    </header>

    <section v-if="puedeAdjuntar" class="tarjeta space-y-4 print:hidden" aria-labelledby="h-pagar">
      <h2 id="h-pagar" class="text-lg font-bold">Complete su pago</h2>
      <PagoInstrucciones :metodo="pedido.metodoPago" :total="pedido.totales.total" />
      <div v-if="pedido.comprobantePagoUrl" class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <img :src="pedido.comprobantePagoUrl" alt="Comprobante enviado" class="h-14 w-14 rounded object-cover" />
        <span>Comprobante recibido. Está en revisión; puede reemplazarlo si se equivocó.</span>
      </div>
      <ImageUploader v-model="comprobante" scope="comprobante" label="Adjuntar comprobante de pago" />
      <p v-if="errorComprobante" class="campo-error" role="alert">{{ errorComprobante }}</p>
      <p v-if="mensaje" class="text-sm text-emerald-700" role="status">{{ mensaje }}</p>
      <button type="button" class="btn-primario" :disabled="!comprobante.length || guardando" @click="guardarComprobante">
        {{ guardando ? 'Enviando…' : 'Enviar comprobante' }}
      </button>
    </section>

    <section v-else-if="pedido.metodoPago === 'contra_entrega'" class="tarjeta print:hidden">
      <PagoInstrucciones metodo="contra_entrega" :total="pedido.totales.total" />
    </section>

    <section class="tarjeta" aria-labelledby="h-recibo">
      <h2 id="h-recibo" class="mb-3 text-lg font-bold">Recibo</h2>
      <table class="w-full text-sm">
        <thead class="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
          <tr><th class="py-2">Producto</th><th class="py-2 text-right">Cant.</th><th class="py-2 text-right">P. unit.</th><th class="py-2 text-right">Subtotal</th></tr>
        </thead>
        <tbody class="divide-y divide-stone-100">
          <tr v-for="i in pedido.items" :key="i.sku">
            <td class="py-2">{{ i.nombre }}<span class="block text-xs text-stone-500">{{ i.color }} · Talla {{ i.talla }} · {{ i.sku }}</span></td>
            <td class="py-2 text-right">{{ i.cantidad }}</td>
            <td class="py-2 text-right">{{ formatearBs(i.precioUnitario) }}</td>
            <td class="py-2 text-right font-medium">{{ formatearBs(i.subtotal) }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
        <div class="flex justify-between"><dt class="text-stone-600">Subtotal</dt><dd>{{ formatearBs(pedido.totales.subtotal) }}</dd></div>
        <div class="flex justify-between"><dt class="text-stone-600">Envío</dt><dd>{{ formatearBs(pedido.totales.envio) }}</dd></div>
        <div class="flex justify-between border-t border-stone-200 pt-1 text-base font-bold"><dt>Total</dt><dd>{{ formatearBs(pedido.totales.total) }}</dd></div>
        <div class="flex justify-between text-xs text-stone-600"><dt>Importe sin IVA</dt><dd>{{ formatearBs(pedido.totales.importeSinIva) }}</dd></div>
        <div class="flex justify-between text-xs font-semibold text-stone-800"><dt>IVA {{ Math.round(pedido.totales.ivaTasa * 100) }}% (incluido)</dt><dd>{{ formatearBs(pedido.totales.iva) }}</dd></div>
      </dl>
    </section>

    <div class="grid gap-6 sm:grid-cols-2">
      <section class="tarjeta text-sm" aria-labelledby="h-fact">
        <h2 id="h-fact" class="mb-2 text-base font-bold">Datos de facturación</h2>
        <p class="font-medium">{{ pedido.facturacion.razonSocial }}</p>
        <p class="text-stone-600">
          {{ ETIQUETA_DOCUMENTO[pedido.facturacion.tipoDocumento] }}: {{ pedido.facturacion.numeroDocumento }}<template v-if="pedido.facturacion.complemento">-{{ pedido.facturacion.complemento }}</template>
        </p>
        <p class="text-stone-600">{{ pedido.email }}</p>
        <p class="mt-2 text-xs text-stone-500">{{ etiquetaMetodo[pedido.metodoPago] }}</p>
      </section>
      <section class="tarjeta text-sm" aria-labelledby="h-env">
        <h2 id="h-env" class="mb-2 text-base font-bold">Datos de envío</h2>
        <p class="font-medium">{{ pedido.envio.nombreDestinatario }}</p>
        <p class="text-stone-600">{{ pedido.envio.direccion }}, {{ pedido.envio.zona }}</p>
        <p class="text-stone-600">{{ pedido.envio.ciudad }}</p>
        <p v-if="pedido.envio.referencia" class="text-stone-500">Ref.: {{ pedido.envio.referencia }}</p>
        <p class="text-stone-600">Tel. {{ pedido.envio.telefono }}</p>
      </section>
    </div>

    <p class="text-center text-xs text-stone-500 print:hidden">Guarde este enlace: es su acceso privado al pedido.</p>
  </article>
</template>
