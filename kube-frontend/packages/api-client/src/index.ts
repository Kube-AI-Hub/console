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
export type {
  LOGIN_ERROR_CODES,
  LoginErrorCode,
  Session,
  SessionApi,
  SessionUser,
} from './session';
export { isLoginErrorCode, sessionApi } from './session';
export { isTokenExpired, userFromToken } from './token';
