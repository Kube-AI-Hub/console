export {
  createClient,
  type ApiClient,
  type Client,
  type ClientOptions,
  type HttpApi,
  type RequestOptions,
  type StreamApi,
  type StreamOptions,
} from './client';
export { ApiError, type ApiErrorBody } from './errors';
export {
  projectLabel,
  projectsApi,
  selectableProjects,
  type ListProjectsOptions,
  type Project,
  type ProjectsApi,
} from './projects';
export {
  configMapsApi,
  toDetail,
  toKubeObject,
  toSummary,
  type ConfigMapDetail,
  type ConfigMapInput,
  type ConfigMapScope,
  type ConfigMapSummary,
  type ConfigMapsApi,
  type KubeConfigMap,
  type ListParams,
  type ListResult,
} from './configmaps';

/**
 * Shared resource plumbing.
 *
 * New collections (secrets, service accounts) build on `resourceApi` instead of
 * repeating the read-through-kapis / write-through-`/api/v1` mechanics that
 * `configmaps.ts` carries its own copy of. ConfigMaps keeps that copy: it is
 * released and tested, and rewriting it for symmetry is a regression risk with
 * no user-visible benefit.
 */
export {
  annotationKeys,
  baseOf,
  metadataAnnotations,
  kubePrefix,
  resourceApi,
  type KubeObject,
  type ResourceApi,
  type ResourceBase,
  type ResourceListParams,
  type ResourceListResult,
  type ResourceRef,
} from './resources';
export { accessReviewApi, type AccessQuery } from './permissions';
export {
  DEFAULT_REGISTRY_ANNOTATION,
  FORCE_INSECURE_ANNOTATION,
  KNOWN_SECRET_TYPES,
  isSystemManagedSecret,
  secretKeyProblem,
  secretsApi,
  toKubeSecret,
  toSecretDetail,
  toSecretSummary,
  type KubeSecret,
  type SecretDetail,
  type SecretInput,
  type SecretsApi,
  type SecretSummary,
} from './secrets';
export {
  ROLE_ANNOTATION,
  serviceAccountsApi,
  toKubeServiceAccount,
  toServiceAccountDetail,
  toServiceAccountSummary,
  type KubeServiceAccount,
  type ProjectRole,
  type ServiceAccountDetail,
  type ServiceAccountInput,
  type ServiceAccountsApi,
  type ServiceAccountSummary,
} from './serviceaccounts';
export {
  POD_STATUS,
  RESTART_ANNOTATION,
  WORKLOAD_STATUS,
  daemonSetStatus,
  deploymentStatus,
  jobStatus,
  podStatus,
  statefulSetStatus,
  hpaFor,
  toWorkloadAutoscaling,
  toWorkloadDetail,
  toWorkloadPod,
  toJobRun,
  toWorkloadService,
  toWorkloadRevision,
  toWorkloadSummary,
  workloadProgress,
  clusterEventsApi,
  objectEventsApi,
  podEventsApi,
  workloadsApi,
  workloadStatus,
  type PodStatus,
  type WorkloadAutoscaling,
  type ClusterEvent,
  type PodEvent,
  type WorkloadDetail,
  type WorkloadPod,
  type JobRun,
  type WorkloadService,
  type WorkloadRevision,
  type WorkloadKind,
  type WorkloadsApi,
  type WorkloadStatus,
  type WorkloadSummary,
} from './workloads';
export {
  ASSIGNABLE_PLATFORM_ROLES,
  clusterRolesApi,
  clusterRolesWriteApi,
  ROLE_VERBS,
  configScalar,
  passwordProblem,
  passwordChecks,
  PRESET_PLATFORM_USERS,
  isProtectedPlatformUser,
  toLoginRecord,
  userDetailApi,
  clusterRoleDetailApi,
  roleBindingsApi,
  usersWriteApi,
  userSettingsApi,
  NOTIFICATION_CHANNELS,
  platformInfoApi,
  platformRoleOf,
  toNotificationChannels,
  toClusterRoleSummary,
  toUserSummary,
  KAPIS_TENANT,
  usersApi,
  workspaceDetailApi,
  workspaceMembersApi,
  workspaceRolesApi,
  workspacesApi,
  workspacesWriteApi,
} from './access';
export type {
  AccessKind,
  AssignablePlatformRole,
  PasswordChecks,
  ClusterRoleDetail,
  ClusterRoleSummary,
  EditableRule,
  RoleVerb,
  NotificationChannel,
  NotificationChannelKey,
  PlatformInfo,
  LoginRecord,
  LoginRecordsPage,
  RoleSubject,
  UserDetail,
  UserSummary,
  WorkspaceDetail,
  WorkspaceMemberSummary,
  WorkspaceRoleSummary,
  WorkspaceProject,
  WorkspaceSummary,
} from './access';
export {
  KAPIS_IAM,
  LOG_COLLECTION_LABEL,
  limitRangesApi,
  logCollectionApi,
  isTemplateRole,
  clusterLoggingApi,
  clusterMembersApi,
  membersApi,
  membersWriteApi,
  NETWORK_ISOLATE_ANNOTATION,
  networkIsolationApi,
  networkPoliciesApi,
  networkPoliciesWriteApi,
  POLICY_DIRECTIONS,
  toSelector,
  projectInfoApi,
  projectRolesWriteApi,
  toNetworkPolicyDetail,
  toNetworkPolicySummary,
  projectQuotaApi,
  QUOTA_RESOURCES,
  rolesApi,
  toMemberDetail,
  toMemberSummary,
  toRoleDetail,
  toRoleRule,
  toRoleSummary,
} from './iam';
export type {
  IamKind,
  MemberDetail,
  ClusterMemberSummary,
  MemberSummary,
  MembersApi,
  NetworkPolicyDetail,
  NetworkPolicySummary,
  PolicyDirection,
  ProjectInfo,
  ProjectQuota,
  QuotaResource,
  RoleDetail,
  RoleRule,
  RolesApi,
  RoleSummary,
} from './iam';
export {
  KAPIS_ALERTING,
  KAPIS_RESOURCES,
} from './resources';
export {
  ALERTING_ENABLE_LABEL,
  alertStateLabel,
  alertingApi,
  clusterAlertMessagesApi,
  alertingModel,
  alertingRulesApi,
  ruleGroupsApi,
  ruleGroupsWriteApi,
  severityLabel,
  toAlertingRuleSummary,
  toAlertSummary,
  toClusterAlertSummary,
  toRuleGroupDetail,
  toRuleGroupSummary,
} from './alerting';
export type {
  AlertDetail,
  AlertSummary,
  AlertingApi,
  AlertingKind,
  AlertingRuleDetail,
  AlertingRuleSummary,
  AlertingRulesApi,
  ClusterAlertMessagesApi,
  ClusterAlertSource,
  ClusterAlertSummary,
  RuleGroupDetail,
  RuleGroupRule,
  RuleGroupScope,
  RuleGroupRuleInput,
  RuleGroupSummary,
  RuleGroupsApi,
  RuleGroupsWriteApi,
} from './alerting';
export {
  componentsApi,
  namespacesApi,
  nodeRole,
  projectGatewayApi,
  quantityToNumber,
  usagePercent,
  nodeStatus,
  nodesApi,
  nodesWriteApi,
  toComponentSummary,
  toNamespaceSummary,
  toNodeDetail,
  toNodeSummary,
  toPersistentVolumeDetail,
  toPersistentVolumeSummary,
  persistentVolumesApi,
  toProjectGateway,
} from './storage';
export type { ComponentSummary, NamespaceSummary, NodeCondition, NodeDetail, NodeSummary, NodeTaint, PersistentVolumeDetail, PersistentVolumeSummary, ProjectGateway } from './storage';
export {
  accessModeLabel,
  claimStatus,
  snapshotStatus,
  storageApi,
  storageClassExpands,
  storageClassesApi,
  toStorageClassDetail,
  toStorageClassSummary,
  mountsOf,
  withMountState,
  toStorageDetail,
  toStorageSummary,
} from './storage';
export type { StorageApi, StorageClassDetail, StorageClassSummary, StorageDetail, StorageKind, StorageSummary } from './storage';
export type {
  LOGIN_ERROR_CODES,
  LoginErrorCode,
  Session,
  SessionApi,
  SessionUser,
} from './session';
export { isLoginErrorCode, sessionApi } from './session';
export { strategiesApi, strategyStatusOf, targetServiceOf, toStrategySummary } from './servicemesh';
export type { KubeStrategy, StrategyStatus, StrategySummary, StrategyType } from './servicemesh';
export {
  devopsCollectionsApi,
  devopsProjectNamespace,
  isRunOfPipeline,
  pipelineRunStatusOf,
  toCdApplicationSummary,
  toCodeRepositorySummary,
  toPipelineDetail,
  toPipelineRunSummary,
  toPipelineSummary,
} from './devops';
export type {
  CdApplicationSummary,
  CodeRepositorySummary,
  DevopsProjectDetail,
  PipelineDetail,
  PipelineRunStatus,
  PipelineRunSummary,
  PipelineSummary,
} from './devops';
export { isTokenExpired, userFromToken } from './token';

