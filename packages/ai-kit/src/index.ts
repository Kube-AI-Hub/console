/* Styles first: tokens define the custom properties every component reads. */
import './styles/tokens.css';
import './styles/motion.css';

/* Theme */
export {
  ThemeProvider,
  useTheme,
  applyTheme,
  applyAccent,
  readStoredMode,
  readStoredAccent,
  themeBootstrapScript,
  type ThemeMode,
  type AccentPalette,
  type ThemeProviderProps,
} from './theme/ThemeProvider';
export { ThemeToggle, AccentToggle, type ThemeToggleProps, type AccentToggleProps } from './theme/ThemeToggle';

/* Motion */
export { useSpotlight, usePrefersReducedMotion } from './motion/useSpotlight';
export { Reveal, type RevealProps } from './motion/Reveal';
export { ParticleField, type ParticleFieldProps } from './motion/ParticleField';
export { StreamText, type StreamTextProps } from './motion/StreamText';

/* Primitives */
export { Button, buttonVariants, type ButtonProps } from './primitives/Button';
export {
  Input,
  Textarea,
  InputPassword,
  InputSearch,
  inputClassName,
  textareaClassName,
  type InputProps,
  type TextareaProps,
  type InputPasswordProps,
  type InputSearchProps,
} from './primitives/Input';
export { Select, type SelectProps, type SelectOption } from './primitives/Select';
export {
  Checkbox,
  CheckboxGroup,
  RadioGroup,
  Switch,
  Slider,
  type CheckboxProps,
  type CheckboxGroupProps,
  type CheckboxOption,
  type RadioGroupProps,
  type RadioOption,
  type SwitchProps,
  type SliderProps,
} from './primitives/Toggles';

/**
 * A single radio item. Only meaningful inside `RadioGroup`, which owns the
 * selection state; exported under the name console imports.
 */
export { Radio } from './primitives/Toggles';

/** One segment of a `RadioGroup variant="button"`. */
export { RadioButton } from './primitives/Toggles';
export { InputNumber, type InputNumberProps } from './primitives/InputNumber';
export { DatePicker, type DatePickerProps } from './primitives/DatePicker';
export { FormField, Label, type FormFieldProps, type LabelProps } from './primitives/FormField';
export {
  Badge,
  Tag,
  Avatar,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Panel,
  Text,
  Divider,
  Skeleton,
  Progress,
  resolveProgressTone,
  Empty,
  type BadgeProps,
  type TagProps,
  type AvatarProps,
  type CardProps,
  type PanelProps,
  type TextProps,
  type DividerProps,
  type ProgressProps,
  type ProgressTone,
  type EmptyProps,
} from './primitives/Display';
export {
  Alert,
  Loading,
  Modal,
  Drawer,
  Tooltip,
  Popover,
  type AlertProps,
  type LoadingProps,
  type ModalProps,
  type DrawerProps,
  type TooltipProps,
  type PopoverProps,
} from './primitives/Feedback';
export {
  ToastProvider,
  useToast,
  type ToastOptions,
  type ToastTone,
  type ToastProviderProps,
} from './primitives/Toast';
export { Menu, Collapse, type MenuNode, type MenuProps, type CollapseProps } from './primitives/Menu';
export { Icon, ICON_NAMES, ICON_NAME_SET, type IconProps, type IconName } from './primitives/Icon';
export {
  Columns,
  Column,
  Level,
  LevelLeft,
  LevelRight,
  LevelItem,
  type ColumnsProps,
  type ColumnProps,
  type LevelProps,
  type LevelItemProps,
} from './primitives/Layout';
export {
  Form,
  FormItem,
  FormGroup,
  runRules,
  type FormProps,
  type FormItemProps,
  type FormGroupProps,
  type LegacyRule,
} from './primitives/Form';
export {
  Notify,
  type NotifyOptions,
  type NotifyTone,
  type NotifyPlacement,
} from './primitives/Notify';
export { AutoComplete, type AutoCompleteProps } from './primitives/AutoComplete';
export {
  Tabs,
  TabsContent,
  Accordion,
  Dropdown,
  Breadcrumb,
  Pagination,
  type TabItem,
  type TabsProps,
  type AccordionItem,
  type AccordionProps,
  type DropdownItem,
  type DropdownProps,
  type BreadcrumbItem,
  type BreadcrumbProps,
  type PaginationProps,
} from './primitives/Navigation';
export {
  Table,
  type TableProps,
  type TableColumn,
  type TableSortState,
  type SortOrder,
} from './primitives/Table';
export { Tree, type TreeProps, type TreeNode } from './primitives/Tree';

/* Schema */
export {
  registerFieldType,
  registerColumnType,
  getFieldRenderer,
  getColumnRenderer,
  clearRendererRegistry,
  getByPath,
  setByPath,
  type FieldRenderer,
  type FieldRendererContext,
  type ColumnRenderer,
  type ColumnRendererContext,
} from './schema/registry';
export {
  ResourceList,
  type ListSchema,
  type ListColumn,
  type ListFilter,
  type ListAction,
  type ResourceListProps,
} from './schema/ResourceList';
export {
  ResourceDetail,
  type DetailSchema,
  type DetailSection,
  type DetailField,
  type ResourceDetailProps,
} from './schema/ResourceDetail';
export {
  ResourceForm,
  validateField,
  validateForm,
  type FormSchema,
  type FormFieldSchema,
  type FieldRule,
  type ResourceFormProps,
} from './schema/ResourceForm';

/* Utils */
export { cn } from './utils/cn';
