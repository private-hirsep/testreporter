<template>
  <div v-if="manifest">
    <div class="page-heading">
      <div>
        <h1>Downloads</h1>
        <div class="page-kicker">{{ manifest.downloads.length }} static artifact links in this report</div>
      </div>
    </div>
    <div class="download-grid">
      <v-card v-for="group in grouped" :key="group.category" class="portal-card" variant="flat">
        <v-card-title class="text-capitalize">{{ labelFor(group.category) }}</v-card-title>
        <v-table density="compact">
          <thead><tr><th>Name</th><th>Size</th><th>Action</th></tr></thead>
          <tbody>
            <tr v-for="download in group.items" :key="download.id">
              <td>
                <div>{{ download.name }}</div>
                <div class="page-kicker mono">{{ download.path }}</div>
              </td>
              <td class="mono">{{ formatBytes(download.sizeBytes) }}</td>
              <td>
                <v-btn :href="download.path" target="_blank" rel="noopener" size="small" variant="flat" color="primary" prepend-icon="mdi-download">
                  Download
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>
    <v-alert v-if="manifest.warnings.length" type="warning" variant="tonal" class="mt-4" title="Parser warnings available">
      {{ manifest.warnings.length }} warning(s) were produced while reading artifacts.
      <v-btn to="/diagnostics" size="small" variant="text" class="ml-2">Open diagnostics</v-btn>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
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
