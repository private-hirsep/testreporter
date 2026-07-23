<template>
  <div v-if="manifest">
    <PageHeader
      title="Diagnostics"
      subtitle="Configuration health, identity quality, and parser warnings for this report"
    >
      <StatusChip
        :status="manifest.warnings.length ? 'warning' : 'passed'"
        :label="`${manifest.warnings.length} warning(s)`"
      />
    </PageHeader>
    <SectionCard
      title="Identity health"
      description="How reliably tests map to canonical, Git-stable identities"
      class="mb-4"
    >
      <div class="metric-card-items">
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
          <strong :class="diagnostics.generated ? 'text-warning' : ''">{{
            diagnostics.generated
          }}</strong
          ><span>Generated IDs</span>
        </div>
      </div>
      <ul v-if="issues.length" class="linked-list mt-2">
        <li v-for="issue in issues" :key="issue.label">
          <StatusChip :status="issue.severity" size="x-small" />
          <span class="linked-list-label">{{ issue.label }}: <span class="mono">{{ issue.value }}</span></span>
        </li>
      </ul>
      <EmptyState
        v-else
        variant="positive"
        message="No identity conflicts or malformed identity metadata were detected."
      />
    </SectionCard>
    <EmptyState
      v-if="!manifest.warnings.length"
      variant="positive"
      title="No parser warnings"
      message="No parser warnings were recorded for this run."
    />
    <SectionCard
      v-for="category in categories"
      :key="category.id"
      :title="`${category.label} (${category.warnings.length})`"
      :description="category.description"
      class="mb-4"
      flush
    >
      <v-table density="compact" class="data-table">
        <thead>
          <tr>
            <th scope="col">Severity</th>
            <th scope="col">Source Artifact</th>
            <th scope="col">Code</th>
            <th scope="col">Message</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="warning in category.warnings"
            :key="`${warning.code}-${warning.sourcePath}-${warning.message}`"
          >
            <td><StatusChip status="warning" size="x-small" /></td>
            <td class="mono wrap-anywhere">{{ warning.sourcePath ?? "n/a" }}</td>
            <td class="mono">{{ warning.code }}</td>
            <td>{{ warning.message }}</td>
          </tr>
        </tbody>
      </v-table>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import StatusChip from "../components/StatusChip.vue";
import { groupWarnings, identityIssues } from "../services/diagnostics";
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
const issues = computed(() => (props.manifest ? identityIssues(props.manifest) : []));
const categories = computed(() => groupWarnings(props.manifest?.warnings ?? []));
</script>
