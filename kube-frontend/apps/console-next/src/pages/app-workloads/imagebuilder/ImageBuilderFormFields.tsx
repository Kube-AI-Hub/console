import * as React from 'react';
import {
  Alert,
  Button,
  FormField,
  Icon,
  Input,
  Notify,
  Select,
  Tooltip,
} from '@kube-ai-hub/ui';
import type { S2iBuilderTemplate, S2iSecretOption } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import {
  IMAGE_NAME_PATTERN,
  TRIGGER_TOKEN_PATTERN,
  builderImageOptions,
  type BuilderImageOption,
} from './format';

/**
 * The build-settings form shared by "create" and "run again".
 *
 * Both screens edit the same `spec.config` fields; the old console shared the form
 * too (`S2IForm`/`B2IForm` were rendered by the create modal and by the rerun modal
 * with a `mode` flag). Keeping one implementation is what stops the create dialog
 * from accepting a value the rerun dialog rejects.
 */

/** What the reader has typed so far. */
export interface BuilderDraft {
  mode: 's2i' | 'b2i';
  language: string;
  builderImage: string;
  sourceUrl: string;
  revisionId: string;
  gitSecret: string;
  imageName: string;
  tag: string;
  registrySecret: string;
  triggerToken: string;
  contextDir: string;
  environment: Array<{ name: string; value: string }>;
}

export interface ArtifactInfo {
  /** The `S2iBinary` object name. */
  name: string;
  fileName: string;
  size: string;
  /** `spec.downloadURL` written by the controller after the upload. */
  downloadURL?: string;
  phase?: string;
}

export interface BuilderConfigFieldsProps {
  /** Agent handle prefix, e.g. `image-builder-create`. */
  idPrefix: string;
  draft: BuilderDraft;
  onChange: (patch: Partial<BuilderDraft>) => void;
  templates: S2iBuilderTemplate[];
  templatesLoading?: boolean;
  gitSecrets: S2iSecretOption[];
  registrySecrets: S2iSecretOption[];
  /** Present for a binary build; the uploaded artifact. */
  artifact: ArtifactInfo | null;
  onUpload?: (file: File) => Promise<ArtifactInfo>;
  uploading?: boolean;
  uploadError?: string;
  onClearArtifact?: () => void;
  /** Show the artifact uploader; the edit form keeps the existing file instead. */
  allowArtifactUpload?: boolean;
  errors: Record<string, string>;
  /** Advisory result of the repository readability check. */
  repoNote?: { tone: 'success' | 'warning'; text: string } | null;
  onVerifyRepo?: () => void;
  verifying?: boolean;
  /** Called when the selected builder image changes, so the caller can update environment defaults. */
  onBuilderImageChange?: (option: BuilderImageOption) => void;
  /** Leave the advanced block open (used by tests and by the edit form). */
  defaultAdvancedOpen?: boolean;
}

/** The framework icon the old console showed next to a language. */
const LANGUAGE_ICONS: Record<string, string> = {
  java: 'java',
  nodejs: 'nodejs',
  python: 'python',
  jar: 'jar',
  war: 'war',
  binary: 'binary',
};

export function languageIcon(value: string): string {
  return LANGUAGE_ICONS[value] ?? 'code';
}

