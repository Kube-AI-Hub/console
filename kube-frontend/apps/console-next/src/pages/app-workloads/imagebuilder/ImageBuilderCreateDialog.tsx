import * as React from 'react';
import { Alert, Button, FormField, Icon, Modal, Notify } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { imageBuildersApi } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import {
  builderImageOptions,
  buildLanguages,
  defaultBuilderImage,
  generatedBuilderName,
  withRegistryPrefix,
} from './format';
import {
  BuilderConfigFields,
  draftErrorMessageKey,
  toBuilderBody,
  validateDraft,
  type ArtifactInfo,
  type BuilderDraft,
} from './ImageBuilderFormFields';
import {
  useBuilderSecrets,
  useBuilderTemplates,
  useCreateBuilder,
  useUploadBinary,
} from './queries';

/**
 * 创建镜像构建器.
 *
 * The old console made this a two-step wizard: pick the build mode and language, then
 * fill the build settings. Both steps are kept because the second one is long and the
 * language decides which template list (and which artifact extension) is valid.
 *
 * The submit creates the `S2iBuilder` and then one `S2iRun` — exactly what the old
 * store did; a builder without a first run would make the operator wait for a manual
 * trigger that the UI does not offer on this page.
 */
export interface ImageBuilderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  onCreated?: (name: string) => void;
}

const REPO_URL_PATTERN = /^(https?:\/\/|git@)/;

