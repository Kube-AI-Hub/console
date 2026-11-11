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
  Button,
  Drawer,
  Dropdown,
  Empty,
  Icon,
  Input,
  InputPassword,
  Label,
  Alert,
  Menu,
  Pagination,
  ResourceList,
  Select,
  Skeleton,
  Table,
  Textarea,
  ThemeProvider,
  ThemeToggle,
  themeBootstrapScript,
  Tooltip,
  Modal,
  /*
   * `YamlEditor` is deliberately not re-exported.
   *
   * This barrel is what every page imports, so re-exporting the editor tied
   * CodeMirror (188 KB gzip) to every first load. Consumers import it from
   * `@kube-ai-hub/ai-kit` inside the dialog chunk that actually renders it.
   */
  cn,
  useIsMobile,
  useMediaQuery,
} from '@kube-ai-hub/ai-kit';

export type {
  ButtonProps,
  DropdownItem,
  DropdownProps,
  IconName,
  ListAction,
  ListColumn,
  ListFilter,
  ListSchema,
  MenuNode,
  MenuProps,
  ResourceListProps,
  SelectOption,
  SelectProps,
  SortOrder,
  TableColumn,
} from '@kube-ai-hub/ai-kit';
