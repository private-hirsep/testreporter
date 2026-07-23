<template>
  <div v-if="manifest">
    <PageHeader
      title="Evidence"
      :subtitle="`Audit package, integrity files, and ${manifest.downloads.length} static artifact links from this report`"
    />
    <SectionCard
      title="Audit integrity"
      description="Files proving what this report contains and that it was not modified"
      class="mb-4"
    >
      <ul class="linked-list">
        <li v-for="file in auditStatus" :key="file.path">
          <StatusChip
            :status="file.available === undefined ? 'unavailable' : file.available ? 'passed' : 'missing'"
            :label="file.available === undefined ? 'checking' : file.available ? 'present' : 'missing'"
            size="x-small"
          />
          <div class="linked-list-label">
            <a v-if="file.available" :href="file.path" target="_blank" rel="noopener">{{
              file.label
            }}</a>
            <span v-else>{{ file.label }}</span>
            <span class="text-medium-emphasis"> — {{ file.description }}</span>
          </div>
        </li>
      </ul>
    </SectionCard>
    <SectionCard
      v-for="group in groups"
      :key="group.category"
      :title="group.label"
      :description="group.description"
      class="mb-4"
      flush
    >
      <v-table density="compact" class="data-table list-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Size</th>
            <th scope="col" class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="download in group.items" :key="download.id">
            <td class="wrap-anywhere">
              <div>{{ download.name }}</div>
              <div class="page-kicker mono">{{ download.path }}</div>
            </td>
            <td class="mono">{{ sizeLabel(download) }}</td>
            <td class="text-right">
              <v-btn
                :href="download.path"
                target="_blank"
                rel="noopener"
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-download"
              >
                Download
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </SectionCard>
    <EmptyState
      v-if="!groups.length"
      message="No downloadable artifacts are included in this report."
    />
    <v-alert
      v-if="manifest.warnings.length"
      type="warning"
      variant="tonal"
      class="mt-4"
      title="Parser warnings available"
    >
      {{ manifest.warnings.length }} warning(s) were produced while reading artifacts.
      <v-btn to="/diagnostics" size="small" variant="text" class="ml-2">Open diagnostics</v-btn>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatBytes } from "../format";
import { auditFiles, groupEvidence, type AuditFileStatus } from "../services/evidence";
import type { Download, Manifest, TestCase } from "../types";

const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const groups = computed(() => (props.manifest ? groupEvidence(props.manifest) : []));
const auditStatus = ref<AuditFileStatus[]>(auditFiles.map((file) => ({ ...file })));

onMounted(async () => {
  await Promise.all(
    auditStatus.value.map(async (file) => {
      // Static hosts serve the SPA 404 fallback with a 200 status, so a body
      // check is the only reliable way to know the integrity file exists.
      try {
        const response = await fetch(file.path);
        const body = response.ok ? await response.text() : "";
        file.available = file.path.endsWith(".json")
          ? isJson(body)
          : /[a-f0-9]{64}/.test(body);
      } catch {
        file.available = false;
      }
    })
  );
});

function sizeLabel(download: Download) {
  if (download.sizeBytes !== undefined) return formatBytes(download.sizeBytes);
  // Size is unrecorded for directories and for the ZIP (created after the
  // manifest); only paths without a file extension are actual directories.
  return /\.[a-z0-9]+$/i.test(download.path) ? "size not recorded" : "directory";
}

function isJson(body: string) {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}
</script>
