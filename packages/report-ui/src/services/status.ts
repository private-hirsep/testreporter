export type StatusDescriptor = {
  key: string;
  label: string;
  icon: string;
  color: string;
  tone: "positive" | "negative" | "caution" | "neutral" | "informational";
  description: string;
};

const DESCRIPTORS: Record<string, StatusDescriptor> = {};

function register(descriptor: StatusDescriptor, ...aliases: string[]) {
  DESCRIPTORS[descriptor.key] = descriptor;
  for (const alias of aliases) DESCRIPTORS[alias] = descriptor;
}

register({
  key: "passed",
  label: "Passed",
  icon: "mdi-check-circle",
  color: "success",
  tone: "positive",
  description: "Executed and met all expectations"
});
register({
  key: "ready",
  label: "Ready",
  icon: "mdi-check-decagram",
  color: "success",
  tone: "positive",
  description: "Release readiness criteria are satisfied"
});
register({
  key: "ready-with-accepted-risks",
  label: "Ready with accepted risks",
  icon: "mdi-check-decagram-outline",
  color: "success",
  tone: "positive",
  description: "Ready to release with documented accepted risks"
});
register({
  key: "covered",
  label: "Covered",
  icon: "mdi-check-circle",
  color: "success",
  tone: "positive",
  description: "Requirement has linked evidence"
});
register({
  key: "failed",
  label: "Failed",
  icon: "mdi-close-circle",
  color: "error",
  tone: "negative",
  description: "Executed and did not meet expectations"
});
register({
  key: "blocked",
  label: "Blocked",
  icon: "mdi-cancel",
  color: "error",
  tone: "negative",
  description: "Cannot proceed until a blocker is resolved"
});
register({
  key: "broken",
  label: "Broken",
  icon: "mdi-alert-octagon",
  color: "deep-purple",
  tone: "negative",
  description: "Failed for infrastructure or setup reasons"
});
register(
  {
    key: "missing",
    label: "Missing",
    icon: "mdi-link-off",
    color: "error",
    tone: "negative",
    description: "Expected but no evidence was found"
  },
  "uncovered"
);
register({
  key: "warning",
  label: "Warning",
  icon: "mdi-alert",
  color: "warning",
  tone: "caution",
  description: "Needs attention but is not blocking"
});
register({
  key: "incomplete",
  label: "Incomplete",
  icon: "mdi-progress-alert",
  color: "warning",
  tone: "caution",
  description: "Required data or executions are still missing"
});
register({
  key: "extra",
  label: "Extra",
  icon: "mdi-plus-circle-outline",
  color: "warning",
  tone: "caution",
  description: "Referenced by tests but not part of the expected set"
});
register({
  key: "skipped",
  label: "Skipped",
  icon: "mdi-debug-step-over",
  color: "warning",
  tone: "caution",
  description: "Deliberately not executed in this run"
});
register(
  {
    key: "not-run",
    label: "Not run",
    icon: "mdi-circle-outline",
    color: "grey",
    tone: "neutral",
    description: "Execution has not started"
  },
  "not_run"
);
register({
  key: "accepted-risk",
  label: "Accepted risk",
  icon: "mdi-scale-balance",
  color: "info",
  tone: "informational",
  description: "A known issue accepted with a documented reason"
});
register(
  {
    key: "unavailable",
    label: "Unavailable",
    icon: "mdi-help-circle-outline",
    color: "grey",
    tone: "neutral",
    description: "This report does not contain the required data"
  },
  "not_evaluated",
  "unknown"
);
register(
  {
    key: "informational",
    label: "Info",
    icon: "mdi-information-outline",
    color: "info",
    tone: "informational",
    description: "Informational only"
  },
  "info"
);
register({
  key: "excluded",
  label: "Excluded",
  icon: "mdi-minus-circle-outline",
  color: "grey",
  tone: "neutral",
  description: "Explicitly excluded from this release scope"
});
register({
  key: "approved",
  label: "Approved",
  icon: "mdi-check-circle-outline",
  color: "success",
  tone: "positive",
  description: "Approved for execution"
});
register({
  key: "draft",
  label: "Draft",
  icon: "mdi-pencil-outline",
  color: "grey",
  tone: "neutral",
  description: "Draft state, not official evidence"
});
register({
  key: "completed",
  label: "Completed",
  icon: "mdi-check-circle",
  color: "success",
  tone: "positive",
  description: "Execution was completed"
});
register({
  key: "critical",
  label: "Critical",
  icon: "mdi-alert-octagram",
  color: "error",
  tone: "negative",
  description: "Critical severity finding"
});
register({
  key: "high",
  label: "High",
  icon: "mdi-arrow-up-bold-circle",
  color: "error",
  tone: "negative",
  description: "High severity finding"
});
register({
  key: "medium",
  label: "Medium",
  icon: "mdi-alert",
  color: "warning",
  tone: "caution",
  description: "Medium severity finding"
});
register({
  key: "low",
  label: "Low",
  icon: "mdi-arrow-down-bold-circle-outline",
  color: "success",
  tone: "informational",
  description: "Low severity finding"
});
register({
  key: "blocker-action",
  label: "Blocker",
  icon: "mdi-alert-octagon",
  color: "error",
  tone: "negative",
  description: "Blocks the release until resolved"
});

export function resolveStatus(value?: string): StatusDescriptor {
  const key = (value ?? "").toLowerCase().trim();
  return (
    DESCRIPTORS[key] ?? {
      key: key || "unavailable",
      label: value ?? "Unavailable",
      icon: "mdi-help-circle-outline",
      color: "grey",
      tone: "neutral",
      description: "Unrecognized status"
    }
  );
}
