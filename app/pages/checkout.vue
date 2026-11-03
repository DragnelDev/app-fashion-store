<script setup lang="ts">
import { erroresPorCampo, pedidoSchema } from '~~/shared/schemas/order'
import {
  CIUDADES_BOLIVIA,
  ETIQUETA_DOCUMENTO,
  METODOS_PAGO,
  TIPOS_DOCUMENTO,
  calcularEnvioBs,
  type CiudadBolivia,
  type MetodoPago,
  type TipoDocumento,
} from '~~/shared/utils/bolivia'
import { calcularTotales, formatearBs } from '~~/shared/utils/money'
import type { CrearPedidoRespuesta } from '~~/shared/types'

useSeoMeta({ title: 'Checkout · Vestiq', robots: 'noindex' })

const cart = useCartStore()
const auth = useAuthStore()
const { items, subtotal, hidratado } = storeToRefs(cart)
const { cambiarCantidad, quitar, vaciar, ajustarAStock } = cart

// --- Formulario ---------------------------------------------------------------
const form = reactive({
  email: '',
  facturacion: {
    tipoDocumento: 'CI' as TipoDocumento,
    numeroDocumento: '',
    complemento: '',
    razonSocial: '',
  },
  envio: {
    nombreDestinatario: '',
    /** Solo los 8 dígitos; el prefijo +591 se agrega al enviar. */
    telefono: '',
    ciudad: '' as '' | CiudadBolivia,
    zona: '',
    direccion: '',
    referencia: '',
  },
  metodoPago: 'qr' as MetodoPago,
  notas: '',
})
const comprobantes = ref<string[]>([])

// --- Datos de la cuenta (si hay sesión): contacto, dirección principal y facturación por defecto ---
const direccionesGuardadas = computed(() => auth.usuario?.direcciones ?? [])
function usarDireccion(id: string) {
  const d = direccionesGuardadas.value.find((x) => x._id === id)
  if (!d) return
  form.envio.ciudad = d.ciudad
  form.envio.zona = d.zona
  form.envio.direccion = d.direccion
  form.envio.referencia = d.referencia ?? ''
}
function precargarDesdeCuenta() {
  const u = auth.usuario
  if (!u) return
  form.email = u.email
  form.envio.nombreDestinatario = auth.nombreCompleto
  form.envio.telefono = (u.telefono ?? '').replace(/^\+591/, '')
  const principal = u.direcciones.find((d) => d.esPrincipal) ?? u.direcciones[0]
  if (principal) usarDireccion(principal._id)
  if (u.documento) {
    form.facturacion.tipoDocumento = u.documento.tipo
    form.facturacion.numeroDocumento = u.documento.numero
    form.facturacion.complemento = u.documento.complemento ?? ''
    form.facturacion.razonSocial = u.documento.razonSocial
  }
}
precargarDesdeCuenta() // en setup: el HTML del servidor ya sale con los datos

const ETIQUETA_PAGO: Record<MetodoPago, { titulo: string; detalle: string }> = {
  qr: { titulo: 'Pago por QR', detalle: 'Simple QR desde la app de su banco' },
  transferencia: { titulo: 'Transferencia bancaria', detalle: 'Depósito o transferencia a nuestra cuenta' },
  contra_entrega: { titulo: 'Contra entrega', detalle: 'Efectivo al recibir su pedido' },
}

// --- Totales (el servidor vuelve a calcularlos con los precios vigentes) -----------
const envio = computed(() => calcularEnvioBs(form.envio.ciudad))
const totales = computed(() => calcularTotales(subtotal.value, envio.value))
const requiereComprobante = computed(() => form.metodoPago !== 'contra_entrega')

// --- Estado de envío ------------------------------------------------------------
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const enviando = ref(false)
const problemasStock = ref<{ sku: string; nombre: string; disponible: number }[]>([])
const avisosCarrito = ref<string[]>([])

// Al abrir el checkout se contrastan precio y stock del carrito con el servidor.
watch(hidratado, async (listo) => {
  if (listo) avisosCarrito.value = await cart.sincronizar()
}, { immediate: true })

function usarNombreComoRazonSocial() {
  if (!form.facturacion.razonSocial) form.facturacion.razonSocial = form.envio.nombreDestinatario
}

watch(() => form.facturacion.tipoDocumento, (tipo) => {
  if (tipo !== 'CI') form.facturacion.complemento = ''
})
watch(() => form.metodoPago, (m) => {
  if (m === 'contra_entrega') comprobantes.value = []
})

