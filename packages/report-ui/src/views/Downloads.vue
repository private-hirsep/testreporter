<template>
  <div v-if="manifest">
    <h1>Downloads</h1>
    <v-table density="compact">
      <thead><tr><th>Name</th><th>Category</th><th>Size</th><th>Link</th></tr></thead>
      <tbody>
        <tr v-for="download in manifest.downloads" :key="download.id">
          <td>{{ download.name }}</td>
          <td>{{ download.category }}</td>
          <td>{{ download.sizeBytes ?? "directory" }}</td>
          <td><a :href="download.path" target="_blank" rel="noopener">download</a></td>
        </tr>
      </tbody>
    </v-table>
    <v-alert v-if="manifest.warnings.length" type="warning" variant="tonal" class="mt-4">
      {{ manifest.warnings.length }} parser warning(s). See manifest JSON for details.
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import type { Manifest, TestCase } from "../types";
defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
</script>
