<template>
  <div v-if="manifest">
    <PageHeader title="Downloads" :subtitle="`${manifest.downloads.length} static artifact links in this report`" />
    <v-table density="compact" class="data-table list-table">
      <thead><tr><th>Category</th><th>Name</th><th>Size</th><th class="text-right">Action</th></tr></thead>
      <tbody>
        <template v-for="group in grouped" :key="group.category">
          <tr v-for="download in group.items" :key="download.id">
            <td><v-chip size="small" variant="tonal" label>{{ labelFor(group.category) }}</v-chip></td>
            <td class="wrap-anywhere">
              <div>{{ download.name }}</div>
              <div class="page-kicker mono">{{ download.path }}</div>
            </td>
            <td class="mono">{{ formatBytes(download.sizeBytes) }}</td>
            <td class="text-right">
              <v-btn :href="download.path" target="_blank" rel="noopener" size="small" variant="flat" color="primary" prepend-icon="mdi-download">
                Download
              </v-btn>
            </td>
          </tr>
        </template>
      </tbody>
    </v-table>
    <v-alert v-if="manifest.warnings.length" type="warning" variant="tonal" class="mt-4" title="Parser warnings available">
      {{ manifest.warnings.length }} warning(s) were produced while reading artifacts.
      <v-btn to="/diagnostics" size="small" variant="text" class="ml-2">Open diagnostics</v-btn>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import { formatBytes } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const order = ["report", "tests", "coverage", "requirements", "security", "raw"];
const grouped = computed(() =>
  order
    .map((category) => ({
      category,
      items: props.manifest?.downloads.filter((download) => download.category === category) ?? []
    }))
    .filter((group) => group.items.length)
);

function labelFor(category: string) {
  if (category === "report") return "Full report";
  if (category === "raw") return "Raw artifacts";
  return category;
}
</script>
