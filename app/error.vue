<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const titulo = computed(() => {
  if (props.error.statusCode === 404) return 'Página no encontrada'
  if (props.error.statusCode === 403) return 'Acceso restringido'
  return 'Algo salió mal'
})
const volver = () => clearError({ redirect: '/' })
</script>

<template>
  <NuxtLayout>
    <div class="tarjeta mx-auto max-w-lg py-14 text-center">
      <p class="text-5xl font-extrabold text-brand-800">{{ error.statusCode }}</p>
      <h1 class="mt-2 text-xl font-bold text-stone-900">{{ titulo }}</h1>
      <p class="mt-1 text-sm text-stone-500">{{ error.statusCode === 404 ? 'El enlace puede estar incompleto o la página ya no existe.' : error.statusMessage }}</p>
      <button type="button" class="btn-primario mt-6" @click="volver">Volver al inicio</button>
    </div>
  </NuxtLayout>
</template>
