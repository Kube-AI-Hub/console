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
export { DEFAULT_DOCUMENTS, publicConfigApi, type DocsLinks, type PublicConfig } from './config';
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
  clusterRolesForClusterApi,
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
  workspaceGroupsApi,
  workspaceGroupForest,
  toWorkspaceClusterSummary,
  toWorkspaceGroupSummary,
  workspaceMembersApi,
  workspaceRolesApi,
  workspaceRolesWriteApi,
  workspacesApi,
  workspacesWriteApi,
} from './access';
export type {
  AccessKind,
  AssignablePlatformRole,
  PasswordChecks,
  ClusterRoleDetail,
  ClusterRoleScopedDetail,
  ClusterRoleScopedUser,
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
  WorkspaceClusterSummary,
  WorkspaceDetail,
  WorkspaceGroupMember,
  WorkspaceGroupNode,
  WorkspaceGroupSummary,
  WorkspaceMemberResource,
  WorkspaceMemberSummary,
  WorkspaceRoleDetail,
  WorkspaceRoleSummary,
  WorkspaceRoleTemplate,
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
  networkPolicyManifest,
  type PolicyCreateInput,
  type PolicyPeerKind,
  type PolicyPeerInput,
  type PolicyPortInput,
  type PolicyRuleInput,
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
  ClusterRoleOption,
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
  alertMessagesApi,
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
  toRuleGroupStatus,
  toRuleGroupSummary,
} from './alerting';
export type {
  AlertDetail,
  AlertMessage,
  AlertMessageScope,
  AlertMessagesApi,
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
  RuleGroupRuleStatus,
  RuleGroupRuntimeStatus,
  RuleGroupScope,
  RuleGroupRuleInput,
  RuleGroupStateCounts,
  RuleGroupSummary,
  RuleGroupWriteInput,
  RuleGroupWriteScope,
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
  type NodeJoinCommand,
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
  claimManifest,
  claimCloneManifest,
  snapshotManifest,
  volumeSnapshotsWriteApi,
  storageClassExpands,
  storageClassesApi,
  toStorageClassDetail,
  toStorageClassSummary,
  mountsOf,
  withMountState,
  toStorageDetail,
  toStorageSummary,
} from './storage';
export type { ClaimCreateInput, StorageApi, StorageClassDetail, StorageClassDraft, StorageClassSizeConfig, StorageClassSummary, StorageDetail, StorageKind, StorageSummary } from './storage';
export { meteringBase, namespaceUsageApi, type NamespaceUsageResult, type ProjectUsage, type UsageRange } from './metering';
export { identityProvidersApi, type IdentityProvider, type IdentityProvidersResult } from './identity';
export {
  composedAppBodies,
  composedAppsApi,
  composedAppsWriteApi,
  validateComposedAppInput,
  type ComposedAppComponentCounts,
  type ComposedAppCreateInput,
  type ComposedAppDetail,
  type ComposedAppHealth,
  type ComposedAppIngress,
  type ComposedAppService,
  type ComposedAppGray,
  type ComposedAppGrayStrategy,
  type ComposedAppGrayType,
  type ComposedAppSummary,
  type ComposedAppTrace,
  type ComposedAppTraceSpan,
  type ComposedAppTracing,
  type ComposedAppTraffic,
  type ComposedAppTrafficNode,
  type ComposedAppWorkload,
} from './apps';
export type {
  LOGIN_ERROR_CODES,
  LoginErrorCode,
  Session,
  SessionApi,
  SessionUser,
} from './session';
export { isLoginErrorCode, loginPhraseKey, sessionApi } from './session';
export type { LoginPhraseKey } from './session';
export {
  pausedStrategy,
  resumedStrategy,
  strategiesApi,
  strategyStatusOf,
  targetServiceOf,
  toStrategyDetail,
  toStrategySummary,
  withBluegreenVersion,
  withGovernor,
  withTrafficWeight,
} from './servicemesh';
export type {
  KubeStrategy,
  MatchKind,
  MatchType,
  StrategyCondition,
  StrategyDetail,
  StrategyMatchRule,
  StrategyMode,
  StrategyProtocol,
  StrategyRoute,
  StrategyStatus,
  StrategySummary,
  StrategyType,
  StrategyVersion,
} from './servicemesh';
export {
  credentialCreateBody,
  devopsApi,
  devopsCollectionsApi,
  devopsProjectCreateBody,
  devopsProjectNamespace,
  isDevopsCredential,
  isRunOfPipeline,
  pipelineCreateBody,
  pipelineRunCreateBody,
  pipelineRunStatusOf,
  toCdApplicationSummary,
  toCodeRepositorySummary,
  toCredentialRow,
  toDevopsProjectSummary,
  toPipelineDetail,
  toPipelineRow,
  toPipelineRunSummary,
  toPipelineSummary,
} from './devops';
export type {
  CdApplicationSummary,
  CodeRepositorySummary,
  CredentialDraft,
  CredentialKind,
  CredentialRow,
  DevopsProjectDetail,
  DevopsProjectDraft,
  DevopsProjectSummary,
  MemberRow,
  PipelineDetail,
  PipelineDraft,
  PipelineParameter,
  PipelineParameterDraft,
  PipelineRow,
  PipelineRunStatus,
  PipelineRunSummary,
  PipelineSummary,
  RoleRow,
  RunPipelineRequest,
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
  versionApi,
  eventSearchApi,
  toClusterDetail,
  toClusterSummary,
  toCustomResourceSummary,
  toMetricValues,
} from './cluster';
export type {
  EventHistogram,
  EventHistogramBucket,
  EventQueryFilters,
  EventQueryPage,
  EventRecord,
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
  ComponentMetricName,
  ComponentMetricSeries,
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
  decodeHelmValues,
  storeAppsApi,
  workspaceReposApi,
  storeCategoriesApi,
  storeReviewsApi,
  workspaceApplicationsApi,
  storeWorkspacesApi,
  storeWorkspaceProjectsApi,
  installedReleasesApi,
  appTemplatesApi,
  appTemplateInstancesApi,
  VERSION_STATUS_ACTION,
  VERSION_DELETABLE,
  toWorkspaceRepo,
  toInstalledRelease,
  toHelmRelease,
  toAppTemplate,
  toAppTemplateVersion,
} from './appstore';
export type {
  StoreApp,
  StoreAppDetail,
  StoreAppFiles,
  StoreApplication,
  StoreAppVersion,
  StoreCategory,
  StoreReview,
  WorkspaceRepo,
  RepoEvent,
  InstalledRelease,
  HelmRelease,
  ReleaseResource,
  AppTemplate,
  AppTemplateVersion,
} from './appstore';

