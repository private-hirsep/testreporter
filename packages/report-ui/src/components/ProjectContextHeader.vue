<template>
  <header class="context-header" aria-label="Project and release context">
    <div class="context-header-main">
      <div class="context-identity">
        <span class="context-project">{{ context.projectName }}</span>
        <template v-for="part in context.identityParts" :key="part">
          <span class="context-separator" aria-hidden="true">|</span>
          <span>{{ part }}</span>
        </template>
      </div>
      <div v-if="context.provenanceParts.length" class="context-provenance">
        <template v-for="(part, index) in context.provenanceParts" :key="part">
          <span v-if="index > 0" class="context-separator" aria-hidden="true">·</span>
          <span :class="{ mono: part.startsWith('commit') || part.startsWith('build') }">{{
            part
          }}</span>
        </template>
      </div>
      <div v-else class="context-provenance context-muted">
        Report provenance metadata is not available.
      </div>
    </div>
    <div class="context-status">
      <StatusChip :status="context.overallStatus.key" size="default" />
      <span class="context-status-source">{{ statusSourceLabel }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import StatusChip from "./StatusChip.vue";
import { buildProjectContext } from "../services/context";
import type { Manifest } from "../types";

const props = defineProps<{ manifest?: Manifest | undefined }>();
const context = computed(() => buildProjectContext(props.manifest));
const statusSourceLabel = computed(() => {
  if (context.value.overallStatusSource === "readiness") return "Release readiness";
  if (context.value.overallStatusSource === "quality-gate") return "Quality gate";
  return "No readiness data";
});
</script>
