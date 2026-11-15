import type { LocaleKey, Translate } from '@kube-ai-hub/locales';
import type { MatchKind, MatchType, StrategyMode, StrategyStatus, StrategyType } from '@kube-ai-hub/api-client';

/**
 * One mapping per display fact, shared by the list and the detail.
 *
 * The two pages show the same type, status and mode words; two copies drift apart the
 * first time one of them gains a value (the old console's mapper and its detail renderer
 * had already diverged on status). The functions take a translator so the dictionaries
 * stay the only source of copy.
 */

export const STATUS_TONES: Record<StrategyStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  completed: 'success',
  failed: 'danger',
  progressing: 'warning',
  unknown: 'neutral',
};

const STATUS_KEYS: Record<StrategyStatus, LocaleKey> = {
  completed: 'grayRelease.status.completed',
  failed: 'grayRelease.status.failed',
  progressing: 'grayRelease.status.progressing',
  unknown: 'grayRelease.status.unknown',
};

const TYPE_KEYS: Record<string, LocaleKey> = {
  Canary: 'grayRelease.type.canary',
  Bluegreen: 'grayRelease.type.bluegreen',
  Mirror: 'grayRelease.type.mirror',
};

const MODE_KEYS: Record<StrategyMode, LocaleKey> = {
  traffic: 'grayRelease.detail.mode.traffic',
  content: 'grayRelease.detail.mode.content',
  bluegreen: 'grayRelease.detail.mode.bluegreen',
  mirror: 'grayRelease.detail.mode.mirror',
  unknown: 'grayRelease.detail.mode.unknown',
};

const VERSION_ROLE_KEYS = {
  principal: 'grayRelease.detail.version.principal',
  canary: 'grayRelease.detail.version.canary',
  mirror: 'grayRelease.detail.version.mirror',
} as const;

const MATCH_KIND_KEYS: Record<MatchKind, LocaleKey> = {
  cookie: 'grayRelease.detail.match.kind.cookie',
  header: 'grayRelease.detail.match.kind.header',
  uri: 'grayRelease.detail.match.kind.uri',
  userAgent: 'grayRelease.detail.match.kind.userAgent',
  other: 'grayRelease.detail.match.kind.other',
};

const MATCH_TYPE_KEYS: Record<MatchType, LocaleKey> = {
  exact: 'grayRelease.detail.match.type.exact',
  prefix: 'grayRelease.detail.match.type.prefix',
  regex: 'grayRelease.detail.match.type.regex',
  unknown: 'grayRelease.detail.match.type.unknown',
};

export function statusText(t: Translate, status: StrategyStatus): string {
  return t(STATUS_KEYS[status]);
}

/** An unrecognised type is shown verbatim rather than guessed or blanked. */
export function typeText(t: Translate, type: StrategyType): string {
  const key = TYPE_KEYS[type];
  return key ? t(key) : type;
}

export function modeText(t: Translate, mode: StrategyMode): string {
  return t(MODE_KEYS[mode]);
}

export function versionRoleText(t: Translate, role: keyof typeof VERSION_ROLE_KEYS): string {
  return t(VERSION_ROLE_KEYS[role]);
}

export function matchKindText(t: Translate, kind: MatchKind): string {
  return t(MATCH_KIND_KEYS[kind]);
}

export function matchTypeText(t: Translate, type: MatchType): string {
  return t(MATCH_TYPE_KEYS[type]);
}