/**
 * The cluster console's overview.
 *
 * Reads the `cluster.kubesphere.io` object (what the cluster is) and the KubeSphere
 * monitoring API (how busy it is). Two sources, because losing the second must not take
 * the first down: installations without a monitoring backend still have versions,
 * readiness and the installed-module list.
 */
export {
  clusterApi,
  clusterMetricsApi,
  clusterWriteApi,
  METRIC_WORKLOAD_KINDS,
  clusterAgentApi,
  CLUSTER_GROUPS,
  CLUSTER_PROVIDERS,
  clusterImportApi,
  clusterImportBody,
  platformConfigApi,
  clustersApi,
  componentMetricsApi,
  customResourcesApi,
  nodeUsageApi,
  rangeMetricsApi,
  toClusterDetail,
  toClusterSummary,
  toCustomResourceSummary,
  toMetricValues,
} from './cluster';
export type {
  ClusterConnectionMode,
  ClusterDetail,
  ClusterGroup,
  ClusterModule,
  ClusterSummary,
  ClustersApi,
  ClusterUsage,
  CustomResourceDetail,
  CustomResourceInstance,
  CustomResourceSummary,
  CustomResourcesApi,
  KubernetesStatus,
  MetricSeries,
  MetricWorkloadKind,
  NodeUsage,
  NodeUsageApi,
  RangeMetricsApi,
  SeriesPoint,
} from './cluster';

