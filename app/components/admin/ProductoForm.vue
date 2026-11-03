<script setup lang="ts">
import { erroresPorCampo } from '~~/shared/schemas/order'
import { productoActualizarSchema, productoCrearSchema } from '~~/shared/schemas/product'
import { TALLAS_SUGERIDAS } from '~~/shared/utils/bolivia'
import type { ProductoDTO } from '~~/shared/types'

/**
 * Alta y edición de productos. Sin `producto` = crear (POST /api/products); con `producto` =
 * editar (PUT /api/admin/products/:id con el token de concurrencia `actualizadoEn`).
 */
const props = defineProps<{ producto?: ProductoDTO | null }>()
const emit = defineEmits<{ guardado: [producto: ProductoDTO]; recargar: [] }>()

interface FilaVariante { color: string; talla: string; stock: number; sku: string }
const editando = computed(() => !!props.producto)

const form = reactive({
  nombre: '',
  descripcion: '',
  precio: '' as number | '',
  categoriaId: '',
  estadoRegistro: 'activo' as 'activo' | 'inactivo',
  imagenes: [] as string[],
  variantes: [] as FilaVariante[],
})

const filaVacia = (): FilaVariante => ({ color: '', talla: '', stock: 0, sku: '' })

function iniciar(p?: ProductoDTO | null) {
  form.nombre = p?.nombre ?? ''
  form.descripcion = p?.descripcion ?? ''
  form.precio = p?.precio ?? ''
  form.categoriaId = p?.categoriaId ?? ''
  form.estadoRegistro = p?.estadoRegistro === 'inactivo' ? 'inactivo' : 'activo'
  form.imagenes = [...(p?.imagenes ?? [])]
  form.variantes = p ? p.variantes.map((v) => ({ color: v.color, talla: v.talla, stock: v.stock, sku: v.sku })) : [filaVacia()]
}
watch(() => props.producto, iniciar, { immediate: true })

interface CategoriaAdmin { _id: string; nombre: string; estadoRegistro: string }
const { data: categorias } = await useFetch<CategoriaAdmin[]>('/api/admin/categories', { default: () => [] })
const categoriasActivas = computed(() => categorias.value.filter((c) => c.estadoRegistro === 'activo' || c._id === form.categoriaId))

const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const conflicto = ref(false)
const guardando = ref(false)

const claveCombo = (v: FilaVariante) => `${v.color.trim().toLowerCase()}|${v.talla.trim().toUpperCase()}`

function construirPayload() {
  return {
    nombre: form.nombre,
    descripcion: form.descripcion,
    precio: form.precio === '' ? Number.NaN : Number(form.precio),
    categoriaId: form.categoriaId,
    imagenes: form.imagenes,
    variantes: form.variantes.map((v) => ({
      color: v.color,
      talla: v.talla,
      stock: Number(v.stock),
      sku: v.sku.trim() || undefined,
    })),
  }
}

function validarCliente() {
  const base = construirPayload()
  const resultado = editando.value
    ? productoActualizarSchema.safeParse({ ...base, estadoRegistro: form.estadoRegistro, actualizadoEn: props.producto!.updatedAt })
    : productoCrearSchema.safeParse(base)
  const out = resultado.success ? {} : erroresPorCampo(resultado.error)

  // Color + talla no repetidos.
  const vistos = new Set<string>()
  form.variantes.forEach((v, i) => {
    const k = claveCombo(v)
    if (v.color.trim() && v.talla.trim()) {
      if (vistos.has(k)) out[`variantes.${i}.talla`] = 'Combinación color/talla repetida'
      vistos.add(k)
    }
  })
  const skus = new Set<string>()
  form.variantes.forEach((v, i) => {
    const s = v.sku.trim().toUpperCase()
    if (!s) return
    if (skus.has(s)) out[`variantes.${i}.sku`] = 'SKU repetido'
    skus.add(s)
  })
  return out
}

const quitarFila = (i: number) => form.variantes.splice(i, 1)
const agregarFila = () => {
  const ultima = form.variantes[form.variantes.length - 1]
  form.variantes.push({ ...filaVacia(), color: ultima?.color ?? '' })
}