export { clusterDashboardsApi, projectDashboardsApi } from './dashboards';
export type { DashboardDetail, DashboardSummary } from './dashboards';
export { clusterGatewaysApi, projectGatewaysApi, isClusterGatewayNamespace, toClusterGateway, toGatewayDetail } from './gateways';
export type { ClusterGateway, GatewayChanges, GatewayDetail, GatewayServicePort, GatewaySpec } from './gateways';
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
export { workloadRankingApi, WORKLOAD_RANK_METRICS } from './workload-ranking';
export { workspaceUsageApi, WORKSPACE_USAGE_METRICS, WORKSPACE_PROJECT_RANK_METRICS } from './workspace-overview';
export { workspacePlacementApi } from './workspace-overview';
export type { WorkspacePlacement } from './workspace-overview';
export type { WorkspaceUsageMetric, WorkspaceProjectRankMetric, WorkspaceProjectRankRow } from './workspace-overview';
export type { WorkloadRankMetric, WorkloadRankRow } from './workload-ranking';
export type { NodeRankMetric, NodeRankRow } from './node-ranking';
export {
  decodeEnvValue,
  downloadS2iBinary,
  imageBuilderTriggerLink,
  imageBuildersApi,
  labelSelector,
  normalizeBuilderStatus,
  normalizeRunStatus,
  runImageSize,
  s2iAnnotationKeys,
  toImageBuilderDetail,
  toImageBuilderSummary,
  toS2iBuilderTemplate,
  toS2iRunSummary,
  uploadS2iBinary,
} from './s2ibuilder';
export type {
  EnvSourceValues,
  ImageBuilderDetail,
  ImageBuilderKind,
  ImageBuilderListParams,
  ImageBuilderSummary,
  ImageBuildersApi,
  RawS2iBinary,
  RawS2iBuilder,
  RawS2iBuilderTemplate,
  RawS2iRun,
  S2iBuildConfig,
  S2iBuilderTemplate,
  S2iEnvVar,
  S2iEvent,
  S2iJobDetail,
  S2iJobPod,
  S2iRunSummary,
  S2iSecretOption,
} from './s2ibuilder';
export { watchCollection } from './watch';
export type { WatchEvent, WatchOptions } from './watch';
export {
  clustersOf,
  federatedApi,
  FEDERATED_API,
  FEDERATED_RESOURCE_SEGMENTS,
  MANAGED_LABEL,
  pluralOf,
  projectNameProblem,
  propagatedOf,
  segmentOf,
  toFederatedProject,
  toFederatedProjectDetail,
  toFederatedResourceDetail,
  WORKSPACE_LABEL,
  workspaceOf,
} from './federated';
export type {
  CreateFederatedProjectInput,
  FederatedApi,
  FederatedCondition,
  FederatedProjectDetail,
  FederatedProjectSummary,
  FederatedResourceDetail,
  FederatedResourceObject,
  FederatedResourceType,
  KubeFederatedObject,
} from './federated';

export { promqlApi } from './promql';
export type { PromqlSeries } from './promql';

// Path helpers: the member-cluster segment placement lives in one place (see `paths.ts`).
export { clusterScoped, corePath } from './paths';
