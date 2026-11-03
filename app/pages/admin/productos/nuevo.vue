<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Nuevo producto · Vestiq Admin', robots: 'noindex' })
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <div>
      <NuxtLink to="/admin/productos" class="text-sm text-stone-500 hover:underline">← Productos</NuxtLink>
      <h1 class="text-2xl font-extrabold text-stone-900">Nuevo producto</h1>
    </div>
    <AdminProductoForm @guardado="navigateTo('/admin/productos')" />
  </div>
</template>
