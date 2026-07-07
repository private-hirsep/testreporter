<template>
  <v-card variant="flat" border class="metric-card">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}</div>
    <div v-if="hint" class="metric-hint">{{ hint }}</div>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string }>();
</script>
