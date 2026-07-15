<template>
  <div v-if="manifest">
    <PageHeader title="Diagnostics" subtitle="Parser warnings and report generation diagnostics">
      <v-chip :color="manifest.warnings.length ? 'warning' : 'success'" label
        >{{ manifest.warnings.length }} warning(s)</v-chip
      >
    </PageHeader>
    <section class="portal-card detail-section mb-4">
      <h2>Identity Health</h2>
      <div class="summary-strip">
        <div>
          <strong>{{ diagnostics.total }}</strong
          ><span>Total tests</span>
        </div>
        <div>
          <strong>{{ diagnostics.explicit }}</strong
          ><span>Explicit IDs</span>
        </div>
        <div>
          <strong>{{ diagnostics.titleToken }}</strong
          ><span>Title IDs</span>
        </div>
        <div>
          <strong>{{ diagnostics.mapping }}</strong
          ><span>Mapped IDs</span>
        </div>
        <div>
          <strong>{{ diagnostics.generated }}</strong
          ><span>Generated IDs</span>
        </div>
      </div>
      <p>
        Duplicate canonical IDs:
        <span class="mono">{{ diagnostics.duplicateCanonicalIds.join(", ") || "none" }}</span>
      </p>
      <p>
        Duplicate explicit IDs:
        <span class="mono">{{ diagnostics.duplicateExplicitIds.join(", ") || "none" }}</span>
      </p>
      <p>
        Malformed explicit metadata: {{ diagnostics.malformedExplicitIds }} · Ambiguous mappings:
        {{ diagnostics.ambiguousMappings }}
      </p>
    </section>
    <v-alert v-if="!manifest.warnings.length" type="success" variant="tonal">
      No parser warnings were recorded for this run.
    </v-alert>
    <v-table v-else density="compact" class="data-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Source Artifact</th>
          <th>Code</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="warning in manifest.warnings"
          :key="`${warning.code}-${warning.sourcePath}-${warning.message}`"
        >
          <td><v-chip size="small" color="warning" label>warning</v-chip></td>
          <td class="mono">{{ warning.sourcePath ?? "n/a" }}</td>
          <td class="mono">{{ warning.code }}</td>
          <td>{{ warning.message }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const diagnostics = computed(
  () =>
    props.manifest?.identityDiagnostics ?? {
      total: props.tests.length,
      explicit: 0,
      titleToken: 0,
      mapping: 0,
      generated: props.tests.length,
      duplicateCanonicalIds: [],
      duplicateExplicitIds: [],
      malformedExplicitIds: 0,
      ambiguousMappings: 0
    }
);
</script>
