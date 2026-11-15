import type { PipelineRunStatus } from '@kube-ai-hub/api-client';

/**
 * Formatting shared by the DevOps pages.
 *
 * The migration guide's pit #10 is "the list and the detail each format the same field
 * their own way, and they diverge". Duration, health and run status are all rendered in
 * at least two places (project tab, pipeline detail, run detail), so they live here once.
 */

/** The four health bands the old console's Health component drew. */
export type HealthBand = 'healthy' | 'subHealthy' | 'warning' | 'unknown';

/**
 * Jenkins' weather score, banded exactly like the old console.
 *
 * The bands are the contract: <=30 warning, 30 < score <= 80 sub-healthy, > 80 healthy.
 * **An absent score is 'unknown', not 'healthy'.** The old console defaulted the score to
 * 100 before banding, so a pipeline that had never synced to Jenkins was drawn as
 * perfectly healthy; that is a fabricated value and is deliberately not carried over.
 */
export function healthBand(score: number | undefined): HealthBand {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'unknown';
  if (score <= 30) return 'warning';
  if (score <= 80) return 'subHealthy';
  return 'healthy';
}

/** The tone a health band maps to, so badge colours cannot drift from the bands. */
export function healthTone(band: HealthBand): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (band) {
    case 'healthy':
      return 'success';
    case 'subHealthy':
      return 'warning';
    case 'warning':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * A millisecond duration as '1h 20m' / '2m 5s' / '9s'.
 *
 * Zero and missing are different facts: a run that has not finished has no duration
 * ('-'), while a run that took less than a second reports '0s'. The old console printed
 * '-' for both.
 */
export function formatDuration(millis: number | undefined): string {
  if (typeof millis !== 'number' || !Number.isFinite(millis) || millis < 0) return '-';
  const totalSeconds = Math.round(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}

/** The run status keys, in one place so the tables and the badges agree. */
export const RUN_STATUS_KEYS: Record<PipelineRunStatus, string> = {
  queued: 'devops.pipeline.state.queued',
  running: 'devops.pipeline.state.running',
  success: 'devops.pipeline.state.success',
  failure: 'devops.pipeline.state.failure',
  aborted: 'devops.pipeline.state.aborted',
  paused: 'devops.pipeline.state.paused',
  unstable: 'devops.pipeline.state.unstable',
  notRunning: 'devops.pipeline.state.notRunning',
};

/** The tone each run status maps to. */
export const RUN_STATUS_TONES: Record<PipelineRunStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  queued: 'info',
  running: 'info',
  success: 'success',
  failure: 'danger',
  aborted: 'warning',
  paused: 'warning',
  unstable: 'warning',
  notRunning: 'neutral',
};

/**
 * The commit column: the old console showed the first 6 characters.
 *
 * A run without a commit (a manual run of a single-branch pipeline) shows '-', which is
 * different from an empty commit id.
 */
export function shortCommit(commitId: string): string {
  return commitId ? commitId.slice(0, 6) : '-';
}