export { gpusApi, gpuPath, toGpuDevice, toGpuStats, KAPIS_GPU } from './gpu';
export type {
  GpuDevice,
  GpusApi,
  GpuListParams,
  GpuListResult,
  GpuModelCount,
  GpuSortKey,
  GpuStats,
} from './gpu';

export {
  CHANNEL_SPEC_KEY,
  channelEnabled,
  NOTIFICATION_CHANNELS as NOTIFICATION_CHANNEL_KEYS,
  notificationConfigApi,
  notificationReceiverApi,
  notificationSecretApi,
  notificationVerifyApi,
  readChannel,
} from './notification';
export type {
  ChannelStatus,
  NotificationChannelKey as NotificationChannelSpecKey,
  NotificationObject,
  VerifyResult,
} from './notification';

export { logSearchApi, auditSearchApi } from './search';
export type { AuditRecord, AuditSearchResult, HistogramBucket, HistogramResult, LogRecord, LogSearchResult, LogStatistics } from './search';

export { DEFAULT_TAIL_LINES, openPodLogStream, podLogPath, streamPodLogs } from './logs';
export type { PodLogOptions, PodLogStream, PodLogTarget } from './logs';

export {
  DEFAULT_EXEC_COLUMNS,
  DEFAULT_EXEC_COMMAND,
  DEFAULT_EXEC_ROWS,
  EXEC_CHANNELS,
  EXEC_PROTOCOL,
  TOKEN_PROTOCOL_PREFIX,
  execPath,
  execWebSocketUrl,
  openExecSession,
  stripAnsi,
} from './exec';
export type { ExecOptions, ExecSession, ExecSocket, ExecSocketFactory, ExecTarget } from './exec';

export { ipPoolsApi, toIpPoolDetail, toIpPoolSummary } from './network';
export type { IpPoolDetail, IpPoolSummary } from './network';

export {
  decodeStoreFile,
  storeAppsApi,
  storeCategoriesApi,
  storeReviewsApi,
  workspaceApplicationsApi,
  storeWorkspacesApi,
  storeWorkspaceProjectsApi,
} from './appstore';
export type {
  StoreApp,
  StoreAppDetail,
  StoreAppFiles,
  StoreApplication,
  StoreAppVersion,
  StoreCategory,
  StoreReview,
} from './appstore';

export { clusterDashboardsApi, projectDashboardsApi } from './dashboards';
export type { DashboardDetail, DashboardSummary } from './dashboards';
export { clusterGatewaysApi, toClusterGateway } from './gateways';
export type { ClusterGateway } from './gateways';
export { kubectlApi } from './kubectl';
export type { KubectlTarget } from './kubectl';
export { nodeTerminalPath, openNodeTerminalSession } from './node-terminal';
export type { NodeTerminalOptions, NodeTerminalTarget } from './node-terminal';
export { nodeResourcesApi } from './node-resources';
export { nodeListApi, toNodeMetrics, NODE_LIST_METRICS } from './node-list';
export type { NodeListParams, NodeListStats, NodeMetricValues } from './node-list';
export { nodeInsightsApi, NODE_INSIGHT_METRICS } from './node-insights';
export type { NodeInsightValues, RdmaPort } from './node-insights';
export { nodeRankingApi, NODE_RANK_METRICS } from './node-ranking';
export type { NodeRankMetric, NodeRankRow } from './node-ranking';
export { imageBuildersApi, toImageBuilderSummary } from './s2ibuilder';
export type { ImageBuilderKind, ImageBuilderSummary, ImageBuildersApi } from './s2ibuilder';
export { watchCollection } from './watch';
export type { WatchEvent, WatchOptions } from './watch';
