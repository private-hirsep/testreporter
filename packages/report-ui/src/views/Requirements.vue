<template>
  <div v-if="manifest">
    <PageHeader title="Requirement Coverage" :subtitle="`${filteredKeys.length} of ${allKeys.length} requirements shown`">
      <v-chip :color="manifest.requirements.missing.length ? 'warning' : 'success'" label>
        {{ formatPercent(manifest.requirements.percentage) }} covered
      </v-chip>
    </PageHeader>
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Requirement coverage</div>
        <div class="summary-number">{{ formatPercent(manifest.requirements.percentage) }}</div>
      </div>
      <div class="inline-metrics">
        <div><strong>{{ manifest.requirements.expected.length }}</strong><span>Expected</span></div>
        <div><strong class="text-success">{{ manifest.requirements.covered.length }}</strong><span>Covered</span></div>
        <div><strong class="text-error">{{ manifest.requirements.missing.length }}</strong><span>Missing</span></div>
        <div><strong class="text-warning">{{ manifest.requirements.extra.length }}</strong><span>Extra</span></div>
      </div>
    </section>
    <div class="toolbar">
      <v-text-field v-model="search" label="Search requirements" density="compact" hide-details prepend-inner-icon="mdi-magnify" />
      <v-select v-model="filter" :items="['all', 'covered', 'missing', 'extra']" label="Status" density="compact" hide-details />
      <div />
    </div>
    <EmptyState v-if="!filteredKeys.length" message="No requirements match the current filters." />
    <v-table v-else density="compact" class="data-table">
      <thead><tr><th>Requirement</th><th>Status</th><th>Tests</th><th>Layers</th><th>Linked Tests</th><th /></tr></thead>
      <tbody>
        <template v-for="key in filteredKeys" :key="key">
          <tr :id="`requirement-${key}`" :class="{ 'failed-row': status(key) === 'missing' }">
            <td class="mono">{{ key }}</td>
            <td><StatusChip :status="status(key)" /></td>
            <td><strong>{{ testIdsFor(key).length }}</strong></td>
            <td>
              <v-chip v-for="layer in layersFor(key)" :key="layer" size="x-small" class="mr-1" variant="tonal" label>{{ layer }}</v-chip>
              <span v-if="!layersFor(key).length" class="text-medium-emphasis">—</span>
            </td>
            <td>
              <v-chip
                v-for="linked in linkedTestsFor(key).slice(0, 2)"
                :key="linked.id"
                size="x-small"
                class="mr-1 mono"
                label
                :to="`/tests/${linked.id}`"
              >
                {{ linked.name }}
              </v-chip>
              <span v-if="testIdsFor(key).length > 2" class="text-medium-emphasis">+{{ testIdsFor(key).length - 2 }} more</span>
              <span v-if="!testIdsFor(key).length" class="text-medium-emphasis">none</span>
            </td>
            <td class="text-right">
              <v-btn
                v-if="testIdsFor(key).length"
                size="x-small"
                variant="text"
                :icon="expanded.has(key) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                :aria-label="`Toggle linked tests for ${key}`"
                :aria-expanded="expanded.has(key)"
                @click="toggle(key)"
              />
            </td>
          </tr>
          <tr v-if="expanded.has(key)" :id="`requirement-${key}-details`" class="requirement-details-row">
            <td colspan="6">
              <v-table density="compact" class="list-table">
                <thead><tr><th>Test</th><th>Status</th><th>Layer</th><th>Duration</th></tr></thead>
                <tbody>
                  <tr v-for="linked in linkedTestsFor(key)" :key="linked.id">
                    <td><router-link :to="`/tests/${linked.id}`">{{ linked.fullName ?? linked.name }}</router-link></td>
                    <td><StatusChip :status="linked.status" /></td>
                    <td><v-chip size="x-small" variant="tonal" label>{{ linked.layer }}</v-chip></td>
                    <td class="mono">{{ formatDuration(linked.durationMs) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </td>
          </tr>
        </template>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration, formatPercent } from "../format";
import type { Manifest, TestCase } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const filter = ref("all");
const expanded = reactive(new Set<string>());
const allKeys = computed(() =>
  props.manifest ? [...new Set([...props.manifest.requirements.expected, ...props.manifest.requirements.extra])].sort() : []
);
const filteredKeys = computed(() =>
  allKeys.value
    .filter((key) => filter.value === "all" || status(key) === filter.value)
    .filter((key) => key.toLowerCase().includes(search.value.toLowerCase()))
);
const testById = computed(() => new Map(props.tests.map((test) => [test.id, test])));

function status(key: string) {
  if (props.manifest?.requirements.missing.includes(key)) return "missing";
  if (props.manifest?.requirements.extra.includes(key)) return "extra";
  return "covered";
}

function testIdsFor(key: string) {
  return props.manifest?.requirements.testsByRequirement[key] ?? [];
}

function linkedTestsFor(key: string): TestCase[] {
  return testIdsFor(key)
    .map((id) => testById.value.get(id))
    .filter((test): test is TestCase => Boolean(test));
}

function layersFor(key: string) {
  return [...new Set(linkedTestsFor(key).map((test) => test.layer))];
}

function toggle(key: string) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}
</script>
