<template>
  <div class="chart-row">
    <span class="text-capitalize">{{ label }}</span>
    <div class="progress-track"><div class="progress-fill" :class="tone" :style="{ width }" /></div>
    <strong>{{ display }}</strong>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ label: string; percent: number; display: string | number; tone?: "" | "low" | "medium" }>();
const width = computed(() => `${Math.min(Math.max(props.percent, 0), 100)}%`);
</script>