export function BuilderConfigFields({
  idPrefix,
  draft,
  onChange,
  templates,
  templatesLoading = false,
  gitSecrets,
  registrySecrets,
  artifact,
  onUpload,
  uploading = false,
  uploadError,
  onClearArtifact,
  allowArtifactUpload = false,
  errors,
  repoNote,
  onVerifyRepo,
  verifying = false,
  onBuilderImageChange,
  defaultAdvancedOpen = false,
}: BuilderConfigFieldsProps): React.ReactElement {
  const t = useT();
  const [advancedOpen, setAdvancedOpen] = React.useState(defaultAdvancedOpen);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const imageOptions = React.useMemo(
    () => builderImageOptions(templates, draft.mode, draft.language),
    [templates, draft.mode, draft.language],
  );
  const selectedOption = imageOptions.find((option) => option.value === draft.builderImage) ?? null;
  const environmentOptions = (selectedOption?.environment ?? []).map((entry) => ({
    value: entry.key ?? '',
    label: entry.key ?? '',
  }));

  const pickBuilderImage = (value: string): void => {
    onChange({ builderImage: value });
    const option = imageOptions.find((entry) => entry.value === value);
    if (option) onBuilderImageChange?.(option);
  };

  const setEnvironment = (index: number, patch: Partial<{ name: string; value: string }>): void => {
    const next = draft.environment.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry));
    onChange({ environment: next });
  };

  const addEnvironment = (): void => {
    const used = new Set(draft.environment.map((entry) => entry.name));
    const nextKey = environmentOptions.find((option) => !used.has(option.value))?.value ?? '';
    onChange({ environment: [...draft.environment, { name: nextKey, value: '' }] });
  };

  const removeEnvironment = (index: number): void => {
    onChange({ environment: draft.environment.filter((_, entryIndex) => entryIndex !== index) });
  };

  /** Optional props have to be omitted, not passed as `undefined` (exactOptionalPropertyTypes). */
  const fieldError = (key: string): { error?: string; errorAiId?: string } => {
    const message = errors[key] ?? (key === 'artifact' ? uploadError : undefined);
    return message ? { error: message, errorAiId: idPrefix + ':' + key + '-error' } : {};
  };

  const readFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUpload) return;
    const extension = file.name.slice(file.name.lastIndexOf('.') + 1);
    if (draft.language && ![draft.language, 'binary', ''].includes(extension)) {
      Notify.error({ content: t('devopsProject.s2ibuilder.create.artifactFormatError', { type: draft.language }) });
      return;
    }
    void onUpload(file);
  };

  return (
    <div className="flex flex-col gap-4" data-ai-id={idPrefix + ':fields'}>
      <FormField
        htmlFor={idPrefix + '-template'}
        label={t('devopsProject.s2ibuilder.create.template')}
        hint={t('devopsProject.s2ibuilder.create.templateHint')}
        required
        {...fieldError('builderImage')}
      >
        <Select
          id={idPrefix + '-template'}
          value={draft.builderImage}
          options={imageOptions.map((option) => ({ value: option.value, label: option.label }))}
          onValueChange={pickBuilderImage}
          placeholder={templatesLoading ? t('common.loading') : t('devopsProject.s2ibuilder.create.templatePlaceholder')}
          searchable={imageOptions.length > 8}
          data-ai-id={idPrefix + ':template'}
        />
      </FormField>

      {selectedOption?.description ? (
        <p className="text-xs leading-5 text-ai-fg-muted" data-ai-id={idPrefix + ':template-description'}>
          {selectedOption.description}
        </p>
      ) : null}

      {draft.mode === 's2i' ? (
        <>
          <FormField
            htmlFor={idPrefix + '-source'}
            label={t('devopsProject.s2ibuilder.create.sourceUrl')}
            hint={t('devopsProject.s2ibuilder.create.sourceUrlHint')}
            required
            {...fieldError('sourceUrl')}
          >
            <Input
              id={idPrefix + '-source'}
              value={draft.sourceUrl}
              placeholder="https://github.com/example/app.git"
              data-ai-id={idPrefix + ':source-url'}
              onChange={(event) => onChange({ sourceUrl: event.target.value })}
              onBlur={() => onVerifyRepo?.()}
            />
          </FormField>
          {repoNote ? (
            <p
              className={repoNote.tone === 'success' ? 'text-xs text-ai-success' : 'text-xs text-ai-warning'}
              data-ai-id={idPrefix + ':repo-note'}
            >
              {repoNote.text}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              htmlFor={idPrefix + '-branch'}
              label={t('devopsProject.s2ibuilder.create.branch')}
              required
              {...fieldError('revisionId')}
            >
              <Input
                id={idPrefix + '-branch'}
                value={draft.revisionId}
                placeholder="master"
                data-ai-id={idPrefix + ':branch'}
                onChange={(event) => onChange({ revisionId: event.target.value })}
              />
            </FormField>
            <FormField
              htmlFor={idPrefix + '-git-secret'}
              label={t('devopsProject.s2ibuilder.create.gitSecret')}
              hint={t('devopsProject.s2ibuilder.create.gitSecretHint')}
            >
              <Select
                id={idPrefix + '-git-secret'}
                value={draft.gitSecret}
                options={[
                  { value: '__none__', label: t('devopsProject.s2ibuilder.create.gitSecretNone') },
                  ...gitSecrets.map((secret) => ({ value: secret.name, label: secret.name })),
                ]}
                onValueChange={(value) => onChange({ gitSecret: value === '__none__' ? '' : value })}
                placeholder={t('devopsProject.s2ibuilder.create.gitSecretPlaceholder')}
                data-ai-id={idPrefix + ':git-secret'}
              />
            </FormField>
          </div>
        </>
      ) : (
        <FormField
          label={t('devopsProject.s2ibuilder.create.artifact')}
          hint={t('devopsProject.s2ibuilder.create.artifactHint')}
          required
          {...fieldError('artifact')}
        >
          <div className="flex flex-wrap items-center gap-2" data-ai-id={idPrefix + ':artifact'}>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              data-ai-id={idPrefix + ':artifact-input'}
              onChange={readFile}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={uploading}
              loading={uploading}
              {...{ 'data-ai-id': idPrefix + ':artifact-upload' }}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? t('devopsProject.s2ibuilder.create.artifactUploading') : t('devopsProject.s2ibuilder.create.artifactUpload')}
            </Button>
            {artifact ? (
              <span className="flex items-center gap-2 text-xs text-ai-fg-secondary" data-ai-id={idPrefix + ':artifact-info'}>
                <Icon name="file" size={14} />
                <span className="font-mono">{artifact.fileName}</span>
                <span>{artifact.size}</span>
                {onClearArtifact && allowArtifactUpload ? (
                  <Button size="sm" variant="ghost" data-ai-id={idPrefix + ':artifact-clear'} onClick={onClearArtifact}>
                    {t('devopsProject.s2ibuilder.create.artifactClear')}
                  </Button>
                ) : null}
              </span>
            ) : null}
          </div>
        </FormField>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          htmlFor={idPrefix + '-image-name'}
          label={t('devopsProject.s2ibuilder.create.imageName')}
          hint={t('devopsProject.s2ibuilder.create.imageNameHint')}
          required
          {...fieldError('imageName')}
        >
          <Input
            id={idPrefix + '-image-name'}
            value={draft.imageName}
            placeholder="my-app"
            data-ai-id={idPrefix + ':image-name'}
            onChange={(event) => onChange({ imageName: event.target.value })}
          />
        </FormField>
        <FormField
          htmlFor={idPrefix + '-tag'}
          label={t('devopsProject.s2ibuilder.create.tag')}
          required
          {...fieldError('tag')}
        >
          <Input
            id={idPrefix + '-tag'}
            value={draft.tag}
            placeholder="latest"
            data-ai-id={idPrefix + ':tag'}
            onChange={(event) => onChange({ tag: event.target.value })}
          />
        </FormField>
      </div>

      <FormField
        htmlFor={idPrefix + '-registry'}
        label={t('devopsProject.s2ibuilder.create.registrySecret')}
        hint={t('devopsProject.s2ibuilder.create.registrySecretHint')}
        required
        {...fieldError('registrySecret')}
      >
        <Select
          id={idPrefix + '-registry'}
          value={draft.registrySecret}
          options={registrySecrets.map((secret) => ({
            value: secret.name,
            label: secret.repoUrl ? secret.name + ' · ' + secret.repoUrl : secret.name,
          }))}
          onValueChange={(value) => onChange({ registrySecret: value })}
          placeholder={t('devopsProject.s2ibuilder.create.registrySecretPlaceholder')}
          data-ai-id={idPrefix + ':registry'}
        />
      </FormField>

      <div className="rounded-ai-md border border-ai-line">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          aria-expanded={advancedOpen}
          data-ai-id={idPrefix + ':advanced-toggle'}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <span>{t('devopsProject.s2ibuilder.create.advanced')}</span>
          <Icon name={advancedOpen ? 'chevron-up' : 'chevron-down'} size={14} />
        </Button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t border-ai-line p-4" data-ai-id={idPrefix + ':advanced'}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                htmlFor={idPrefix + '-token'}
                label={t('devopsProject.s2ibuilder.create.triggerToken')}
                hint={t('devopsProject.s2ibuilder.create.triggerTokenHint')}
                {...fieldError('triggerToken')}
              >
                <Input
                  id={idPrefix + '-token'}
                  value={draft.triggerToken}
                  data-ai-id={idPrefix + ':trigger-token'}
                  onChange={(event) => onChange({ triggerToken: event.target.value })}
                />
              </FormField>
              {draft.mode === 's2i' ? (
                <FormField
                  htmlFor={idPrefix + '-context-dir'}
                  label={t('devopsProject.s2ibuilder.create.contextDir')}
                  hint={t('devopsProject.s2ibuilder.create.contextDirHint')}
                >
                  <Input
                    id={idPrefix + '-context-dir'}
                    value={draft.contextDir}
                    placeholder="/"
                    data-ai-id={idPrefix + ':context-dir'}
                    onChange={(event) => onChange({ contextDir: event.target.value })}
                  />
                </FormField>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ai-fg-secondary">
                  {t('devopsProject.s2ibuilder.create.environment')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={environmentOptions.length === 0 || draft.environment.length >= environmentOptions.length}
                  {...{ 'data-ai-id': idPrefix + ':env-add' }}
                  onClick={addEnvironment}
                >
                  {t('devopsProject.s2ibuilder.create.environmentAdd')}
                </Button>
              </div>
              <p className="text-[11px] text-ai-fg-muted">{t('devopsProject.s2ibuilder.create.environmentHint')}</p>
              {environmentOptions.length === 0 ? (
                <p className="text-xs text-ai-fg-muted" data-ai-id={idPrefix + ':env-empty'}>
                  {t('devopsProject.s2ibuilder.create.environmentOptionsEmpty')}
                </p>
              ) : null}
              {draft.environment.map((entry, index) => (
                <div key={index} className="flex items-end gap-2" data-ai-id={idPrefix + ':env-row:' + index}>
                  <div className="w-1/2">
                    <Select
                      value={entry.name}
                      options={environmentOptions}
                      onValueChange={(value) => setEnvironment(index, { name: value })}
                      placeholder={t('devopsProject.s2ibuilder.create.environmentKey')}
                      data-ai-id={idPrefix + ':env-key:' + index}
                    />
                  </div>
                  <Input
                    aria-label={t('devopsProject.s2ibuilder.create.environmentValue')}
                    value={entry.value}
                    placeholder={t('devopsProject.s2ibuilder.create.environmentValue')}
                    data-ai-id={idPrefix + ':env-value:' + index}
                    onChange={(event) => setEnvironment(index, { value: event.target.value })}
                  />
                  <Tooltip content={t('devopsProject.s2ibuilder.create.environmentRemove')}>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('devopsProject.s2ibuilder.create.environmentRemove')}
                      data-ai-id={idPrefix + ':env-remove:' + index}
                      onClick={() => removeEnvironment(index)}
                    >
                      <Icon name="close" size={14} />
                    </Button>
                  </Tooltip>
                </div>
              ))}
              {errors['environment'] ? (
                <p role="alert" className="text-xs text-ai-danger" data-ai-id={idPrefix + ':env-error'}>
                  {errors['environment']}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {verifying ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id={idPrefix + ':repo-checking'}>
          {t('devopsProject.s2ibuilder.create.repoChecking')}
        </p>
      ) : null}

      {registrySecrets.length === 0 ? (
        <Alert tone="info" data-ai-id={idPrefix + ':registry-empty'}>
          {t('devopsProject.s2ibuilder.create.registryEmptyHint')}
        </Alert>
      ) : null}
    </div>
  );
}

/** Validate one draft. Returns field errors keyed the same way the form shows them. */
export function validateDraft(draft: BuilderDraft, artifact: ArtifactInfo | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.builderImage) errors['builderImage'] = 'required';
  if (draft.mode === 's2i') {
    if (!draft.sourceUrl.trim()) errors['sourceUrl'] = 'required';
    else if (!/^(https?:\/\/|git@)/.test(draft.sourceUrl.trim())) errors['sourceUrl'] = 'url';
    if (!draft.revisionId.trim()) errors['revisionId'] = 'required';
  } else if (!artifact) {
    errors['artifact'] = 'required';
  }
  if (!draft.imageName.trim()) errors['imageName'] = 'required';
  else if (!IMAGE_NAME_PATTERN.test(draft.imageName.trim())) errors['imageName'] = 'pattern';
  if (!draft.tag.trim()) errors['tag'] = 'required';
  if (!draft.registrySecret) errors['registrySecret'] = 'required';
  if (draft.triggerToken.trim() && !TRIGGER_TOKEN_PATTERN.test(draft.triggerToken.trim())) errors['triggerToken'] = 'pattern';
  for (const entry of draft.environment) {
    if (!entry.name) errors['environment'] = 'key';
    else if (entry.value === '') errors['environment'] = 'value';
  }
  return errors;
}

/** Build the `S2iBuilder` object the API expects from one draft. */
export function toBuilderBody(params: {
  draft: BuilderDraft;
  artifact: ArtifactInfo | null;
  namespace: string;
  imageName: string;
  builderImageOption: BuilderImageOption | null;
  repoUrl: string;
  builderName: string;
}): Record<string, unknown> {
  const { draft, artifact, namespace, imageName, repoUrl, builderName } = params;
  const environment = draft.environment
    .filter((entry) => entry.name && entry.value !== '')
    .map((entry) => ({ name: entry.name, value: entry.value }));
  const annotations: Record<string, string> = { languageType: draft.language };
  if (repoUrl) annotations['kubesphere.io/repoUrl'] = repoUrl;
  if (draft.mode === 'b2i' && artifact) annotations['kubesphere.io/file'] = JSON.stringify({ name: artifact.fileName, size: artifact.size });

  const config: Record<string, unknown> = {
    replicas: 0,
    export: true,
    outputBuildResult: true,
    builderPullPolicy: 'if-not-present',
    builderImage: draft.builderImage,
    imageName,
    tag: draft.tag.trim() || 'latest',
    ...(draft.contextDir.trim() ? { contextDir: draft.contextDir.trim() } : {}),
    ...(draft.triggerToken.trim() ? { secretCode: draft.triggerToken.trim() } : {}),
    ...(draft.gitSecret && draft.mode === 's2i' ? { gitSecretRef: { name: draft.gitSecret } } : {}),
    ...(draft.registrySecret ? { pushAuthentication: { secretRef: { name: draft.registrySecret } } } : {}),
    ...(environment.length ? { environment } : {}),
  };
  if (draft.mode === 's2i') {
    config.sourceUrl = draft.sourceUrl.trim();
    config.revisionId = draft.revisionId.trim() || 'master';
  } else {
    config.isBinaryURL = true;
    // The binary's source URL is the controller-assigned download URL; the object name is
    // not readable by the builder.
    config.sourceUrl = artifact?.downloadURL ?? '';
  }
  if (params.builderImageOption) {
    for (const [key, value] of Object.entries(params.builderImageOption.extraConfig)) {
      if (key === 'builderImage') continue;
      config[key] = value;
    }
  }

  return {
    apiVersion: 'devops.kubesphere.io/v1alpha1',
    kind: 'S2iBuilder',
    metadata: {
      name: builderName,
      namespace,
      labels: { 'controller-tools.k8s.io': '1.0', 's2i-type.kubesphere.io': draft.mode },
      annotations,
    },
    spec: { config },
  };
}

/** Map a validation code to the message the field shows. */
export function draftErrorMessageKey(code: string, field: string): string {
  if (code === 'required') return 'devopsProject.s2ibuilder.validate.required';
  if (code === 'url') return 'devopsProject.s2ibuilder.validate.repoUrl';
  if (code === 'pattern') {
    return field === 'triggerToken'
      ? 'devopsProject.s2ibuilder.validate.triggerToken'
      : 'devopsProject.s2ibuilder.validate.imageName';
  }
  if (code === 'key') return 'devopsProject.s2ibuilder.validate.environmentKey';
  if (code === 'value') return 'devopsProject.s2ibuilder.validate.environmentValue';
  return 'devopsProject.s2ibuilder.validate.required';
}
