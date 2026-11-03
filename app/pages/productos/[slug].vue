<script setup lang="ts">
import { formatearBs } from '~~/shared/utils/money'
import type { ProductoDTO } from '~~/shared/types'

const route = useRoute()
const cart = useCartStore()

const { data: producto, error, refresh } = await useFetch<ProductoDTO>(() => `/api/products/${route.params.slug}`)
if (error.value || !producto.value) {
  throw createError({ statusCode: 404, statusMessage: 'Producto no encontrado', fatal: true })
}
useSeoMeta({ title: () => `${producto.value?.nombre} · Vestiq`, description: () => producto.value?.descripcion?.slice(0, 150) })

const colores = computed(() => [...new Set(producto.value!.variantes.map((v) => v.color))])
const color = ref(colores.value.find((c) => producto.value!.variantes.some((v) => v.color === c && v.stock > 0)) ?? colores.value[0] ?? '')
const variantesDelColor = computed(() => producto.value!.variantes.filter((v) => v.color === color.value))
const talla = ref('')
const cantidad = ref(1)
const imagenActiva = ref(0)
const agregado = ref(false)
const aviso = ref('')
const agregando = ref(false)

// Stock en tiempo real: se vuelve a consultar cada 20 s mientras la pestaña está visible y al volver a ella.
let temporizador: ReturnType<typeof setInterval> | undefined
const refrescarSiVisible = () => { if (document.visibilityState === 'visible') refresh() }
onMounted(() => {
  temporizador = setInterval(refrescarSiVisible, 20_000)
  document.addEventListener('visibilitychange', refrescarSiVisible)
})
onBeforeUnmount(() => {
  clearInterval(temporizador)
  document.removeEventListener('visibilitychange', refrescarSiVisible)
})
// Si la variante elegida se agotó mientras miraba la página, se deselecciona.
watch(variantesDelColor, () => {
  const v = variantesDelColor.value.find((x) => x.talla === talla.value)
  if (talla.value && (!v || v.stock <= 0)) {
    talla.value = ''
    aviso.value = 'La talla que había elegido se agotó.'
  }
})

// Al cambiar de color se limpia la talla si ya no tiene stock.
watch(color, () => {
  const v = variantesDelColor.value.find((x) => x.talla === talla.value)
  if (!v || v.stock <= 0) talla.value = ''
  cantidad.value = 1
})

const variante = computed(() => variantesDelColor.value.find((v) => v.talla === talla.value) ?? null)
const enCarrito = computed(() => cart.enCarrito(variante.value?.sku ?? ''))
const maxCantidad = computed(() => Math.max(0, Math.min((variante.value?.stock ?? 0) - enCarrito.value, 50)))

async function agregarAlCarrito() {
  const v = variante.value
  const p = producto.value
  if (!v || !p || maxCantidad.value < 1) return
  agregando.value = true
  aviso.value = ''
  agregado.value = false
  try {
    // Confirmación de stock con el servidor justo antes de agregar (la página pudo quedar desactualizada).
    await refresh()
    const actual = producto.value?.variantes.find((x) => x.sku === v.sku)
    const disponible = actual?.stock ?? 0
    const yaEnCarrito = cart.enCarrito(v.sku)
    if (disponible - yaEnCarrito < cantidad.value) {
      aviso.value = disponible <= 0 ? 'Lo sentimos, esta variante se agotó.' : `Solo quedan ${disponible} unidad(es) y ${yaEnCarrito} ya están en su carrito.`
      cantidad.value = 1
      return
    }
    cart.agregar(
      { productoId: p._id, slug: p.slug, nombre: p.nombre, imagen: p.imagenes[0] ?? '', sku: v.sku, color: v.color, talla: v.talla, precio: p.precio, stock: disponible },
      cantidad.value,
    )
    agregado.value = true
    cantidad.value = 1
  } finally {
    agregando.value = false
  }
}
</script>

<template>
  <div v-if="producto" class="grid gap-8 md:grid-cols-2">
    <section aria-label="Imágenes" class="space-y-3">
      <div class="aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
        <img :src="producto.imagenes[imagenActiva]" :alt="producto.nombre" class="h-full w-full object-cover" />
      </div>
      <ul v-if="producto.imagenes.length > 1" class="flex gap-2">
        <li v-for="(img, i) in producto.imagenes" :key="img">
          <button type="button" class="h-16 w-16 overflow-hidden rounded-lg border-2" :class="i === imagenActiva ? 'border-brand-700' : 'border-transparent'" :aria-label="`Ver imagen ${i + 1}`" @click="imagenActiva = i">
            <img :src="img" alt="" class="h-full w-full object-cover" />
          </button>
        </li>
      </ul>
    </section>

    <section class="space-y-5">
      <div>
        <p v-if="producto.categoria" class="text-xs font-medium uppercase tracking-wide text-stone-500">
          <NuxtLink :to="{ path: '/productos', query: { categoria: producto.categoria.slug } }" class="hover:underline">{{ producto.categoria.nombre }}</NuxtLink>
        </p>
        <h1 class="text-3xl font-extrabold text-stone-900">{{ producto.nombre }}</h1>
        <p class="mt-2 text-3xl font-bold text-brand-800">{{ formatearBs(producto.precio) }}</p>
        <p class="text-xs text-stone-500">IVA incluido</p>
      </div>

      <p v-if="producto.descripcion" class="whitespace-pre-line text-stone-600">{{ producto.descripcion }}</p>

      <fieldset>
        <legend class="campo-etiqueta">Color: <span class="normal-case text-stone-800">{{ color }}</span></legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="c in colores" :key="c" type="button" class="rounded-lg border px-3 py-1.5 text-sm font-medium" :class="color === c ? 'border-brand-800 bg-brand-50 text-brand-900' : 'border-stone-300 bg-white hover:bg-stone-100'" :aria-pressed="color === c" @click="color = c">{{ c }}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="campo-etiqueta">Talla</legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="v in variantesDelColor" :key="v.sku" type="button" :disabled="v.stock <= 0"
            class="min-w-12 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:text-stone-300 disabled:line-through"
            :class="talla === v.talla ? 'border-brand-800 bg-brand-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-100'"
            :aria-pressed="talla === v.talla" @click="talla = v.talla; agregado = false"
          >{{ v.talla }}</button>
        </div>
        <p v-if="variante && variante.stock <= 5 && variante.stock > 0" class="mt-2 text-xs font-medium text-amber-700">¡Últimas {{ variante.stock }} unidades!</p>
      </fieldset>

      <div class="flex items-end gap-3">
        <div>
          <label for="cant" class="campo-etiqueta">Cantidad</label>
          <input id="cant" v-model.number="cantidad" type="number" min="1" :max="Math.max(maxCantidad, 1)" class="campo w-24" :disabled="!variante || maxCantidad < 1" />
        </div>
        <button type="button" class="btn-primario flex-1" :disabled="agregando || !variante || maxCantidad < 1 || cantidad < 1 || cantidad > maxCantidad" @click="agregarAlCarrito">
          {{ !variante ? 'Elija una talla' : maxCantidad < 1 ? 'Máximo en su carrito' : agregando ? 'Verificando stock…' : 'Agregar al carrito' }}
        </button>
      </div>

      <p v-if="aviso" class="aviso-info" role="alert">{{ aviso }}</p>

      <div v-if="agregado" class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
        <span>Agregado al carrito.</span>
        <NuxtLink to="/carrito" class="font-semibold underline">Ver carrito</NuxtLink>
      </div>
    </section>
  </div>
</template>
