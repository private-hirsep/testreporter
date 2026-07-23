<template>
  <div v-if="manifest">
    <PageHeader
      title="Requirements"
      :subtitle="`Traceability from requirements to automated and manual evidence · ${filteredKeys.length} of ${allKeys.length} shown`"
    >
      <StatusChip
        :status="manifest.requirements.missing.length ? 'warning' : 'covered'"
        :label="`${formatPercent(manifest.requirements.percentage)} covered`"
      />
    </PageHeader>
    <section class="summary-strip">
      <div>
        <div class="page-kicker">Requirement coverage</div>
        <div class="summary-number">{{ formatPercent(manifest.requirements.percentage) }}</div>
      </div>
      <div class="inline-metrics">
        <div>
          <strong>{{ manifest.requirements.expected.length }}</strong
          ><span>Expected</span>
        </div>
        <div>
          <strong class="text-success">{{ manifest.requirements.covered.length }}</strong
          ><span>Covered</span>
        </div>
        <div>
          <strong class="text-error">{{ manifest.requirements.missing.length }}</strong
          ><span>Missing</span>
        </div>
        <div>
          <strong class="text-warning">{{ manifest.requirements.extra.length }}</strong
          ><span>Extra</span>
        </div>
      </div>
    </section>
    <div class="toolbar">
      <v-text-field
        v-model="search"
        label="Search requirements"
        density="compact"
        hide-details
        prepend-inner-icon="mdi-magnify"
      />
      <v-select
        v-model="filter"
        :items="['all', 'covered', 'missing', 'extra']"
        label="Status"
        density="compact"
        hide-details
      />
      <div />
    </div>
    <EmptyState v-if="!filteredKeys.length" message="No requirements match the current filters." />
    <v-table v-else density="compact" class="data-table">
      <thead>
        <tr>
          <th scope="col">Requirement</th>
          <th scope="col">Status</th>
          <th scope="col">Evidence</th>
          <th scope="col">Tests</th>
          <th scope="col">Layers</th>
          <th scope="col">Linked Tests</th>
          <th scope="col"><span class="visually-hidden">Details</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="key in filteredKeys" :key="key">
          <tr
            :id="`requirement-${key}`"
            tabindex="-1"
            class="requirement-row"
            :class="{ 'failed-row': status(key) === 'missing' }"
          >
            <td class="mono">{{ key }}</td>
            <td><StatusChip :status="status(key)" /></td>
            <td>
              <template v-if="evidenceFor(key)">
                <v-chip
                  v-for="kind in evidenceChips(key)"
                  :key="kind"
                  size="x-small"
                  variant="outlined"
                  class="mr-1"
                  label
                  >{{ kind }}</v-chip
                >
                <StatusChip
                  v-if="manualResultFor(key)"
                  :status="manualResultFor(key)"
                  size="x-small"
                  :label="`manual ${manualResultFor(key)}`"
                />
              </template>
              <span v-else class="text-medium-emphasis">—</span>
            </td>
            <td>
              <strong>{{ testIdsFor(key).length }}</strong>
            </td>
            <td>
              <v-chip
                v-for="layer in layersFor(key)"
                :key="layer"
                size="x-small"
                class="mr-1"
                variant="tonal"
                label
                >{{ layer }}</v-chip
              >
              <span v-if="!layersFor(key).length" class="text-medium-emphasis">—</span>
            </td>
            <td>
              <v-chip
                v-for="linked in linkedTestsFor(key).slice(0, 2)"
                :key="linked.canonicalId"
                size="x-small"
                class="mr-1 mono"
                label
                :to="testCaseRoute(linked.canonicalId)"
              >
                {{ linked.title }}
              </v-chip>
              <span v-if="testIdsFor(key).length > 2" class="text-medium-emphasis"
                >+{{ testIdsFor(key).length - 2 }} more</span
              >
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
          <tr
            v-if="expanded.has(key)"
            :id="`requirement-${key}-details`"
            class="requirement-details-row"
          >
            <td colspan="7">
              <v-table density="compact" class="list-table">
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">Status</th>
                    <th scope="col">Layer</th>
                    <th scope="col">Defects</th>
                    <th scope="col">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="linked in linkedTestsFor(key)" :key="linked.canonicalId">
                    <td>
                      <router-link :to="testCaseRoute(linked.canonicalId)">{{
                        linked.title
                      }}</router-link>
                    </td>
                    <td><StatusChip :status="linked.latestResult?.status ?? 'not-run'" /></td>
                    <td>
                      <v-chip v-for="layer in layersForCase(linked)" :key="layer" size="x-small" variant="tonal" label>{{ layer }}</v-chip>
                    </td>
                    <td>
                      <v-chip
                        v-for="defect in linked.defects"
                        :key="defect"
                        size="x-small"
                        class="mr-1 mono"
                        variant="outlined"
                        label
                        >{{ defect }}</v-chip
                      >
                      <span v-if="!linked.defects?.length" class="text-medium-emphasis">—</span>
                    </td>
                    <td class="mono">{{ formatDuration(linked.duration?.latestMs) }}</td>
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
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import EmptyState from "../components/EmptyState.vue";
import PageHeader from "../components/PageHeader.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatDuration, formatPercent } from "../format";
import { catalogueFor } from "../services/catalogue";
import { testCaseRoute } from "../services/routes";
import type { Manifest, TestCase, TestCaseCatalogueEntry } from "../types";
const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();
const search = ref("");
const filter = ref("all");
const expanded = reactive(new Set<string>());
const catalogue = computed(() => catalogueFor(props.manifest, props.tests));
const allKeys = computed(() =>
  props.manifest
    ? [
        ...new Set([
          ...props.manifest.requirements.expected,
          ...props.manifest.requirements.extra,
          ...catalogue.value.flatMap((item) => item.requirements)
        ])
      ].sort()
    : []
);
const filteredKeys = computed(() =>
  allKeys.value
    .filter((key) => filter.value === "all" || status(key) === filter.value)
    .filter((key) => key.toLowerCase().includes(search.value.toLowerCase()))
);
const casesByRequirement = computed(() => {
  const index = new Map<string, TestCaseCatalogueEntry[]>();
  for (const item of catalogue.value)
    for (const requirement of item.requirements) {
      const group = index.get(requirement);
      if (group) group.push(item);
      else index.set(requirement, [item]);
    }
  return index;
});

