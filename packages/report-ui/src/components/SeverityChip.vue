<template>
  <v-chip :size="size ?? 'small'" :color="severityColor(severity)" label>{{ severity }}</v-chip>
</template>

<script setup lang="ts">
import { severityColor } from "../format";
defineProps<{ severity: string; size?: string }>();
</script>
