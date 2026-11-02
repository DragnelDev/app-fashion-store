<script setup lang="ts">
import { productoCrearSchema } from '~~/shared/schemas/product'
import { erroresPorCampo } from '~~/shared/schemas/order'
import { TALLAS_SUGERIDAS } from '~~/shared/utils/bolivia'
import type { CategoriaDTO, ProductoDTO } from '~~/shared/types'

useSeoMeta({ title: 'Administración · Vestiq', robots: 'noindex' })

const clave = useAdminKey()

const { data: categorias, refresh: refrescarCategorias } = await useFetch<CategoriaDTO[]>('/api/categories', { default: () => [] })
const { data: catalogo, refresh: refrescarCatalogo } = await useFetch<{ items: ProductoDTO[]; total: number }>('/api/products', { query: { limit: 6 } })

const cabecera = computed(() => ({ 'x-admin-key': clave.value }))

// --- Nueva categoría --------------------------------------------------------------
const cat = reactive({ nombre: '', imagen: [] as string[] })
const catMsg = ref('')
const catError = ref('')
async function crearCategoria() {
  catMsg.value = ''
  catError.value = ''
  try {
    await $fetch('/api/categories', { method: 'POST', headers: cabecera.value, body: { nombre: cat.nombre, imagenUrl: cat.imagen[0] } })
    catMsg.value = `Categoría «${cat.nombre}» creada.`
    cat.nombre = ''
    cat.imagen = []
    await refrescarCategorias()
  } catch (e) {
    catError.value = mensajeDeError(e)
  }
}

// --- Nuevo producto ---------------------------------------------------------------
interface VarianteForm { color: string; talla: string; stock: number; sku: string }
const nuevaVariante = (): VarianteForm => ({ color: '', talla: '', stock: 0, sku: '' })
const prod = reactive({ nombre: '', descripcion: '', precio: null as number | null, categoriaId: '', imagenes: [] as string[], variantes: [nuevaVariante()] })
const errores = ref<Record<string, string>>({})
const prodMsg = ref('')
const prodError = ref('')
const guardando = ref(false)

function cuerpoProducto() {
  return {
    nombre: prod.nombre,
    descripcion: prod.descripcion,
    precio: prod.precio ?? 0,
    categoriaId: prod.categoriaId,
    imagenes: prod.imagenes,
    variantes: prod.variantes.map((v) => ({ color: v.color, talla: v.talla, stock: Number(v.stock), sku: v.sku || undefined })),
  }
}

