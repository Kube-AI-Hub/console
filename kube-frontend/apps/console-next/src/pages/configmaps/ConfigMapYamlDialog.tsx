import * as React from 'react';
import { Button, Icon, Modal, YamlEditor, cn } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { useT } from '@/i18n';

/**
 * YAML dialog, shared by create and edit.
 *
 * One component rather than two because the only difference is what the user can
 * submit: create takes any valid object, edit keeps the name fixed (renaming is a
 * different operation upstream). The editor itself is the reusable ai-kit one, so
 * every future resource gets the same highlighting and completion.
 */
export interface ConfigMapYamlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial document. For edit this is the current object. */
  initialYaml: string;
  /** Fixed name for edit mode; when set, a mismatched name is rejected. */
  lockName?: string;
  title: string;
  submitLabel: string;
  pending?: boolean;
  /** Receives the parsed object once the text is valid. */
  onSubmit: (parsed: Record<string, unknown>) => void | Promise<void>;
}

export function ConfigMapYamlDialog({
  open,
  onOpenChange,
  initialYaml,
  lockName,
  title,
  submitLabel,
  pending = false,
  onSubmit,
}: ConfigMapYamlDialogProps): React.ReactElement {
  const t = useT();
  const [text, setText] = React.useState(initialYaml);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open: the same dialog instance edits different objects over time.
  React.useEffect(() => {
    if (open) {
      setText(initialYaml);
      setError(null);
    }
  }, [open, initialYaml]);

  const submit = (): void => {
    let parsed: unknown;
    try {
      parsed = parseYaml(text);
    } catch {
      setError(t('configmaps.yaml.invalid'));
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError(t('configmaps.yaml.invalid'));
      return;
    }
    const object = parsed as Record<string, unknown>;
    const metadata = (object['metadata'] ?? {}) as Record<string, unknown>;
    if (lockName && metadata['name'] !== lockName) {
      setError(t('configmaps.validate.namePattern'));
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
    anchor.download = t('configmaps.yaml.downloadName', { name: lockName ?? 'configmap' });
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
            disabled={pending || error !== null}
            {...actionProps('configmaps:yaml-submit')}
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
                title={t('configmaps.yaml.upload')}
              >
                <Icon name="upload" size={14} />
                <input type="file" accept=".yaml,.yml" className="sr-only" onChange={upload} />
              </label>
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center rounded-ai-sm text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring"
                title={t('configmaps.yaml.download')}
                {...actionProps('configmaps:yaml-download')}
                onClick={download}
              >
                <Icon name="download" size={14} />
              </button>
            </>
          }
        />
        {error ? (
          <p role="alert" className="text-xs text-ai-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * Serialise an object for the editor.
 *
 * `noRefs` because a shared reference would otherwise become an anchor, which is
 * valid YAML but unreadable in a hand-editing dialog.
 */
export function toYaml(object: unknown): string {
  return stringifyYaml(object, { lineWidth: 0 } as Parameters<typeof stringifyYaml>[1]);
}
