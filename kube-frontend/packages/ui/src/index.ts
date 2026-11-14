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
  DescriptionItem,
  DescriptionList,
  ResourceForm,
  Switch,
  type FormSchema,
  Drawer,
  Dropdown,
  Empty,
  FormField,
  Icon,
  Input,
  InputSearch,
  InputPassword,
  Label,
  Alert,
  Menu,
  Pagination,
  PasswordStrengthMeter,
  ResourceList,
  Select,
  MultiSelect,
  StatisticsGroup,
  MetricCell,
  TrendChart,
  Skeleton,
  Table,
  Tabs,
  TabsContent,
  Textarea,
  AccentToggle,
  ThemeProvider,
  ThemeToggle,
  useTheme,
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
  /** Lets a console page teach the schema layer a field type it does not ship. */
  registerFieldType,
  useIsMobile,
  useMediaQuery,
} from '@kube-ai-hub/ai-kit';

export type {
  AccentPalette,
  ButtonProps,
  DescriptionItemProps,
  DescriptionListProps,
  DropdownItem,
  FieldRenderer,
  FieldRendererContext,
  DropdownProps,
  IconName,
  ListAction,
  ListColumn,
  ListFilter,
  ListSchema,
  MenuNode,
  MenuProps,
  PasswordStrengthCheck,
  PasswordStrengthLevel,
  PasswordStrengthMeterProps,
  ResourceListProps,
  SelectOption,
  SelectProps,
  StatisticItem,
  StatisticsGroupProps,
  MetricCellProps,
  TrendChartProps,
  TrendPoint,
  SortOrder,
  TabItem,
  TableColumn,
} from '@kube-ai-hub/ai-kit';
