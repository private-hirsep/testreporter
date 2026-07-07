<template>
  <v-card variant="flat" border class="metric-card" :data-tone="tone">
    <div class="metric-label">{{ label }}</div>
    <div class="metric-value">{{ value }}</div>
    <div v-if="hint" class="metric-hint">{{ hint }}</div>
    <div class="metric-accent" />
  </v-card>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; tone?: "pass" | "fail" | "warn" | "neutral" }>();
</script>