function status(key: string) {
  if (props.manifest?.requirements.missing.includes(key)) return "missing";
  if (props.manifest?.requirements.extra.includes(key)) return "extra";
  return "covered";
}

function testIdsFor(key: string) {
  return linkedTestsFor(key).map((item) => item.canonicalId);
}

function linkedTestsFor(key: string): TestCaseCatalogueEntry[] {
  return casesByRequirement.value.get(key) ?? [];
}

function layersFor(key: string) {
  return [...new Set(linkedTestsFor(key).flatMap(layersForCase))].sort();
}

function layersForCase(item: TestCaseCatalogueEntry) {
  return [
    ...new Set(
      item.implementations
        .map((implementation) => implementation.layer)
        .filter((layer): layer is string => Boolean(layer))
    )
  ].sort();
}

function evidenceFor(key: string) {
  return props.manifest?.requirements.evidenceTypeByRequirement?.[key];
}

function evidenceChips(key: string): string[] {
  const evidence = evidenceFor(key);
  if (!evidence) return [];
  if (evidence === "both") return ["automated", "manual"];
  if (evidence === "manual-defined") return ["manual defined"];
  if (evidence === "manual-executed") return ["manual executed"];
  return ["automated"];
}

function manualResultFor(key: string) {
  return props.manifest?.requirements.latestManualResultByRequirement?.[key];
}

function toggle(key: string) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

// Deep links like /requirements#requirement-KEY arrive before the manifest
// has loaded, so the router cannot scroll to the row; do it here once the
// data (and therefore the row) exists, clearing filters that would hide it.
const route = useRoute();
watch(
  [() => route.hash, allKeys],
  async ([hash]) => {
    if (!hash?.startsWith("#requirement-")) return;
    const key = decodeURIComponent(hash.slice("#requirement-".length));
    if (!allKeys.value.includes(key)) return;
    if (!filteredKeys.value.includes(key)) {
      filter.value = "all";
      search.value = "";
    }
    await nextTick();
    const row = document.getElementById(`requirement-${key}`);
    row?.scrollIntoView({ block: "center" });
    row?.focus({ preventScroll: true });
  },
  { immediate: true }
);
</script>
