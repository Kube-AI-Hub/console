/**
 * The states a page can be in, as seen by an agent.
 *
 * An agent that drives a UI has to answer one question before every action:
 * "is the page ready?". Text on screen is a poor signal — it is localised,
 * truncated, and changes with styling. `data-ai-state` gives each page exactly
 * one machine-readable answer, so the agent polls an attribute instead of
 * guessing from screenshots.
 */
export type AiSurfaceState = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Attribute carrying `AiSurfaceState`.
 *
 * Set on the element that owns a region (usually the page root), not on the
 * whole document: a page can show a ready table next to a header that is still
 * loading, and the agent needs to tell them apart.
 */
export const AI_STATE_ATTR = 'data-ai-state';

/**
 * Attribute carrying a stable identifier for an interactive element.
 *
 * Stable means independent of the visible label: copy changes with locale and
 * product wording, but `configmaps:create` must not. The value is namespaced
 * `area:action` so an agent can scope a search without walking the page.
 */
export const AI_ID_ATTR = 'data-ai-id';

/** Attribute marking a row/item by its resource key, for targeted actions. */
export const AI_ROW_ATTR = 'data-ai-row';

/**
 * Attribute describing what an action needs before it can be used.
 *
 * Rendered as a space-separated list of ids, e.g. `selection:configmaps`.
 * An agent reads this to know an action is unavailable rather than clicking a
 * disabled button and misreading the silence as a failure.
 */
export const AI_NEEDS_ATTR = 'data-ai-needs';

/** ARIA attributes that must accompany every interactive surface element. */
export interface AiAccessibility {
  /** Accessible name, required for icon-only controls. */
  'aria-label'?: string;
  /** Existing role, if the element is a div/span acting as a control. */
  role?: string;
}

/**
 * Props for a page or region root.
 *
 * Spread onto the element that owns the region:
 * `.ai-page` for a page, `.ai-region` for a panel inside it.
 */
export function surfaceProps(state: AiSurfaceState, id: string): Record<string, string> {
  return { [AI_STATE_ATTR]: state, [AI_ID_ATTR]: id };
}

/** Props for an interactive element the agent may click or type into. */
export function actionProps(
  id: string,
  options: { needs?: readonly string[]; label?: string } = {},
): Record<string, string | undefined> {
  const props: Record<string, string | undefined> = { [AI_ID_ATTR]: id };
  if (options.needs?.length) props[AI_NEEDS_ATTR] = options.needs.join(' ');
  if (options.label) props['aria-label'] = options.label;
  return props;
}

/** Props for a list item, keyed by the resource's own identifier. */
export function rowProps(id: string): Record<string, string> {
  return { [AI_ROW_ATTR]: id };
}

/**
 * The outcome of an action, as an agent reads it.
 *
 * Every mutation in the app resolves to one of these shapes. Without a shared
 * shape an agent has to scrape toast text to find out whether a delete worked.
 */
export type ActionResult<T = void> =
  | { status: 'success'; data: T }
  | { status: 'error'; message: string; code?: string }
  | { status: 'cancelled' };

export const ok = <T>(data: T): ActionResult<T> => ({ status: 'success', data });

export const failed = (message: string, code?: string): ActionResult<never> =>
  code === undefined ? { status: 'error', message } : { status: 'error', message, code };

export const cancelled = (): ActionResult<never> => ({ status: 'cancelled' });

export const isSuccess = <T>(result: ActionResult<T>): result is { status: 'success'; data: T } =>
  result.status === 'success';
