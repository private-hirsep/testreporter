<template>
  <ol class="attention-list">
    <li v-for="(item, index) in items" :key="`${item.type}-${item.reference ?? index}`">
      <StatusChip
        :status="severityStatus(item.severity)"
        :label="item.severity"
        size="small"
        class="attention-severity"
      />
      <div class="attention-body">
        <a v-if="item.href" :href="item.href">{{ item.message }}</a>
        <span v-else>{{ item.message }}</span>
        <span v-if="item.reference" class="attention-reference mono">{{ item.reference }}</span>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import StatusChip from "./StatusChip.vue";
import type { AttentionItem } from "../services/overview";
defineProps<{ items: AttentionItem[] }>();

function severityStatus(severity: string) {
  if (severity === "blocker" || severity === "critical") return "blocker-action";
  if (severity === "warning") return "warning";
  return "informational";
}
</script>
