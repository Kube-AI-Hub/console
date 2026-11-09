/**
 * `@kube-ai-hub/ui` — the presentation layer.
 *
 * Permanent contract, inherited from bisheng's shared UI package because the
 * reasons hold here too:
 *
 * 1. No state management. Props and callbacks only.
 * 2. No requests. Data comes in, events go out.
 * 3. No i18n. Every string is passed as a prop; the app owns translation.
 * 4. No routing. Navigation is a callback.
 *
 * A component that needs any of these belongs in the app, not here.
 * `config/package-boundaries.test.ts` enforces the rules by scanning source.
 *
 * Components wrap ai-kit rather than reimplementing it: ai-kit owns appearance
 * and accessibility, this package owns the agent-facing contract.
 */

export { AiButton, AiSurface } from './ai-controls';
export type { AiButtonProps, AiSurfaceProps } from './ai-controls';

// Re-exported so feature code imports from one place and cannot accidentally
// pull an unstyled primitive that bypasses the ai-kit tokens.
export {
  Badge,
  Drawer,
  Empty,
  Menu,
  Pagination,
  Skeleton,
  Table,
  Tooltip,
  cn,
  useIsMobile,
  useMediaQuery,
} from '@kube-ai-hub/ai-kit';

export type { MenuNode, TableColumn } from '@kube-ai-hub/ai-kit';
