import { z } from "zod";

export const PublishModeSchema = z.enum(["auto", "none", "artifact", "pages", "pages-and-artifact"]);
export const PrCommentModeSchema = z.enum(["auto", "off", "minimal", "full"]);

export type PublishMode = z.infer<typeof PublishModeSchema>;
export type ResolvedPublishMode = Exclude<PublishMode, "auto">;
export type PrCommentMode = z.infer<typeof PrCommentModeSchema>;
export type ResolvedPrCommentMode = Exclude<PrCommentMode, "auto">;

export type ModeContext = {
  eventName?: string;
  refName?: string;
  defaultBranch?: string;
  isPullRequest?: boolean;
};

export function resolvePublishMode(mode: PublishMode, context: ModeContext = {}): ResolvedPublishMode {
  if (mode !== "auto") return mode;
  if (context.eventName === "pull_request" || context.eventName === "pull_request_target") return "none";
  if (context.eventName === "merge_group") return "artifact";
  if (context.eventName === "workflow_dispatch" || context.eventName === "release") return "pages-and-artifact";
  if (context.eventName === "push" && context.refName && context.refName === context.defaultBranch) {
    return "pages-and-artifact";
  }
  return "artifact";
}

export function resolvePrCommentMode(mode: PrCommentMode, context: ModeContext = {}): ResolvedPrCommentMode {
  if (mode !== "auto") return mode;
  return context.isPullRequest || context.eventName === "pull_request" || context.eventName === "pull_request_target"
    ? "minimal"
    : "off";
}

export function publishModeUploadsArtifact(mode: ResolvedPublishMode): boolean {
  return mode === "artifact" || mode === "pages-and-artifact";
}

export function publishModeDeploysPages(mode: ResolvedPublishMode): boolean {
  return mode === "pages" || mode === "pages-and-artifact";
}
