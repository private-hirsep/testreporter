<template>
  <div v-if="manifest">
    <PageHeader
      title="Overview"
      subtitle="Release readiness, current failures, and required QA actions for this report"
    />

    <SectionCard
      v-if="attention"
      title="Required actions"
      :description="
        attention.length
          ? 'Resolve these items to make the release ready.'
          : undefined
      "
      class="mb-4 attention-section"
    >
      <template #actions>
        <v-btn to="/readiness" size="small" variant="text" append-icon="mdi-arrow-right">
          Release readiness
        </v-btn>
      </template>
      <AttentionList v-if="attention.length" :items="visibleAttention" />
      <EmptyState
        v-else
        variant="positive"
        title="No required actions"
        message="All readiness checks for this release scope are satisfied."
      />
      <div v-if="attention.length > visibleAttention.length" class="attention-more">
        <router-link to="/readiness"
          >View all {{ attention.length }} required actions</router-link
        >
      </div>
    </SectionCard>
    <SectionCard v-else title="Required actions" class="mb-4 attention-section">
      <EmptyState
        variant="unavailable"
        title="Release readiness is not evaluated"
        message="This report has no release scope. Configure a release with scoped requirements and required manual cases, then regenerate the report to see readiness actions here."
      />
    </SectionCard>

    <div class="summary-cards">
      <MetricCard
        v-for="card in cards"
        :key="card.id"
        :title="card.title"
        :headline="card.headline"
        :status="card.status.key"
        :items="card.items"
        :note="card.note"
        :to="card.to"
        :link-label="card.linkLabel"
      />
    </div>

    <SectionCard
      v-if="manifest.qualityGate.checks.length"
      title="Quality gate"
      :description="`Profile ${manifest.qualityGate.profile ?? manifest.metadata.qualityProfile ?? 'standard'}`"
      class="mb-4"
    >
      <template #actions>
        <StatusChip :status="manifest.qualityGate.status" />
      </template>
      <div class="gate-checks">
        <div
          v-for="check in manifest.qualityGate.checks"
          :key="check.id"
          class="gate-check"
          :data-status="check.status"
          :title="check.message ?? `expected ${check.expected}`"
        >
          <v-icon
            size="x-small"
            :icon="resolveStatus(check.status).icon"
            :color="resolveStatus(check.status).color"
          />
          <span>{{ check.label }}</span>
          <strong class="mono">{{ checkActual(check) }}</strong>
          <span class="gate-check-expected mono">({{ check.expected }})</span>
        </div>
      </div>
    </SectionCard>

    <div class="secondary-grid">
      <SectionCard title="Top failing tests">
        <template #actions>
          <v-btn to="/tests" size="small" variant="text" append-icon="mdi-arrow-right">
            Test cases
          </v-btn>
        </template>
        <ul v-if="failingTests.length" class="linked-list">
          <li v-for="test in failingTests" :key="test.id">
            <StatusChip :status="test.status" size="x-small" />
            <router-link :to="`/tests/${test.id}`" class="linked-list-label">{{
              test.fullName ?? test.name
            }}</router-link>
          </li>
        </ul>
        <EmptyState
          v-else
          variant="positive"
          message="No failing or broken tests in this run."
        />
      </SectionCard>

      <SectionCard title="Requirement gaps">
        <template #actions>
          <v-btn to="/requirements" size="small" variant="text" append-icon="mdi-arrow-right">
            Requirements
          </v-btn>
        </template>
        <div v-if="gaps.length" class="gap-chips">
          <v-chip
            v-for="key in gaps"
            :key="key"
            size="small"
            class="mono"
            label
            :to="gapLink(key)"
            :title="
              gapLink(key)
                ? undefined
                : 'This requirement is only referenced by the release scope and has no traceability row'
            "
            >{{ key }}</v-chip
          >
          <span v-if="gapTotal > gaps.length" class="text-medium-emphasis">
            +{{ gapTotal - gaps.length }} more
          </span>
        </div>
        <EmptyState
          v-else
          :variant="requirementGapEmpty.variant"
          :message="requirementGapEmpty.message"
        />
      </SectionCard>

      <SectionCard title="Manual work remaining">
        <template #actions>
          <v-btn to="/manual" size="small" variant="text" append-icon="mdi-arrow-right">
            Manual testing
          </v-btn>
        </template>
        <template v-if="manifest.readiness">
          <div class="metric-card-items">
            <div>
              <strong>{{ manifest.readiness.manual.notRun }}</strong
              ><span>Not run</span>
            </div>
            <div>
              <strong :class="manifest.readiness.manual.blocked ? 'text-error' : ''">{{
                manifest.readiness.manual.blocked
              }}</strong
              ><span>Blocked</span>
            </div>
            <div>
              <strong :class="manifest.readiness.manual.failed ? 'text-error' : ''">{{
                manifest.readiness.manual.failed
              }}</strong
              ><span>Failed</span>
            </div>
          </div>
        </template>
        <EmptyState
          v-else-if="!manifest.manualCases.length"
          message="No manual cases are defined in this report."
        />
        <p v-else class="text-body-2">
          {{ manifest.manualCases.length }} manual case(s) are defined.
          {{ manifest.manualExecutions.length }} imported execution(s). Manual completion is
          evaluated against a release scope, which this report does not define.
        </p>
      </SectionCard>

      <SectionCard title="Security & evidence">
        <template #actions>
          <v-btn to="/security" size="small" variant="text" append-icon="mdi-arrow-right">
            Security
          </v-btn>
        </template>
        <div class="metric-card-items">
          <div>
            <strong :class="securityBlockers ? 'text-error' : 'text-success'">{{
              securityBlockers
            }}</strong
            ><span>Critical / high findings</span>
          </div>
          <div>
            <strong>{{ totalFindings }}</strong
            ><span>All findings</span>
          </div>
        </div>
        <div v-if="manifest.readiness" class="evidence-note">
          <template v-if="manifest.readiness.missingEvidence.length">
            <v-icon size="x-small" icon="mdi-alert-outline" color="warning" />
            Missing evidence: {{ manifest.readiness.missingEvidence.join(", ") }}
          </template>
          <template v-else>
            <v-icon size="x-small" icon="mdi-check-circle-outline" color="success" />
            All declared audit evidence is present.
            <router-link to="/downloads">Open evidence</router-link>
          </template>
        </div>
      </SectionCard>
    </div>

    <SectionCard v-if="!hasHistory" title="Execution trends" class="mb-4">
      <EmptyState
        variant="unavailable"
        message="Historical execution trends are not available in this report yet. Only the current run is included."
      />
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AttentionList from "../components/AttentionList.vue";
import EmptyState from "../components/EmptyState.vue";
import MetricCard from "../components/MetricCard.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import StatusChip from "../components/StatusChip.vue";
import { formatPercent } from "../format";
import {
  attentionItems,
  buildSummaryCards,
  hasHistoricalRuns,
  requirementGapEmptyState,
  requirementGaps,
  requirementLink,
  securityBlockerCount,
  topFailingTests
} from "../services/overview";
import { resolveStatus } from "../services/status";
import type { Manifest, TestCase } from "../types";

