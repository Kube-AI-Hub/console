import * as React from 'react';
import { Button, Icon, Modal, cn } from '@kube-ai-hub/ui';
/*
 * The `ui/editor` subpath, not the barrel: the barrel is in the always-loaded
 * `app-shared` chunk, so re-exporting the editor there pulled CodeMirror into
 * every page's first load. This dialog is itself lazy-loaded.
 */
import { YamlEditor } from '@kube-ai-hub/ui/editor';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { parse as parseYaml } from 'yaml';
import { useT } from '@/i18n';
export { toYaml } from './yaml';

/**
 * YAML dialog, shared by create and edit for every resource.
 *
 * One component because the only difference between the two modes is what the
 * user may submit: create takes any valid object, edit keeps the name fixed
 * (renaming is a different operation upstream). The editor itself is ai-kit's,
 * so every resource gets the same highlighting and completion.
 *
 * The contract for a template is the object handed to `toYaml()`: it is what the
 * form mode would have produced, so switching modes never loses typed input.
 */
export interface YamlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial document. For edit this is the current object. */
  initialYaml: string;
  /** Fixed name for edit mode; when set, a mismatched name is rejected. */
  lockName?: string;
  title: string;
  submitLabel: string;
  /** Download file name; defaults to `<name>.yaml`. */
  fileName?: string;
  pending?: boolean;
  /** Receives the parsed object once the text is valid. */
  onSubmit: (parsed: Record<string, unknown>) => void | Promise<void>;
}

export function YamlDialog({
  open,
  onOpenChange,
  initialYaml,
  lockName,
  title,
  submitLabel,
  fileName,
  pending = false,
  onSubmit,
}: YamlDialogProps): React.ReactElement {
  const t = useT();
  const [text, setText] = React.useState(initialYaml);
  const [error, setError] = React.useState<string | null>(null);
  /** Parser feedback from the editor; separate from `error`, which is submit-time. */
  const [syntaxError, setSyntaxError] = React.useState<string | null>(null);

  // Re-seed on open: the same dialog instance edits different objects over time.
  React.useEffect(() => {
    if (open) {
      setText(initialYaml);
      setError(null);
      setSyntaxError(null);
    }
  }, [open, initialYaml]);

  const submit = (): void => {
    let parsed: unknown;
    try {
      parsed = parseYaml(text);
    } catch {
      setError(t('yaml.invalid'));
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError(t('yaml.invalid'));
      return;
    }
    const object = parsed as Record<string, unknown>;
    const metadata = (object['metadata'] ?? {}) as Record<string, unknown>;
    if (lockName && metadata['name'] !== lockName) {
      // Not "invalid name": the name is well-formed, it just may not change.
      // Telling the reader their name is invalid when the real problem is that
      // renaming is unsupported sends them editing the wrong thing.
      setError(t('yaml.nameLocked', { name: lockName }));
      return;
    }
    setError(null);
    void onSubmit(object);
  };

  const download = (): void => {
    const blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName ?? `${lockName ?? 'object'}.yaml`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
    // Clear so choosing the same file twice still fires a change.
    event.target.value = '';
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={pending || error !== null || syntaxError !== null}
            {...actionProps('yaml:submit')}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <YamlEditor
          value={text}
          onChange={setText}
          /*
           * A document that does not parse cannot be submitted, and saying so
           * before the click is the difference between a form that guides and one
           * that rejects.
           */
          onValidityChange={(problem) => setSyntaxError(problem)}
          height="52vh"
          ariaLabel={title}
          toolbar={
            <>
              <label
                className={cn(
                  'inline-flex size-7 cursor-pointer items-center justify-center rounded-ai-sm text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
                  // The focusable element is the visually hidden file input, so the
                  // ring has to be drawn by the label on its behalf.
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ai-ring',
                )}
                title={t('yaml.upload')}
              >
                <Icon name="upload" size={14} />
                <input type="file" accept=".yaml,.yml" className="sr-only" onChange={upload} />
              </label>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-ai-sm text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring"
                title={t('yaml.download')}
                {...actionProps('yaml:download')}
                onClick={download}
              >
                <Icon name="download" size={14} />
              </button>
            </>
          }
        />
        {error ?? syntaxError ? (
          <p role="alert" className="text-xs text-ai-danger">
            {/* A submit-time message is more specific, so it wins. */}
            {error ?? t('yaml.invalid')}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Default export for `React.lazy`; see `ConfigMapYamlDialog`. */
export default YamlDialog;
