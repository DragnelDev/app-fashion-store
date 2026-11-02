<script setup lang="ts">
/** Etiqueta + control + mensaje de error accesibles. Uso: <CampoForm v-slot="{ id, describedby }"> … */
defineProps<{ label: string; error?: string; ayuda?: string; requerido?: boolean }>()
const id = useId()
</script>

<template>
  <div>
    <label :for="id" class="campo-etiqueta">{{ label }}<span v-if="requerido" class="text-brand-700"> *</span></label>
    <slot :id="id" :describedby="error ? `${id}-error` : undefined" />
    <p v-if="ayuda && !error" class="mt-1 text-xs text-stone-500">{{ ayuda }}</p>
    <p v-if="error" :id="`${id}-error`" class="campo-error" role="alert">{{ error }}</p>
  </div>
</template>