function construirPedido() {
  return {
    items: items.value.map((i) => ({ productoId: i.productoId, sku: i.sku, cantidad: i.cantidad })),
    email: form.email,
    facturacion: { ...form.facturacion },
    envio: { ...form.envio },
    metodoPago: form.metodoPago,
    comprobantePagoUrl: requiereComprobante.value ? comprobantes.value[0] : undefined,
    notas: form.notas,
  }
}

async function enviar() {
  errorGeneral.value = ''
  problemasStock.value = []

  const resultado = pedidoSchema.safeParse(construirPedido())
  if (!resultado.success) {
    errores.value = erroresPorCampo(resultado.error)
    await nextTick()
    document.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  errores.value = {}

  enviando.value = true
  try {
    const respuesta = await $fetch<CrearPedidoRespuesta>('/api/orders', { method: 'POST', body: construirPedido() })
    vaciar()
    await navigateTo({ path: `/pedido/${respuesta.numero}`, query: { t: respuesta.token } })
  } catch (error) {
    const e = error as { statusCode?: number; data?: { message?: string; data?: { code?: string; items?: typeof problemasStock.value; errores?: Record<string, string> } } }
    const detalle = e.data?.data
    if (e.statusCode === 409 && detalle?.code === 'stock_insuficiente') {
      problemasStock.value = detalle.items ?? []
      errorGeneral.value = 'Algunos productos ya no tienen stock suficiente. Ajuste su carrito para continuar.'
    } else if (e.statusCode === 422 && detalle?.errores) {
      errores.value = detalle.errores
      errorGeneral.value = 'Revise los datos marcados en el formulario.'
    } else {
      errorGeneral.value = mensajeDeError(error)
    }
  } finally {
    enviando.value = false
  }
}

function ajustarCarrito() {
  ajustarAStock(problemasStock.value)
  problemasStock.value = []
  errorGeneral.value = ''
}
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-extrabold text-stone-900">Finalizar compra</h1>

    <div v-if="!hidratado" class="tarjeta py-14 text-center text-stone-500" role="status">Cargando su carrito…</div>

    <div v-else-if="!items.length" class="tarjeta py-14 text-center">
      <p class="text-lg font-semibold text-stone-800">Su carrito está vacío</p>
      <p class="mt-1 text-sm text-stone-500">Agregue productos para continuar con la compra.</p>
      <NuxtLink to="/productos" class="btn-primario mt-5">Ir a la tienda</NuxtLink>
    </div>

    <form v-else class="grid gap-6 lg:grid-cols-[1fr_380px]" novalidate @submit.prevent="enviar">
      <div class="space-y-6">
        <div v-if="avisosCarrito.length" class="aviso-info space-y-1" role="status">
          <p v-for="a in avisosCarrito" :key="a">{{ a }}</p>
        </div>

        <!-- Contacto -->
        <section class="tarjeta space-y-4" aria-labelledby="h-contacto">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="h-contacto" class="text-lg font-bold">1. Contacto y envío</h2>
            <p v-if="!auth.autenticado" class="text-xs text-stone-500">
              ¿Ya tiene cuenta? <NuxtLink :to="{ path: '/login', query: { redirect: '/checkout' } }" class="font-semibold text-brand-800 underline">Ingrese</NuxtLink> para usar sus datos guardados.
            </p>
            <p v-else class="text-xs text-stone-500">Comprando como <strong>{{ auth.usuario?.email }}</strong></p>
          </div>
          <div v-if="direccionesGuardadas.length > 1">
            <label for="dir-guardada" class="campo-etiqueta">Usar una dirección guardada</label>
            <select id="dir-guardada" class="campo" @change="usarDireccion(($event.target as HTMLSelectElement).value)">
              <option value="">Elegir…</option>
              <option v-for="d in direccionesGuardadas" :key="d._id" :value="d._id">{{ d.alias }} — {{ d.direccion }}, {{ d.ciudad }}</option>
            </select>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <CampoForm v-slot="{ id, describedby }" label="Nombre del destinatario" :error="errores['envio.nombreDestinatario']" requerido>
              <input :id="id" v-model="form.envio.nombreDestinatario" class="campo" autocomplete="name" :aria-describedby="describedby" @blur="usarNombreComoRazonSocial" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Celular / WhatsApp" :error="errores['envio.telefono']" requerido>
              <div class="flex">
                <span class="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 text-sm text-stone-600">+591</span>
                <input :id="id" v-model="form.envio.telefono" class="campo rounded-l-none" inputmode="numeric" autocomplete="tel-national" maxlength="12" placeholder="71234567" :aria-describedby="describedby" />
              </div>
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Correo electrónico" :error="errores['email']" requerido class="sm:col-span-2">
              <input :id="id" v-model="form.email" type="email" class="campo" autocomplete="email" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Ciudad" :error="errores['envio.ciudad']" requerido>
              <select :id="id" v-model="form.envio.ciudad" class="campo" :aria-describedby="describedby">
                <option value="" disabled>Seleccione…</option>
                <option v-for="c in CIUDADES_BOLIVIA" :key="c" :value="c">{{ c }}</option>
              </select>
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Zona / barrio" :error="errores['envio.zona']" requerido>
              <input :id="id" v-model="form.envio.zona" class="campo" autocomplete="address-level3" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Dirección (calle y número)" :error="errores['envio.direccion']" requerido class="sm:col-span-2">
              <input :id="id" v-model="form.envio.direccion" class="campo" autocomplete="street-address" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id }" label="Referencia (opcional)" :error="errores['envio.referencia']" class="sm:col-span-2">
              <input :id="id" v-model="form.envio.referencia" class="campo" placeholder="Edificio, color de puerta, cerca de…" />
            </CampoForm>
          </div>
        </section>

        <!-- Facturación -->
        <section class="tarjeta space-y-4" aria-labelledby="h-factura">
          <div>
            <h2 id="h-factura" class="text-lg font-bold">2. Datos de facturación</h2>
            <p class="mt-1 text-sm text-stone-500">Ingrese el NIT o CI y la razón social con los que desea su recibo. El desglose del IVA (13%) se detalla en el resumen.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-6">
            <CampoForm v-slot="{ id, describedby }" label="Tipo de documento" :error="errores['facturacion.tipoDocumento']" requerido class="sm:col-span-3">
              <select :id="id" v-model="form.facturacion.tipoDocumento" class="campo" :aria-describedby="describedby">
                <option v-for="t in TIPOS_DOCUMENTO" :key="t" :value="t">{{ ETIQUETA_DOCUMENTO[t] }}</option>
              </select>
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" :label="form.facturacion.tipoDocumento === 'NIT' ? 'Número de NIT' : 'Número de documento'" :error="errores['facturacion.numeroDocumento']" requerido :class="form.facturacion.tipoDocumento === 'CI' ? 'sm:col-span-2' : 'sm:col-span-3'">
              <input :id="id" v-model="form.facturacion.numeroDocumento" class="campo" inputmode="numeric" autocomplete="off" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-if="form.facturacion.tipoDocumento === 'CI'" v-slot="{ id, describedby }" label="Complemento" :error="errores['facturacion.complemento']" ayuda="Ej. 1A (si tiene)">
              <input :id="id" v-model="form.facturacion.complemento" class="campo uppercase" maxlength="2" autocomplete="off" :aria-describedby="describedby" />
            </CampoForm>
            <CampoForm v-slot="{ id, describedby }" label="Razón social / Nombre" :error="errores['facturacion.razonSocial']" requerido class="sm:col-span-6">
              <input :id="id" v-model="form.facturacion.razonSocial" class="campo" autocomplete="organization" :aria-describedby="describedby" />
            </CampoForm>
          </div>
        </section>

        <!-- Pago -->
        <section class="tarjeta space-y-4" aria-labelledby="h-pago">
          <h2 id="h-pago" class="text-lg font-bold">3. Método de pago</h2>
          <fieldset>
            <legend class="sr-only">Método de pago</legend>
            <div class="grid gap-3 sm:grid-cols-3">
              <label
                v-for="m in METODOS_PAGO" :key="m"
                class="flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition has-[:checked]:border-brand-800 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/40"
                :class="form.metodoPago === m ? 'border-brand-800' : 'border-stone-300 hover:bg-stone-50'"
              >
                <span class="flex items-center gap-2">
                  <input v-model="form.metodoPago" type="radio" name="metodoPago" :value="m" class="accent-brand-800" />
                  <span class="text-sm font-semibold">{{ ETIQUETA_PAGO[m].titulo }}</span>
                </span>
                <span class="pl-6 text-xs text-stone-500">{{ ETIQUETA_PAGO[m].detalle }}</span>
              </label>
            </div>
            <p v-if="errores['metodoPago']" class="campo-error" role="alert">{{ errores['metodoPago'] }}</p>
          </fieldset>

          <PagoInstrucciones :metodo="form.metodoPago" :total="totales.total" />

          <div v-if="requiereComprobante">
            <ImageUploader
              v-model="comprobantes"
              scope="comprobante"
              label="Comprobante de pago (opcional ahora)"
              ayuda="Foto o captura de la transferencia/pago QR. Puede adjuntarla después desde la página de su pedido."
            />
            <p v-if="errores['comprobantePagoUrl']" class="campo-error" role="alert">{{ errores['comprobantePagoUrl'] }}</p>
          </div>
        </section>

        <section class="tarjeta">
          <CampoForm v-slot="{ id }" label="Notas para el pedido (opcional)" :error="errores['notas']">
            <textarea :id="id" v-model="form.notas" rows="2" maxlength="300" class="campo" />
          </CampoForm>
        </section>
      </div>

      <!-- Resumen -->
      <aside class="lg:sticky lg:top-24 lg:self-start" aria-labelledby="h-resumen">
        <div class="tarjeta space-y-4">
          <h2 id="h-resumen" class="text-lg font-bold">Resumen del pedido</h2>

          <ul class="divide-y divide-stone-100">
            <li v-for="i in items" :key="i.sku" class="flex gap-3 py-3 first:pt-0">
              <img :src="i.imagen" :alt="i.nombre" class="h-16 w-14 shrink-0 rounded-md object-cover" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">{{ i.nombre }}</p>
                <p class="text-xs text-stone-500">{{ i.color }} · Talla {{ i.talla }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <label :for="`q-${i.sku}`" class="sr-only">Cantidad de {{ i.nombre }}</label>
                  <input :id="`q-${i.sku}`" type="number" min="1" :max="i.stock" :value="i.cantidad" class="campo !w-16 !py-1" @change="cambiarCantidad(i.sku, Number(($event.target as HTMLInputElement).value))" />
                  <button type="button" class="text-xs font-medium text-red-600 hover:underline" @click="quitar(i.sku)">Quitar</button>
                </div>
              </div>
              <p class="text-sm font-semibold">{{ formatearBs(i.precio * i.cantidad) }}</p>
            </li>
          </ul>

          <dl class="space-y-2 border-t border-stone-200 pt-4 text-sm">
            <div class="flex justify-between"><dt class="text-stone-600">Subtotal (IVA incluido)</dt><dd>{{ formatearBs(totales.subtotal) }}</dd></div>
            <div class="flex justify-between">
              <dt class="text-stone-600">Envío{{ form.envio.ciudad ? ` a ${form.envio.ciudad}` : '' }}</dt>
              <dd>{{ form.envio.ciudad ? formatearBs(totales.envio) : 'Elija su ciudad' }}</dd>
            </div>
            <div class="flex justify-between border-t border-stone-200 pt-2 text-base font-bold">
              <dt>Total a pagar</dt><dd class="text-brand-800">{{ formatearBs(totales.total) }}</dd>
            </div>
          </dl>

          <dl class="space-y-1 rounded-lg bg-stone-50 p-3 text-xs text-stone-600" aria-label="Desglose del IVA">
            <div class="flex justify-between"><dt>Importe sin IVA</dt><dd>{{ formatearBs(totales.importeSinIva) }}</dd></div>
            <div class="flex justify-between font-semibold text-stone-800"><dt>IVA ({{ Math.round(totales.ivaTasa * 100) }}% del total)</dt><dd>{{ formatearBs(totales.iva) }}</dd></div>
            <p class="pt-1 text-[11px] text-stone-500">Los precios ya incluyen IVA. El monto final lo confirma el servidor al registrar el pedido.</p>
          </dl>

          <div v-if="errorGeneral" class="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p>{{ errorGeneral }}</p>
            <ul v-if="problemasStock.length" class="list-inside list-disc text-xs">
              <li v-for="p in problemasStock" :key="p.sku">{{ p.nombre }}: {{ p.disponible > 0 ? `solo quedan ${p.disponible}` : 'agotado' }}</li>
            </ul>
            <button v-if="problemasStock.length" type="button" class="btn-secundario !py-1 text-xs" @click="ajustarCarrito">Ajustar mi carrito</button>
          </div>

          <button type="submit" class="btn-primario w-full" :disabled="enviando">
            <span v-if="enviando" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            {{ enviando ? 'Registrando pedido…' : form.metodoPago === 'contra_entrega' ? 'Confirmar pedido' : 'Confirmar y pagar' }}
          </button>
          <p class="text-center text-[11px] text-stone-500">Al confirmar, reservamos su stock. Datos fiscales usados solo para su recibo.</p>
        </div>
      </aside>
    </form>
  </div>
</template>
