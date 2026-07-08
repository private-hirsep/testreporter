<template>
  <div class="page-heading">
    <div>
      <h1>{{ title }}</h1>
      <div v-if="subtitle" class="page-kicker">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.default" class="page-heading-actions"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>
