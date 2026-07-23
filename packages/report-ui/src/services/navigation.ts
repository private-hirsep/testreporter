export type NavItem = {
  title: string;
  to: string;
  icon: string;
  /** Legacy paths that must keep resolving to this destination. */
  aliases?: string[];
};

/**
 * QA-workflow navigation. Labels describe intent; `to` keeps the historical
 * route paths so existing deep links continue to work.
 */
export const navItems: NavItem[] = [
  { title: "Overview", to: "/", icon: "mdi-view-dashboard-outline", aliases: ["/overview"] },
  { title: "Test Cases", to: "/tests", icon: "mdi-test-tube", aliases: ["/test-cases"] },
  { title: "Executions", to: "/history", icon: "mdi-play-circle-outline", aliases: ["/executions"] },
  { title: "Release Readiness", to: "/readiness", icon: "mdi-rocket-launch-outline" },
  { title: "Requirements", to: "/requirements", icon: "mdi-clipboard-check-outline" },
  { title: "Manual Testing", to: "/manual", icon: "mdi-clipboard-edit-outline" },
  { title: "Coverage", to: "/coverage", icon: "mdi-chart-donut" },
  { title: "Security", to: "/security", icon: "mdi-shield-alert-outline" },
  { title: "Evidence", to: "/downloads", icon: "mdi-archive-check-outline", aliases: ["/evidence"] },
  { title: "Diagnostics", to: "/diagnostics", icon: "mdi-stethoscope" }
];
