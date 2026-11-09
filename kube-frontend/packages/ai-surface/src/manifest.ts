/**
 * The machine-readable description of a page.
 *
 * An agent reaching a UI it has never seen has two options: screenshot it and
 * guess, or read a description. Guessing fails on localisation and on any
 * layout change. This manifest is the description: which page, which actions,
 * what each one needs, and what the agent should look for afterwards.
 *
 * It is authored next to the page rather than generated from the DOM, because
 * "delete this configmap" is a fact about the product, not about which buttons
 * happen to be rendered at the moment.
 */

/** What the agent should observe to believe an action worked. */
export interface AiExpectation {
  /** `data-ai-state` the region must reach. */
  state?: 'ready' | 'empty';
  /** Text that must appear (already localised as rendered). */
  text?: string;
  /** A `data-ai-id` that must appear after the action. */
  appears?: string;
}

export interface AiAction {
  /**
   * Matches `data-ai-id`. This is the handle the agent uses; it never has to
   * know the visible label.
   */
  id: string;
  /** Human/agent-readable description of the effect. */
  description: string;
  /** Inputs the action takes, keyed by the field's `data-ai-id`. */
  inputs?: Record<string, { type: 'text' | 'select' | 'checkbox'; required?: boolean; description?: string }>;
  /**
   * Actions must be performed before this one can succeed, in order.
   * e.g. deleting a row needs `selection:configmaps` first.
   */
  requires?: string[];
  /** How the agent knows it worked. */
  expect?: AiExpectation;
  /** Mutating actions are listed separately; reading an agent should not. */
  mutating?: boolean;
}

export interface AiPage {
  /** Route path, same shape the router uses. */
  path: string;
  title: string;
  description: string;
  /** `data-ai-id` of the element carrying `data-ai-state`. */
  surfaceId: string;
  /** States this page can reach and what causes each. */
  states: Partial<Record<'loading' | 'ready' | 'empty' | 'error', string>>;
  actions: readonly AiAction[];
}

/**
 * Registry of every page.
 *
 * Pages register themselves at module load; the manifest endpoint in the BFF
 * reads this to serve `/api/ai/manifest`. Keeping it in code means it cannot
 * drift from the actions actually implemented.
 */
const pages = new Map<string, AiPage>();

export function registerPage(page: AiPage): void {
  pages.set(page.path, page);
}

export function getManifest(): readonly AiPage[] {
  return [...pages.values()];
}

/**
 * Find the next action an agent should take to reach `goal`.
 *
 * Deliberately dumb: returns every action whose `description` mentions the goal
 * and whose requirements are already satisfied. It exists so a caller does not
 * reimplement the dependency walk, not to replace the agent's own judgement.
 */
export function planFor(path: string, goal: string, satisfied: readonly string[] = []): readonly AiAction[] {
  const page = pages.get(path);
  if (!page) return [];
  const met = new Set(satisfied);
  return page.actions.filter(
    (action) =>
      action.description.includes(goal) &&
      (action.requires ?? []).every((requirement) => met.has(requirement)),
  );
}