async function crearProducto() {
  prodMsg.value = ''
  prodError.value = ''
  const r = productoCrearSchema.safeParse(cuerpoProducto())
  if (!r.success) {
    errores.value = erroresPorCampo(r.error)
    return
  }
  errores.value = {}
  guardando.value = true
  try {
    const creado = await $fetch<ProductoDTO>('/api/products', { method: 'POST', headers: cabecera.value, body: cuerpoProducto() })
    prodMsg.value = `Producto «${creado.nombre}» creado.`
    Object.assign(prod, { nombre: '', descripcion: '', precio: null, imagenes: [], variantes: [nuevaVariante()] })
    await refrescarCatalogo()
  } catch (e) {
    prodError.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <header>
      <h1 class="text-2xl font-extrabold">Administración del catálogo</h1>
      <p class="text-sm text-stone-500">Protegido con la clave de administración (NUXT_ADMIN_API_KEY) hasta implementar el inicio de sesión.</p>
    </header>

    <section class="tarjeta">
      <CampoForm v-slot="{ id }" label="Clave de administración">
        <input :id="id" v-model="clave" type="password" class="campo" autocomplete="off" placeholder="Pegue aquí la clave" />
      </CampoForm>
    </section>

    <section class="tarjeta space-y-4" aria-labelledby="h-cat">
      <h2 id="h-cat" class="text-lg font-bold">Nueva categoría</h2>
      <CampoForm v-slot="{ id }" label="Nombre" requerido>
        <input :id="id" v-model="cat.nombre" class="campo" maxlength="80" />
      </CampoForm>
      <ImageUploader v-model="cat.imagen" scope="categoria" :admin-key="clave" label="Imagen de la categoría (opcional)" />
      <p v-if="catError" class="campo-error" role="alert">{{ catError }}</p>
      <p v-if="catMsg" class="text-sm text-emerald-700" role="status">{{ catMsg }}</p>
      <button type="button" class="btn-primario" :disabled="!clave || !cat.nombre.trim()" @click="crearCategoria">Crear categoría</button>
      <p v-if="categorias?.length" class="text-xs text-stone-500">Existentes: {{ categorias.map((c) => c.nombre).join(', ') }}</p>
    </section>

    <section class="tarjeta space-y-5" aria-labelledby="h-prod">
      <h2 id="h-prod" class="text-lg font-bold">Nuevo producto</h2>

      <div class="grid gap-4 sm:grid-cols-2">
        <CampoForm v-slot="{ id, describedby }" label="Nombre" :error="errores['nombre']" requerido class="sm:col-span-2">
          <input :id="id" v-model="prod.nombre" class="campo" maxlength="150" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Precio (Bs., IVA incluido)" :error="errores['precio']" requerido>
          <input :id="id" v-model.number="prod.precio" type="number" min="0" step="0.01" class="campo" :aria-describedby="describedby" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Categoría" :error="errores['categoriaId']" requerido>
          <select :id="id" v-model="prod.categoriaId" class="campo" :aria-describedby="describedby">
            <option value="" disabled>Seleccione…</option>
            <option v-for="c in categorias" :key="c._id" :value="c._id">{{ c.nombre }}</option>
          </select>
        </CampoForm>
        <CampoForm v-slot="{ id }" label="Descripción" class="sm:col-span-2">
          <textarea :id="id" v-model="prod.descripcion" rows="3" class="campo" maxlength="3000" />
        </CampoForm>
      </div>

      <div>
        <ImageUploader v-model="prod.imagenes" scope="producto" multiple :max="8" :admin-key="clave" label="Imágenes (la primera es la principal)" />
        <p v-if="errores['imagenes']" class="campo-error" role="alert">{{ errores['imagenes'] }}</p>
      </div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">Variantes</h3>
          <button type="button" class="btn-secundario !py-1" @click="prod.variantes.push(nuevaVariante())">+ Agregar variante</button>
        </div>
        <datalist id="tallas"><option v-for="t in TALLAS_SUGERIDAS" :key="t" :value="t" /></datalist>
        <div v-for="(v, i) in prod.variantes" :key="i" class="grid grid-cols-2 items-start gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-[1fr_6rem_6rem_1fr_auto]">
          <CampoForm v-slot="{ id, describedby }" label="Color" :error="errores[`variantes.${i}.color`]">
            <input :id="id" v-model="v.color" class="campo" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" label="Talla" :error="errores[`variantes.${i}.talla`]">
            <input :id="id" v-model="v.talla" list="tallas" class="campo" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id, describedby }" label="Stock" :error="errores[`variantes.${i}.stock`]">
            <input :id="id" v-model.number="v.stock" type="number" min="0" step="1" class="campo" :aria-describedby="describedby" />
          </CampoForm>
          <CampoForm v-slot="{ id }" label="SKU (opcional)" ayuda="Si lo deja vacío se genera.">
            <input :id="id" v-model="v.sku" class="campo uppercase" maxlength="40" />
          </CampoForm>
          <button type="button" class="mt-5 text-sm font-medium text-red-600 hover:underline disabled:opacity-40" :disabled="prod.variantes.length === 1" @click="prod.variantes.splice(i, 1)">Quitar</button>
        </div>
        <p v-if="errores['variantes']" class="campo-error" role="alert">{{ errores['variantes'] }}</p>
      </div>

      <p v-if="prodError" class="campo-error" role="alert">{{ prodError }}</p>
      <p v-if="prodMsg" class="text-sm text-emerald-700" role="status">{{ prodMsg }}</p>
      <button type="button" class="btn-primario" :disabled="!clave || guardando" @click="crearProducto">{{ guardando ? 'Guardando…' : 'Crear producto' }}</button>
    </section>

    <section v-if="catalogo?.items.length" class="tarjeta">
      <h2 class="mb-3 text-lg font-bold">Últimos productos ({{ catalogo.total }} en total)</h2>
      <ul class="divide-y divide-stone-100 text-sm">
        <li v-for="p in catalogo.items" :key="p._id" class="flex items-center gap-3 py-2">
          <img :src="p.imagenes[0]" :alt="p.nombre" class="h-10 w-10 rounded object-cover" />
          <NuxtLink :to="`/productos/${p.slug}`" class="flex-1 font-medium hover:underline">{{ p.nombre }}</NuxtLink>
          <span class="text-stone-500">Stock {{ p.stockTotal }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