export function ImageBuilderCreateDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  onCreated,
}: ImageBuilderCreateDialogProps): React.ReactElement {
  const t = useT();
  const templates = useBuilderTemplates(cluster);
  const gitSecrets = useBuilderSecrets({ cluster, namespace, type: 'kubernetes.io/basic-auth' });
  const registrySecrets = useBuilderSecrets({ cluster, namespace, type: 'kubernetes.io/dockerconfigjson' });
  const create = useCreateBuilder({ cluster, namespace });
  const upload = useUploadBinary({ cluster, namespace });

  const [step, setStep] = React.useState<1 | 2>(1);
  const [mode, setMode] = React.useState<'s2i' | 'b2i'>('s2i');
  const [language, setLanguage] = React.useState('java');
  const [draft, setDraft] = React.useState<BuilderDraft>(() => emptyDraft('s2i', 'java'));
  const [artifact, setArtifact] = React.useState<ArtifactInfo | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [repoNote, setRepoNote] = React.useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  // Reset the whole wizard each time it opens: a cancelled attempt must not leave its
  // input behind for the next one, the same rule the delete dialog follows.
  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setMode('s2i');
    setLanguage('java');
    setDraft(emptyDraft('s2i', 'java'));
    setArtifact(null);
    setErrors({});
    setRepoNote(null);
    create.reset();
    upload.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const templateList = templates.data ?? [];
  const languages = React.useMemo(() => buildLanguages(templateList), [templateList]);
  const languageOptions = mode === 's2i' ? languages.s2i : languages.b2i;
  const imageOptions = React.useMemo(
    () => builderImageOptions(templateList, mode, language),
    [templateList, mode, language],
  );

  // The builder image is chosen by (mode, language) before the reader reaches step 2;
  // without seeding it the template select would open empty.
  React.useEffect(() => {
    if (!open || templates.isPending) return;
    const fallback = defaultBuilderImage(imageOptions, templateList, language);
    setDraft((current) => {
      if (current.mode === mode && current.language === language && imageOptions.some((option) => option.value === current.builderImage)) {
        return current;
      }
      return { ...current, mode, language, builderImage: fallback };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, language, templates.isPending, templateList.length, imageOptions.length]);

  // Keep the language valid when the reader switches between source and binary mode.
  React.useEffect(() => {
    if (!languageOptions.some((option) => option.value === language)) {
      const next = languageOptions[0]?.value ?? '';
      setLanguage(next);
      setDraft((current) => ({ ...current, mode, language: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, languageOptions.length]);

  const patchDraft = (patch: Partial<BuilderDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const seedBuilderImage = (nextMode: 's2i' | 'b2i', nextLanguage: string): string => {
    const options = builderImageOptions(templateList, nextMode, nextLanguage);
    return defaultBuilderImage(options, templateList, nextLanguage);
  };

  const chooseMode = (nextMode: 's2i' | 'b2i'): void => {
    setMode(nextMode);
    const first = nextMode === 's2i' ? languages.s2i[0]?.value ?? 'java' : languages.b2i[0]?.value ?? 'jar';
    setLanguage(first);
    setDraft((current) => ({ ...current, mode: nextMode, language: first, builderImage: seedBuilderImage(nextMode, first) }));
    setRepoNote(null);
    setArtifact(null);
    setErrors({});
  };

  const chooseLanguage = (value: string): void => {
    setLanguage(value);
    setDraft((current) => ({ ...current, language: value, builderImage: seedBuilderImage(mode, value) }));
  };

  const selectedImageOption = imageOptions.find((option) => option.value === draft.builderImage) ?? null;
  const selectedRegistry = (registrySecrets.data ?? []).find((secret) => secret.name === draft.registrySecret) ?? null;

  const verifyRepo = async (): Promise<void> => {
    const url = draft.sourceUrl.trim();
    if (!url || !REPO_URL_PATTERN.test(url)) {
      setRepoNote(null);
      return;
    }
    setVerifying(true);
    try {
      const result = await imageBuildersApi(apiClient).verifyRepository({
        namespace,
        url,
        ...(draft.gitSecret ? { secretName: draft.gitSecret } : {}),
      });
      if (result.ok) {
        setRepoNote({ tone: 'success', text: t('devopsProject.s2ibuilder.create.repoCheckOk') });
      } else {
        // The check endpoint answers 500 on this installation; the note says so instead of
        // claiming the repository is unreadable, and the form stays submittable.
        setRepoNote({
          tone: 'warning',
          text: t('devopsProject.s2ibuilder.create.repoCheckUnavailable', { message: result.message || '-' }),
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  const submit = (): void => {
    const nextErrors = validateDraft(draft, artifact);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const imageName = withRegistryPrefix(draft.imageName.trim(), selectedRegistry?.repoUrl ?? '');
    const body = toBuilderBody({
      draft,
      artifact,
      namespace,
      imageName,
      builderImageOption: selectedImageOption,
      repoUrl: selectedRegistry?.repoUrl ?? '',
      builderName: generatedBuilderName(imageName, draft.tag.trim()),
    });
    create.mutate(
      { body, startRun: true },
      {
        onSuccess: (created) => {
          Notify.success({ content: t('devopsProject.s2ibuilder.create.succeeded', { name: created.name }) });
          onCreated?.(created.name);
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

  const stepOneValid = Boolean(mode) && Boolean(language);
  const canSubmit = !create.isPending && !upload.isPending && !templates.isPending && templateList.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('devopsProject.s2ibuilder.create.title')}
      closeAiId="image-builder-create:close"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ai-fg-muted">{t('devopsProject.s2ibuilder.create.step', { step })}</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={create.isPending || upload.isPending}
              {...actionProps('image-builder-create:cancel')}
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            {step === 1 ? (
              <Button
                size="sm"
                disabled={!stepOneValid || templates.isPending}
                {...actionProps('image-builder-create:next')}
                onClick={() => setStep(2)}
              >
                {t('devopsProject.s2ibuilder.create.next')}
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={create.isPending || upload.isPending}
                  {...actionProps('image-builder-create:back')}
                  onClick={() => setStep(1)}
                >
                  {t('devopsProject.s2ibuilder.create.back')}
                </Button>
                <Button
                  size="sm"
                  disabled={!canSubmit}
                  loading={create.isPending}
                  data-ai-id="image-builder-create:submit"
                  onClick={submit}
                >
                  {create.isPending ? t('devopsProject.s2ibuilder.create.submitting') : t('common.create')}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <div className="flex flex-col gap-4" data-ai-id="image-builder-create:step-mode">
          <p className="text-xs text-ai-fg-muted">{t('devopsProject.s2ibuilder.create.modeHint')}</p>
          {templates.isPending ? <p className="text-xs text-ai-fg-muted">{t('common.loading')}</p> : null}
          {templates.isError ? (
            <div className="flex flex-col items-start gap-2" data-ai-id="image-builder-create:templates-error">
              <p role="alert" className="text-xs text-ai-danger">{t('devopsProject.s2ibuilder.create.templatesFailed')}</p>
              <Button size="sm" variant="secondary" data-ai-id="image-builder-create:templates-retry" onClick={() => void templates.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
          {(['s2i', 'b2i'] as const).map((entry) => {
            const entries = entry === 's2i' ? languages.s2i : languages.b2i;
            const selectedMode = mode === entry;
            return (
              <section key={entry} className="rounded-ai-md border border-ai-line p-3" data-ai-id={'image-builder-create:mode:' + entry}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon name={entry === 's2i' ? 'code' : 'binary'} size={16} />
                  <span className="text-sm font-medium text-ai-fg">
                    {t(entry === 's2i' ? 'devopsProject.s2ibuilder.create.modeS2i' : 'devopsProject.s2ibuilder.create.modeB2i')}
                  </span>
                  <span className="text-xs text-ai-fg-muted">
                    {t(entry === 's2i' ? 'devopsProject.s2ibuilder.create.modeS2iHint' : 'devopsProject.s2ibuilder.create.modeB2iHint')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('devopsProject.s2ibuilder.create.language')}>
                  {entries.map((option) => {
                    const selected = selectedMode && language === option.value;
                    return (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={selected ? 'primary' : 'secondary'}
                        aria-pressed={selected}
                        data-ai-id={'image-builder-create:language:' + entry + ':' + option.value}
                        onClick={() => {
                          if (!selectedMode) chooseMode(entry);
                          chooseLanguage(option.value);
                        }}
                      >
                        {t(option.key as 'devopsProject.s2ibuilder.language.java')}
                      </Button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <FormField label={t('devopsProject.s2ibuilder.create.language')} required>
            <p className="text-xs text-ai-fg-secondary" data-ai-id="image-builder-create:selected-language">
              {t('devopsProject.s2ibuilder.create.selectedMode', {
                mode: t(mode === 's2i' ? 'devopsProject.s2ibuilder.create.modeS2i' : 'devopsProject.s2ibuilder.create.modeB2i'),
                language: t(('devopsProject.s2ibuilder.language.' + language) as 'devopsProject.s2ibuilder.language.java'),
              })}
            </p>
          </FormField>
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-ai-id="image-builder-create:step-settings">
          <Alert tone="info" data-ai-id="image-builder-create:run-note">
            {t('devopsProject.s2ibuilder.create.runNote')}
          </Alert>
          <BuilderConfigFields
            idPrefix="image-builder-create"
            draft={draft}
            onChange={patchDraft}
            templates={templateList}
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
              setErrors((current) => {
                const next = { ...current };
                delete next['artifact'];
                return next;
              });
              return info;
            }}
            onClearArtifact={() => {
              setArtifact(null);
              upload.reset();
            }}
            errors={{
              ...Object.fromEntries(Object.keys(errors).map((key) => [key, errorText(key) ?? ''])),
            }}
            repoNote={repoNote}
            onVerifyRepo={() => void verifyRepo()}
            verifying={verifying}
          />
          {Object.keys(errors).length > 0 ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="image-builder-create:validation">
              {t('devopsProject.s2ibuilder.validate.formInvalid')}
            </p>
          ) : null}
          {create.error ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="image-builder-create:submit-error">
              {create.error instanceof Error ? create.error.message : t('devopsProject.s2ibuilder.create.failed')}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function emptyDraft(mode: 's2i' | 'b2i', language: string): BuilderDraft {
  return {
    mode,
    language,
    builderImage: '',
    sourceUrl: '',
    revisionId: 'master',
    gitSecret: '',
    imageName: '',
    tag: 'latest',
    registrySecret: '',
    triggerToken: '',
    contextDir: '/',
    environment: [],
  };
}

