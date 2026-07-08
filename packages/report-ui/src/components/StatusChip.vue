<template>
  <v-chip :size="size ?? 'small'" :color="statusColor(status)" label>{{ status }}</v-chip>
</template>

<script setup lang="ts">
import { statusColor } from "../format";
defineProps<{ status: string; size?: string }>();
</script>
