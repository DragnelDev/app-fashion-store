<script setup lang="ts">
import type { ScopeUpload } from '~~/shared/utils/bolivia'
import type { SubidaRespuesta } from '~~/shared/types'

/**
 * Subida de imágenes con arrastrar y soltar, previsualización inmediata y estado por archivo.
 * v-model: lista de URLs ya subidas (devueltas por POST /api/upload).
 */
const props = withDefaults(
  defineProps<{
    modelValue: string[]
    scope: ScopeUpload
    multiple?: boolean
    max?: number
    /** Clave de administración (scope producto/categoria). */
    adminKey?: string
    label?: string
    ayuda?: string
  }>(),
  { multiple: false, max: 8, adminKey: '', label: '', ayuda: '' },
)
const emit = defineEmits<{ 'update:modelValue': [urls: string[]]; error: [mensaje: string] }>()

interface Archivo { id: string; src: string; url: string | null; estado: 'subiendo' | 'ok' | 'error'; mensaje?: string }

const { public: publica } = useRuntimeConfig()
const maxMb = Number(publica.uploadMaxMb)
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const entrada = ref<HTMLInputElement | null>(null)
const arrastrando = ref(false)
const mensaje = ref('')
const archivos = ref<Archivo[]>(props.modelValue.map((url) => ({ id: url, src: url, url, estado: 'ok' })))
const blobs = new Set<string>()

// Si el padre cambia el valor (p. ej. lo vacía tras guardar), se reconstruye la lista.
watch(
  () => props.modelValue,
  (valor) => {
    const actuales = archivos.value.filter((a) => a.url).map((a) => a.url)
    if (JSON.stringify(actuales) !== JSON.stringify(valor)) {
      limpiarBlobs()
      archivos.value = valor.map((url) => ({ id: url, src: url, url, estado: 'ok' as const }))
    }
  },
)

const emitir = () => emit('update:modelValue', archivos.value.flatMap((a) => (a.url ? [a.url] : [])))
const hayCupo = computed(() => props.multiple ? archivos.value.length < props.max : true)

function avisar(texto: string) {
  mensaje.value = texto
  emit('error', texto)
}

function limpiarBlobs() {
  blobs.forEach((b) => URL.revokeObjectURL(b))
  blobs.clear()
}
onBeforeUnmount(limpiarBlobs)

function validar(file: File): string | null {
  if (!TIPOS.includes(file.type)) return `«${file.name}»: use una imagen JPG, PNG, WebP o AVIF.`
  if (file.size > maxMb * 1024 * 1024) return `«${file.name}»: supera el máximo de ${maxMb} MB.`
  return null
}

async function subir(item: Archivo, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await $fetch<SubidaRespuesta>('/api/upload', {
      method: 'POST',
      query: { scope: props.scope },
      body: fd,
      headers: props.adminKey ? { 'x-admin-key': props.adminKey } : undefined,
    })
    item.url = res.url
    item.estado = 'ok'
  } catch (error) {
    item.estado = 'error'
    item.mensaje = mensajeDeError(error)
    avisar(item.mensaje)
  }
  emitir()
}

async function procesar(lista: FileList | File[] | null) {
  mensaje.value = ''
  const files = Array.from(lista ?? [])
  if (!files.length) return

  const aceptados: File[] = []
  for (const f of files) {
    const problema = validar(f)
    if (problema) avisar(problema)
    else aceptados.push(f)
  }
  if (!aceptados.length) return

  if (!props.multiple) {
    limpiarBlobs()
    archivos.value = []
    aceptados.splice(1)
  } else {
    const libres = props.max - archivos.value.length
    if (aceptados.length > libres) avisar(`Máximo ${props.max} imágenes.`)
    aceptados.splice(Math.max(libres, 0))
  }

  const nuevos = aceptados.map((file) => {
    const src = URL.createObjectURL(file)
    blobs.add(src)
    const item: Archivo = reactive({ id: `${Date.now()}-${Math.random()}`, src, url: null, estado: 'subiendo' })
    return { item, file }
  })
  archivos.value.push(...nuevos.map((n) => n.item))
  await Promise.all(nuevos.map((n) => subir(n.item, n.file)))
}

function alSoltar(e: DragEvent) {
  arrastrando.value = false
  procesar(e.dataTransfer?.files ?? null)
}
function alElegir(e: Event) {
  const input = e.target as HTMLInputElement
  procesar(input.files)
  input.value = '' // permite volver a elegir el mismo archivo
}
function quitar(id: string) {
  archivos.value = archivos.value.filter((a) => a.id !== id)
  emitir()
}
</script>

<template>
  <div>
    <p v-if="label" class="campo-etiqueta">{{ label }}</p>

    <button
      v-if="hayCupo"
      type="button"
      class="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus:outline-none focus:ring-2 focus:ring-brand-600/40"
      :class="arrastrando ? 'border-brand-600 bg-brand-50' : 'border-stone-300 bg-white hover:border-brand-400 hover:bg-stone-50'"
      @click="entrada?.click()"
      @dragenter.prevent="arrastrando = true"
      @dragover.prevent="arrastrando = true"
      @dragleave.prevent="arrastrando = false"
      @drop.prevent="alSoltar"
    >
      <svg class="h-8 w-8 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <span class="text-sm font-medium text-stone-700">
        {{ arrastrando ? 'Suelte para subir' : 'Arrastre su imagen aquí o haga clic para elegir' }}
      </span>
      <span class="text-xs text-stone-500">
        JPG, PNG, WebP o AVIF · máx. {{ maxMb }} MB{{ multiple ? ` · hasta ${max} imágenes` : '' }}
      </span>
    </button>
    <input ref="entrada" type="file" class="sr-only" accept="image/jpeg,image/png,image/webp,image/avif" :multiple="multiple" tabindex="-1" aria-hidden="true" @change="alElegir" />

    <p v-if="ayuda" class="mt-1 text-xs text-stone-500">{{ ayuda }}</p>
    <p v-if="mensaje" class="campo-error" role="alert">{{ mensaje }}</p>

    <ul v-if="archivos.length" class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
      <li v-for="(a, i) in archivos" :key="a.id" class="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
        <img :src="a.src" :alt="`Vista previa ${i + 1}`" class="h-full w-full object-cover" :class="{ 'opacity-50': a.estado !== 'ok' }" />
        <div v-if="a.estado === 'subiendo'" class="absolute inset-0 flex items-center justify-center bg-white/60" role="status">
          <span class="h-6 w-6 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" />
          <span class="sr-only">Subiendo…</span>
        </div>
        <div v-else-if="a.estado === 'error'" class="absolute inset-x-0 bottom-0 bg-red-600/90 px-1 py-0.5 text-center text-[10px] text-white">Error al subir</div>
        <span v-else-if="multiple && i === 0" class="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Principal</span>
        <button
          type="button"
          class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          :aria-label="`Quitar imagen ${i + 1}`"
          @click="quitar(a.id)"
        >×</button>
      </li>
    </ul>
  </div>
</template>
