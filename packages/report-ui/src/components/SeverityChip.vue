<template>
  <StatusChip :status="severity" :size="size" />
</template>

<script setup lang="ts">
import StatusChip from "./StatusChip.vue";
defineProps<{ severity: string; size?: string }>();
</script>
