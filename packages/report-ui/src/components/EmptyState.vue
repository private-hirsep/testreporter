<template>
  <div class="empty-state" :data-variant="variant ?? 'empty'">
    <v-icon :icon="displayIcon" size="28" class="empty-state-icon" aria-hidden="true" />
    <div class="empty-state-text">
      <strong v-if="title">{{ title }}</strong>
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{
  message?: string;
  title?: string;
  icon?: string;
  variant?: "empty" | "positive" | "warning" | "unavailable";
}>();
const displayIcon = computed(() => {
  if (props.icon) return props.icon;
  if (props.variant === "positive") return "mdi-check-circle-outline";
  if (props.variant === "warning") return "mdi-alert-outline";
  if (props.variant === "unavailable") return "mdi-database-off-outline";
  return "mdi-tray-remove";
});
</script>