const props = defineProps<{ manifest?: Manifest; tests: TestCase[] }>();

const ATTENTION_LIMIT = 8;
const cards = computed(() => (props.manifest ? buildSummaryCards(props.manifest) : []));
const attention = computed(() =>
  props.manifest ? attentionItems(props.manifest, props.tests) : undefined
);
const visibleAttention = computed(() => (attention.value ?? []).slice(0, ATTENTION_LIMIT));
const failingTests = computed(() => topFailingTests(props.tests));
const gaps = computed(() => (props.manifest ? requirementGaps(props.manifest) : []));
const gapTotal = computed(() => {
  if (!props.manifest) return 0;
  const scoped = props.manifest.readiness?.requirements;
  return scoped ? scoped.uncoveredIds.length : props.manifest.requirements.missing.length;
});
const requirementGapEmpty = computed(() =>
  props.manifest
    ? requirementGapEmptyState(props.manifest)
    : { variant: "unavailable" as const, message: "" }
);
const securityBlockers = computed(() =>
  props.manifest ? securityBlockerCount(props.manifest) : 0
);
const totalFindings = computed(() =>
  Object.values(props.manifest?.summary.security ?? {}).reduce((sum, value) => sum + value, 0)
);
const hasHistory = computed(() => (props.manifest ? hasHistoricalRuns(props.manifest) : false));

function gapLink(key: string) {
  return props.manifest ? requirementLink(props.manifest, key) : undefined;
}

function checkActual(check: { actual: string | number; expected: string }) {
  if (typeof check.actual === "number" && check.expected.includes("%"))
    return formatPercent(check.actual);
  return check.actual;
}
</script>