async function guardar() {
  errorGeneral.value = ''
  conflicto.value = false
  errores.value = validarCliente()
  if (Object.keys(errores.value).length) {
    errorGeneral.value = 'Revise los campos marcados.'
    return
  }
  guardando.value = true
  try {
    const base = construirPayload()
    const res = editando.value
      ? await $fetch<ProductoDTO>(`/api/admin/products/${props.producto!._id}`, {
          method: 'PUT',
          body: { ...base, estadoRegistro: form.estadoRegistro, actualizadoEn: props.producto!.updatedAt },
        })
      : await $fetch<ProductoDTO>('/api/products', { method: 'POST', body: base })
    emit('guardado', res)
  } catch (e) {
    const data = (e as { data?: { data?: { code?: string } } })?.data?.data
    if (data?.code === 'conflicto_version') conflicto.value = true
    else {
      errores.value = erroresDeApi(e)
      errorGeneral.value = mensajeDeError(e)
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="guardar">
    <div v-if="conflicto" class="aviso-info" role="alert">
      <p>El producto cambió mientras lo editaba (por ejemplo, por una venta). Recargue los datos y vuelva a aplicar sus cambios.</p>
      <button type="button" class="btn-secundario btn-sm mt-2" @click="emit('recargar')">Recargar datos</button>
    </div>
    <p v-else-if="errorGeneral" class="aviso-error" role="alert">{{ errorGeneral }}</p>

    <section class="tarjeta space-y-4" aria-labelledby="f-datos">
      <h2 id="f-datos" class="font-semibold text-stone-900">Datos del producto</h2>
      <CampoForm v-slot="{ id, describedby }" label="Nombre" :error="errores.nombre" requerido>
        <input :id="id" v-model="form.nombre" class="campo" maxlength="150" :aria-describedby="describedby" :aria-invalid="!!errores.nombre" />
      </CampoForm>
      <CampoForm v-slot="{ id, describedby }" label="Descripción" :error="errores.descripcion">
        <textarea :id="id" v-model="form.descripcion" rows="4" class="campo" maxlength="3000" :aria-describedby="describedby" />
      </CampoForm>
      <div class="grid gap-4 sm:grid-cols-2">
        <CampoForm v-slot="{ id, describedby }" label="Precio (Bs., IVA incluido)" :error="errores.precio" ayuda="Hasta 2 decimales." requerido>
          <input :id="id" v-model.number="form.precio" type="number" step="0.01" min="0.01" inputmode="decimal" class="campo" :aria-describedby="describedby" :aria-invalid="!!errores.precio" />
        </CampoForm>
        <CampoForm v-slot="{ id, describedby }" label="Categoría" :error="errores.categoriaId" requerido>
          <select :id="id" v-model="form.categoriaId" class="campo" :aria-describedby="describedby" :aria-invalid="!!errores.categoriaId">
            <option value="" disabled>Seleccione…</option>
            <option v-for="c in categoriasActivas" :key="c._id" :value="c._id">{{ c.nombre }}</option>
          </select>
        </CampoForm>
      </div>
      <CampoForm v-if="editando" v-slot="{ id }" label="Estado">
        <select :id="id" v-model="form.estadoRegistro" class="campo sm:max-w-xs">
          <option value="activo">Activo (visible en la tienda)</option>
          <option value="inactivo">Inactivo (oculto)</option>
        </select>
      </CampoForm>
    </section>

    <section class="tarjeta" aria-labelledby="f-img">
      <h2 id="f-img" class="mb-3 font-semibold text-stone-900">Imágenes</h2>
      <ImageUploader v-model="form.imagenes" scope="producto" multiple :max="8" ayuda="La primera imagen es la principal. Hasta 8." />
      <p v-if="errores.imagenes" class="campo-error" role="alert">{{ errores.imagenes }}</p>
    </section>

    <section class="tarjeta" aria-labelledby="f-var">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="f-var" class="font-semibold text-stone-900">Variantes (color / talla / stock)</h2>
        <button type="button" class="btn-secundario btn-sm" @click="agregarFila">+ Agregar variante</button>
      </div>
      <p v-if="errores.variantes" class="campo-error mb-2" role="alert">{{ errores.variantes }}</p>
      <div class="overflow-x-auto">
        <table class="tabla min-w-[40rem]">
          <thead><tr><th>Color</th><th>Talla</th><th>Stock</th><th>SKU <span class="font-normal normal-case">(opcional)</span></th><th><span class="sr-only">Quitar</span></th></tr></thead>
          <tbody>
            <tr v-for="(v, i) in form.variantes" :key="i" class="align-top">
              <td>
                <input v-model="v.color" class="campo" maxlength="40" :aria-label="`Color de la variante ${i + 1}`" :aria-invalid="!!errores[`variantes.${i}.color`]" />
                <p v-if="errores[`variantes.${i}.color`]" class="campo-error" role="alert">{{ errores[`variantes.${i}.color`] }}</p>
              </td>
              <td>
                <input v-model="v.talla" class="campo uppercase" list="tallas-sugeridas" maxlength="10" :aria-label="`Talla de la variante ${i + 1}`" :aria-invalid="!!errores[`variantes.${i}.talla`]" />
                <p v-if="errores[`variantes.${i}.talla`]" class="campo-error" role="alert">{{ errores[`variantes.${i}.talla`] }}</p>
              </td>
              <td>
                <input v-model.number="v.stock" type="number" min="0" step="1" class="campo w-24" :aria-label="`Stock de la variante ${i + 1}`" :aria-invalid="!!errores[`variantes.${i}.stock`]" />
                <p v-if="errores[`variantes.${i}.stock`]" class="campo-error" role="alert">{{ errores[`variantes.${i}.stock`] }}</p>
              </td>
              <td>
                <input v-model="v.sku" class="campo font-mono uppercase" maxlength="40" placeholder="Autogenerado" :aria-label="`SKU de la variante ${i + 1}`" />
                <p v-if="errores[`variantes.${i}.sku`]" class="campo-error" role="alert">{{ errores[`variantes.${i}.sku`] }}</p>
              </td>
              <td class="text-right">
                <button type="button" class="btn-secundario btn-sm" :disabled="form.variantes.length <= 1" :aria-label="`Quitar variante ${i + 1}`" @click="quitarFila(i)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <datalist id="tallas-sugeridas"><option v-for="t in TALLAS_SUGERIDAS" :key="t" :value="t" /></datalist>
      <p v-if="editando" class="mt-2 text-xs text-stone-500">El stock se guarda tal como lo escriba aquí (valor absoluto).</p>
    </section>

    <div class="flex flex-wrap items-center gap-3">
      <button type="submit" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto' }}</button>
      <NuxtLink to="/admin/productos" class="btn-secundario">Cancelar</NuxtLink>
    </div>
  </form>
</template>
