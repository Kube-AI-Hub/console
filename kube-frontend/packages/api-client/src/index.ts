export { createClient, type Client, type ClientOptions, type RequestOptions } from './client';
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
  toWorkloadSummary,
  workloadProgress,
  workloadsApi,
  workloadStatus,
  type PodStatus,
  type WorkloadAutoscaling,
  type WorkloadDetail,
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
  usersWriteApi,
  NOTIFICATION_CHANNELS,
  platformInfoApi,
  platformRoleOf,
  toNotificationChannels,
  toClusterRoleSummary,
  toUserSummary,
  toWorkspaceSummary,
  KAPIS_TENANT,
  usersApi,
  workspacesApi,
  workspacesWriteApi,
} from './access';
export type {
  AccessKind,
  AssignablePlatformRole,
  ClusterRoleSummary,
  EditableRule,
  RoleVerb,
  NotificationChannel,
  NotificationChannelKey,
  PlatformInfo,
  UserSummary,
  WorkspaceSummary,
} from './access';
export {
  KAPIS_IAM,
  isTemplateRole,
  membersApi,
  NETWORK_ISOLATE_ANNOTATION,
  networkIsolationApi,
  networkPoliciesApi,
  networkPoliciesWriteApi,
  POLICY_DIRECTIONS,
  toSelector,
  projectInfoApi,
  projectRolesWriteApi,
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
  MemberSummary,
  MembersApi,
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
  alertingRulesApi,
  severityLabel,
  toAlertingRuleSummary,
  toAlertSummary,
} from './alerting';
export type {
  AlertDetail,
  AlertSummary,
  AlertingApi,
  AlertingKind,
  AlertingRuleDetail,
  AlertingRuleSummary,
  AlertingRulesApi,
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
  toComponentSummary,
  toNamespaceSummary,
  toNodeSummary,
  toProjectGateway,
} from './storage';
export type { ComponentSummary, NamespaceSummary, NodeSummary, ProjectGateway } from './storage';
export {
  accessModeLabel,
  claimStatus,
  snapshotStatus,
  storageApi,
  storageClassExpands,
  storageClassesApi,
  toStorageClassSummary,
  toStorageDetail,
  toStorageSummary,
} from './storage';
export type { StorageApi, StorageClassSummary, StorageDetail, StorageKind, StorageSummary } from './storage';
export type {
  LOGIN_ERROR_CODES,
  LoginErrorCode,
  Session,
  SessionApi,
  SessionUser,
} from './session';
export { isLoginErrorCode, sessionApi } from './session';
export { isTokenExpired, userFromToken } from './token';
