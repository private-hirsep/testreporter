<template>
  <div>
    <PageHeader
      title="Release Readiness"
      :subtitle="
        manifest?.metadata.release
          ? `Readiness evaluation for release ${manifest.metadata.release}`
          : 'Readiness evaluation for this report'
      "
    >
      <StatusChip v-if="readiness" :status="readiness.status" size="default" />
    </PageHeader>
    <EmptyState
      v-if="!readiness"
      variant="unavailable"
      title="No readiness data in this report"
      message="This report was generated without a release scope. Add a release with scoped requirements and required manual cases to quality-report.yml, then regenerate."
    />
    <template v-else>
      <SectionCard
        title="Why this status"
        description="Every reason contributing to the current readiness result"
        class="mb-4"
        :data-status="readiness.status"
      >
        <ul v-if="readiness.reasons.length" class="reason-list">
          <li v-for="reason in readiness.reasons" :key="reason">
            {{ resolveTestIds(reason, tests ?? []) }}
          </li>
        </ul>
        <EmptyState
          v-else
          variant="positive"
          message="All readiness criteria for this release are satisfied."
        />
      </SectionCard>

      <SectionCard title="Required QA actions" class="mb-4">
        <AttentionList v-if="sortedActions.length" :items="sortedActions" />
        <EmptyState v-else variant="positive" message="No required actions." />
      </SectionCard>

      <div class="detail-grid">
        <SectionCard title="Release metadata">
          <MetadataList
            :items="[
              { label: 'Release', value: manifest?.metadata.release },
              { label: 'Tested build', value: manifest?.metadata.testedBuild, mono: true },
              { label: 'Commit', value: manifest?.metadata.commitSha, mono: true },
              { label: 'Branch', value: manifest?.metadata.branch, mono: true },
              { label: 'Environment', value: manifest?.metadata.environment },
              {
                label: 'Workflow run',
                value: manifest?.metadata.workflowRun ?? manifest?.metadata.runId
              },
              { label: 'Release date', value: manifest?.metadata.releaseDate }
            ]"
            placeholder="not recorded"
          />
        </SectionCard>
        <SectionCard title="Execution and scope">
          <div class="metric-card-items">
            <div>
              <strong class="text-success">{{ readiness.automated.passed }}</strong
              ><span>Automated passed</span>
            </div>
            <div>
              <strong :class="readiness.automated.failed ? 'text-error' : ''">{{
                readiness.automated.failed
              }}</strong
              ><span>Automated failed</span>
            </div>
            <div>
              <strong>{{ readiness.automated.skipped }}</strong
              ><span>Automated skipped</span>
            </div>
          </div>
          <div class="metric-card-items">
            <div>
              <strong class="text-success">{{ readiness.manual.passed }}</strong
              ><span>Manual passed</span>
            </div>
            <div>
              <strong :class="readiness.manual.failed ? 'text-error' : ''">{{
                readiness.manual.failed
              }}</strong
              ><span>Manual failed</span>
            </div>
            <div>
              <strong :class="readiness.manual.blocked ? 'text-error' : ''">{{
                readiness.manual.blocked
              }}</strong
              ><span>Manual blocked</span>
            </div>
            <div>
              <strong :class="readiness.manual.notRun ? 'text-warning' : ''">{{
                readiness.manual.notRun
              }}</strong
              ><span>Manual not run</span>
            </div>
          </div>
          <div class="metric-card-items">
            <div>
              <strong class="text-success">{{ readiness.requirements.covered }}</strong
              ><span>Requirements covered</span>
            </div>
            <div>
              <strong :class="readiness.requirements.uncovered ? 'text-error' : ''">{{
                readiness.requirements.uncovered
              }}</strong
              ><span>Uncovered</span>
            </div>
            <div>
              <strong>{{ readiness.requirements.excluded }}</strong
              ><span>Excluded</span>
            </div>
            <div>
              <strong :class="readiness.securityBlockers ? 'text-error' : 'text-success'">{{
                readiness.securityBlockers
              }}</strong
              ><span>Security blockers</span>
            </div>
          </div>
          <p class="text-body-2 mt-2 mb-0">
            Quality gate:
            <StatusChip
              :status="readiness.qualityGateFailed ? 'failed' : 'passed'"
              size="x-small"
            />
            <template v-if="readiness.automated.missing">
              · automated evidence is missing for this release scope.
            </template>
          </p>
        </SectionCard>
      </div>

      <div class="detail-grid">
        <SectionCard
          title="Accepted risks"
          description="Known issues consciously accepted for this release"
        >
          <ul v-if="readiness.acceptedRisks.length" class="risk-list">
            <li v-for="risk in readiness.acceptedRisks" :key="risk.id">
              <StatusChip status="accepted-risk" size="x-small" />
              <div>
                <strong class="mono">{{ risk.id }}</strong
                >: {{ risk.reason }}
                <span v-if="risk.reference" class="text-medium-emphasis"
                  >({{ risk.reference }})</span
                >
              </div>
            </li>
          </ul>
          <EmptyState v-else variant="positive" message="No accepted risks were declared." />
        </SectionCard>
        <SectionCard
          title="Audit evidence completeness"
          description="Declared evidence references checked against the generated report"
        >
          <template v-if="readiness.missingEvidence.length">
            <EmptyState
              variant="warning"
              title="Missing evidence"
              :message="readiness.missingEvidence.join(', ')"
            />
          </template>
          <template v-else>
            <EmptyState
              variant="positive"
              message="All declared evidence references are present."
            />
          </template>
          <div class="mt-3">
            <v-btn to="/downloads" size="small" variant="text" append-icon="mdi-arrow-right">
              Open evidence
            </v-btn>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        v-if="readiness.requirements.uncoveredIds.length || readiness.requirements.excludedIds.length"
        title="Scoped requirements"
        class="mb-4"
      >
        <p v-if="readiness.requirements.uncoveredIds.length" class="mb-2">
          Uncovered:
          <v-chip
            v-for="key in readiness.requirements.uncoveredIds"
            :key="key"
            size="small"
            class="mr-1 mb-1 mono"
            label
            :to="`/requirements#requirement-${key}`"
            >{{ key }}</v-chip
          >
        </p>
        <p v-if="readiness.requirements.excludedIds.length" class="mb-0">
          Excluded:
          <v-chip
            v-for="key in readiness.requirements.excludedIds"
            :key="key"
            size="small"
            class="mr-1 mb-1 mono"
            variant="outlined"
            label
            >{{ key }}</v-chip
          >
        </p>
      </SectionCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AttentionList from "../components/AttentionList.vue";
import EmptyState from "../components/EmptyState.vue";
import MetadataList from "../components/MetadataList.vue";
import PageHeader from "../components/PageHeader.vue";
import SectionCard from "../components/SectionCard.vue";
import StatusChip from "../components/StatusChip.vue";
import { attentionItems, resolveTestIds } from "../services/overview";
import type { Manifest, TestCase } from "../types";

const props = defineProps<{
  manifest?: Manifest | undefined;
  tests?: TestCase[] | undefined;
}>();
const readiness = computed(() => props.manifest?.readiness);
const severityRank: Record<string, number> = { blocker: 0, critical: 0, warning: 1 };
const sortedActions = computed(() =>
  [...(props.manifest ? (attentionItems(props.manifest, props.tests ?? []) ?? []) : [])].sort(
    (a, b) => (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2)
  )
);
</script>
