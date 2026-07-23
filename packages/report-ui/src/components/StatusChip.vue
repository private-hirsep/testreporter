<template>
  <v-chip
    :size="size ?? 'small'"
    :color="descriptor.color"
    :prepend-icon="descriptor.icon"
    :title="descriptor.description"
    variant="tonal"
    class="status-chip"
    label
  >
    {{ label ?? descriptor.label }}
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveStatus } from "../services/status";
const props = defineProps<{
  status?: string | undefined;
  size?: string | undefined;
  label?: string | undefined;
}>();
const descriptor = computed(() => resolveStatus(props.status));
</script>
