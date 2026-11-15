import * as React from 'react';
import { Alert, Button, FormField, Modal, Notify, Switch } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { imageBuildersApi, type ImageBuilderDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { withRegistryPrefix } from './format';
import {
  BuilderConfigFields,
  draftErrorMessageKey,
  type ArtifactInfo,
  type BuilderDraft,
} from './ImageBuilderFormFields';
import {
  useBuilderSecrets,
  useBuilderTemplates,
  useRunBuilder,
  useUploadBinary,
} from './queries';
import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * 运行 / 重新构建.
 *
 * The old console's detail page called this "RUN": it edited the builder's config and
 * then created a new `S2iRun` — so a rebuild is a config edit plus a trigger, not a bare
 * button. That is why the same form as "create" is used here, pre-filled from the object.
 *
 * The "update workload" switch mirrors the old annotation
 * `devops.kubesphere.io/donotautoscale`: when it is on (default) the annotation is
 * removed so the controller may update the workload owning the image; switching it off
 * writes the annotation. It only appears for a builder that was created for a service
 * (`serviceName` annotation), exactly like the old form.
 */
export interface ImageBuilderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  builder: ImageBuilderDetail;
  onSaved?: () => void;
}

export function ImageBuilderConfigDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  builder,
  onSaved,
}: ImageBuilderConfigDialogProps): React.ReactElement {
  const t = useT();
  const templates = useBuilderTemplates(cluster);
  const gitSecrets = useBuilderSecrets({ cluster, namespace, type: 'kubernetes.io/basic-auth' });
  const registrySecrets = useBuilderSecrets({ cluster, namespace, type: 'kubernetes.io/dockerconfigjson' });
  const run = useRunBuilder({ cluster, namespace, name: builder.name });
  const upload = useUploadBinary({ cluster, namespace });

  const initial = React.useMemo(() => draftFromBuilder(builder), [builder]);
  const [draft, setDraft] = React.useState<BuilderDraft>(initial.draft);
  const [artifact, setArtifact] = React.useState<ArtifactInfo | null>(initial.artifact);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [updateWorkload, setUpdateWorkload] = React.useState(
    builder.annotations['devops.kubesphere.io/donotautoscale'] !== 'true',
  );
  const [repoNote, setRepoNote] = React.useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  // Re-seed whenever the dialog opens or the object is refetched underneath it.
  React.useEffect(() => {
    if (!open) return;
    setDraft(initial.draft);
    setArtifact(initial.artifact);
    setErrors({});
    setRepoNote(null);
    setUpdateWorkload(builder.annotations['devops.kubesphere.io/donotautoscale'] !== 'true');
    run.reset();
    upload.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, builder.name, builder.raw.metadata?.resourceVersion]);

  const selectedRegistry = (registrySecrets.data ?? []).find((secret) => secret.name === draft.registrySecret) ?? null;
  const repoUrl = builder.annotations['kubesphere.io/repoUrl'] ?? selectedRegistry?.repoUrl ?? '';

  const patchDraft = (patch: Partial<BuilderDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const submit = (): void => {
    // The binary artifact is part of the object, not re-typed; a missing one means the
    // object was never a working B2I builder.
    const effectiveArtifact = draft.mode === 'b2i' ? artifact : null;
    const nextErrors = validateRunDraft(draft, effectiveArtifact);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const imageName = withRegistryPrefix(draft.imageName.trim(), repoUrl);
    const environment = draft.environment
      .filter((entry) => entry.name && entry.value !== '')
      .map((entry) => ({ name: entry.name, value: entry.value }));
    const config: Record<string, unknown> = {
      builderImage: draft.builderImage,
      imageName,
      tag: draft.tag.trim() || 'latest',
      builderPullPolicy: 'if-not-present',
      ...(draft.mode === 's2i'
        ? { sourceUrl: draft.sourceUrl.trim(), revisionId: draft.revisionId.trim() || 'master' }
        : { sourceUrl: effectiveArtifact?.downloadURL ?? builder.config.sourceUrl ?? '', isBinaryURL: true }),
      ...(draft.contextDir.trim() ? { contextDir: draft.contextDir.trim() } : {}),
      ...(draft.triggerToken.trim() ? { secretCode: draft.triggerToken.trim() } : {}),
      ...(draft.gitSecret && draft.mode === 's2i' ? { gitSecretRef: { name: draft.gitSecret } } : {}),
      ...(draft.registrySecret ? { pushAuthentication: { secretRef: { name: draft.registrySecret } } } : {}),
      environment,
    };
    const annotations: Record<string, string | null> = {
      // Merge patch semantics: `null` removes the key, so the controller may update the
      // workload again. Writing `'false'` would leave an annotation the controller reads
      // as truthy.
      'devops.kubesphere.io/donotautoscale': updateWorkload ? null : 'true',
    };
    run.mutate(
      { patch: { spec: { config }, metadata: { annotations } }, startRun: true },
      {
        onSuccess: () => {
          Notify.success({ content: t('devopsProject.s2ibuilder.run.started') });
          onSaved?.();
          onOpenChange(false);
        },
      },
    );
  };

  const errorText = (field: string): string | undefined => {
    const code = errors[field];
    if (!code) return undefined;
    return t(draftErrorMessageKey(code, field) as LocaleKey);
  };

  const showUpdateWorkload = Boolean(builder.annotations['serviceName']);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('devopsProject.s2ibuilder.run.title')}
      closeAiId="image-builder-run:close"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={run.isPending || upload.isPending}
            {...actionProps('image-builder-run:cancel')}
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={run.isPending || upload.isPending || templates.isPending}
            loading={run.isPending}
            data-ai-id="image-builder-run:submit"
            onClick={submit}
          >
            {run.isPending ? t('devopsProject.s2ibuilder.run.submitting') : t('devopsProject.s2ibuilder.run.submit')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-ai-id="image-builder-run:form">
        <Alert tone="info" data-ai-id="image-builder-run:note">
          {t('devopsProject.s2ibuilder.run.note')}
        </Alert>
        <BuilderConfigFields
          idPrefix="image-builder-run"
          draft={draft}
          onChange={patchDraft}
          templates={templates.data ?? []}
          templatesLoading={templates.isPending}
          gitSecrets={gitSecrets.data ?? []}
          registrySecrets={registrySecrets.data ?? []}
          artifact={artifact}
          allowArtifactUpload
          uploading={upload.isPending}
          {...(upload.error instanceof Error ? { uploadError: upload.error.message } : {})}
          onUpload={async (file) => {
            const uploaded = await upload.mutateAsync({ file });
            const info: ArtifactInfo = {
              name: uploaded.name,
              fileName: uploaded.fileName,
              size: uploaded.size,
              downloadURL: uploaded.downloadURL,
              phase: uploaded.phase,
            };
            setArtifact(info);
            return info;
          }}
          onClearArtifact={() => setArtifact(null)}
          errors={Object.fromEntries(Object.keys(errors).map((key) => [key, errorText(key) ?? '']))}
          repoNote={repoNote}
          verifying={verifying}
          onVerifyRepo={() => {
            const url = draft.sourceUrl.trim();
            if (!url) return;
            setVerifying(true);
            void imageBuildersApi(apiClient)
              .verifyRepository({ namespace, url, ...(draft.gitSecret ? { secretName: draft.gitSecret } : {}) })
              .then((result) => {
                setRepoNote(
                  result.ok
                    ? { tone: 'success', text: t('devopsProject.s2ibuilder.create.repoCheckOk') }
                    : {
                        tone: 'warning',
                        text: t('devopsProject.s2ibuilder.create.repoCheckUnavailable', { message: result.message || '-' }),
                      },
                );
              })
              .finally(() => setVerifying(false));
          }}
          defaultAdvancedOpen
        />

        {showUpdateWorkload ? (
          <FormField
            label={t('devopsProject.s2ibuilder.run.updateWorkload')}
            hint={t('devopsProject.s2ibuilder.run.updateWorkloadHint')}
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={updateWorkload}
                onCheckedChange={setUpdateWorkload}
                aria-label={t('devopsProject.s2ibuilder.run.updateWorkload')}
                data-ai-id="image-builder-run:update-workload"
              />
              <span className="text-xs text-ai-fg-secondary">
                {t(updateWorkload ? 'devopsProject.s2ibuilder.run.updateWorkloadOn' : 'devopsProject.s2ibuilder.run.updateWorkloadOff')}
              </span>
            </div>
          </FormField>
        ) : (
          <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-run:no-service">
            {t('devopsProject.s2ibuilder.run.noService')}
          </p>
        )}

        {Object.keys(errors).length > 0 ? (
          <p role="alert" className="text-xs text-ai-danger" data-ai-id="image-builder-run:validation">
            {t('devopsProject.s2ibuilder.validate.formInvalid')}
          </p>
        ) : null}
        {run.error ? (
          <p role="alert" className="text-xs text-ai-danger" data-ai-id="image-builder-run:error">
            {run.error instanceof Error ? run.error.message : t('devopsProject.s2ibuilder.run.failed')}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** The draft a builder's stored config maps to. */
export function draftFromBuilder(builder: ImageBuilderDetail): { draft: BuilderDraft; artifact: ArtifactInfo | null } {
  const language =
    builder.annotations['languageType'] ??
    (builder.kind === 'b2i' ? 'binary' : templateLanguage(builder.config.builderImage ?? '') ?? 'java');
  const fileAnnotation = builder.annotations['kubesphere.io/file'];
  let artifact: ArtifactInfo | null = null;
  if (builder.kind === 'b2i') {
    let fileName = '';
    let size = '';
    if (fileAnnotation) {
      try {
        const parsed = JSON.parse(fileAnnotation) as { name?: string; size?: number | string };
        fileName = String(parsed.name ?? '');
        size = String(parsed.size ?? '');
      } catch {
        // An older object may carry a plain name; fall back to the URL's last segment.
      }
    }
    artifact = {
      name: builder.config.sourceUrl ?? '',
      fileName: fileName || (builder.config.sourceUrl ?? '').split('/').pop() || '-',
      size: size || '-',
      downloadURL: builder.config.sourceUrl ?? '',
    };
  }
  return {
    draft: {
      mode: builder.kind,
      language,
      builderImage: builder.config.builderImage ?? '',
      sourceUrl: builder.kind === 's2i' ? builder.config.sourceUrl ?? '' : '',
      revisionId: builder.config.revisionId ?? 'master',
      gitSecret: builder.config.gitSecretRef?.name ?? '',
      imageName: builder.config.imageName ?? '',
      tag: builder.config.tag ?? 'latest',
      registrySecret: builder.config.pushAuthentication?.secretRef?.name ?? '',
      triggerToken: builder.config.secretCode ?? '',
      contextDir: builder.config.contextDir ?? '/',
      environment: (builder.config.environment ?? []).map((entry) => ({
        name: entry.name ?? '',
        value: entry.value ?? '',
      })),
    },
    artifact,
  };
}

/** Guess the language from a template's builder image path (old objects may lack the annotation). */
function templateLanguage(builderImage: string): string | undefined {
  const lower = builderImage.toLowerCase();
  for (const language of ['java', 'nodejs', 'python', 'tomcat']) if (lower.includes(language)) return language;
  return undefined;
}

/** The run form does not re-ask for a binary artifact on a source build. */
function validateRunDraft(draft: BuilderDraft, artifact: ArtifactInfo | null): Record<string, string> {
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
  if (!draft.tag.trim()) errors['tag'] = 'required';
  if (!draft.registrySecret) errors['registrySecret'] = 'required';
  return errors;
}
