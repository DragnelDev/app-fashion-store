<script setup lang="ts">
import { categoriaActualizarSchema, categoriaCrearSchema } from '~~/shared/schemas/product'
import { erroresPorCampo } from '~~/shared/schemas/order'
import type { CategoriaDTO } from '~~/shared/types'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Categorías · Vestiq Admin', robots: 'noindex' })

type CategoriaAdmin = CategoriaDTO & { productos: number }
const { data: categorias, error, refresh } = await useFetch<CategoriaAdmin[]>('/api/admin/categories', { default: () => [] })

const editandoId = ref<string | null>(null)
const form = reactive({ nombre: '', estadoRegistro: 'activo' as 'activo' | 'inactivo', imagen: [] as string[] })
const errores = ref<Record<string, string>>({})
const errorGeneral = ref('')
const mensaje = ref('')
const guardando = ref(false)

function limpiar() {
  editandoId.value = null
  form.nombre = ''
  form.estadoRegistro = 'activo'
  form.imagen = []
  errores.value = {}
  errorGeneral.value = ''
}

function editar(c: CategoriaAdmin) {
  editandoId.value = c._id
  form.nombre = c.nombre
  form.estadoRegistro = c.estadoRegistro === 'inactivo' ? 'inactivo' : 'activo'
  form.imagen = c.imagenUrl ? [c.imagenUrl] : []
  errores.value = {}
  errorGeneral.value = ''
  mensaje.value = ''
}

async function guardar() {
  errorGeneral.value = ''
  mensaje.value = ''
  const payload = { nombre: form.nombre, imagenUrl: form.imagen[0] || undefined }
  const valida = editandoId.value
    ? categoriaActualizarSchema.safeParse({ ...payload, estadoRegistro: form.estadoRegistro })
    : categoriaCrearSchema.safeParse(payload)
  if (!valida.success) {
    errores.value = erroresPorCampo(valida.error)
    return
  }
  errores.value = {}
  guardando.value = true
  try {
    if (editandoId.value) {
      await $fetch(`/api/admin/categories/${editandoId.value}`, { method: 'PUT', body: { ...payload, estadoRegistro: form.estadoRegistro } })
      mensaje.value = 'Categoría actualizada.'
    } else {
      await $fetch('/api/categories', { method: 'POST', body: payload })
      mensaje.value = 'Categoría creada.'
    }
    limpiar()
    await refresh()
  } catch (e) {
    errores.value = erroresDeApi(e)
    errorGeneral.value = mensajeDeError(e)
  } finally {
    guardando.value = false
  }
}

async function eliminar(c: CategoriaAdmin) {
  if (!confirm(`¿Eliminar la categoría «${c.nombre}»?`)) return
  errorGeneral.value = ''
  mensaje.value = ''
  try {
    await $fetch(`/api/admin/categories/${c._id}`, { method: 'DELETE' })
    if (editandoId.value === c._id) limpiar()
    mensaje.value = `«${c.nombre}» fue eliminada.`
    await refresh()
  } catch (e) {
    errorGeneral.value = mensajeDeError(e) // p. ej. 409: tiene productos
  }
}
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-extrabold text-stone-900">Categorías</h1>
    <p v-if="mensaje" class="aviso-ok" role="status">{{ mensaje }}</p>
    <p v-if="errorGeneral" class="aviso-error" role="alert">{{ errorGeneral }}</p>
    <p v-if="error" class="aviso-error" role="alert">No se pudieron cargar las categorías.</p>

    <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div class="tarjeta overflow-x-auto p-0">
        <table class="tabla">
          <thead><tr><th class="w-14"><span class="sr-only">Imagen</span></th><th>Nombre</th><th>Slug</th><th class="text-right">Productos</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            <tr v-for="c in categorias" :key="c._id">
              <td><img v-if="c.imagenUrl" :src="c.imagenUrl" alt="" class="h-10 w-10 rounded-lg object-cover" loading="lazy" /></td>
              <td class="font-medium text-stone-900">{{ c.nombre }}</td>
              <td class="font-mono text-xs text-stone-500">{{ c.slug }}</td>
              <td class="text-right">{{ c.productos }}</td>
              <td><EstadoBadge tipo="registro" :valor="c.estadoRegistro" /></td>
              <td class="whitespace-nowrap text-right">
                <button type="button" class="btn-secundario btn-sm" @click="editar(c)">Editar</button>
                <button type="button" class="btn-peligro btn-sm ml-1" @click="eliminar(c)">Eliminar</button>
              </td>
            </tr>
            <tr v-if="!categorias.length"><td colspan="6" class="py-10 text-center text-stone-500">Aún no hay categorías.</td></tr>
          </tbody>
        </table>
      </div>

      <form class="tarjeta h-fit space-y-4" novalidate @submit.prevent="guardar">
        <h2 class="font-semibold text-stone-900">{{ editandoId ? 'Editar categoría' : 'Nueva categoría' }}</h2>
        <CampoForm v-slot="{ id, describedby }" label="Nombre" :error="errores.nombre" requerido>
          <input :id="id" v-model="form.nombre" class="campo" maxlength="80" :aria-describedby="describedby" :aria-invalid="!!errores.nombre" />
        </CampoForm>
        <CampoForm v-if="editandoId" v-slot="{ id }" label="Estado">
          <select :id="id" v-model="form.estadoRegistro" class="campo">
            <option value="activo">Activa</option>
            <option value="inactivo">Inactiva</option>
          </select>
        </CampoForm>
        <ImageUploader v-model="form.imagen" scope="categoria" label="Imagen (opcional)" />
        <p v-if="errores.imagenUrl" class="campo-error" role="alert">{{ errores.imagenUrl }}</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : editandoId ? 'Guardar' : 'Crear' }}</button>
          <button v-if="editandoId" type="button" class="btn-secundario" @click="limpiar">Cancelar</button>
        </div>
      </form>
    </div>
  </div>
</template>
