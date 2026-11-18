import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { depthOf, fieldsFor, lastSegment } from './k8s-fields';

/**
 * A general-purpose YAML editor.
 *
 * Built once here because every resource page needs the same thing: show YAML,
 * highlight it, complete the fields people actually mistype, and refuse to submit
 * something that will not parse. The old console used Ace for this
 * (`console/src/components/Base/CodeEditor/AceEditor.jsx`); this version uses
 * CodeMirror 6, which is smaller and needs no separate worker bundle for YAML.
 *
 * CodeMirror is loaded lazily so the list page does not pay for an editor that is
 * only opened from a dialog.
 */

const CodeMirrorEditor = React.lazy(() => import('./YamlEditorImpl'));

export interface YamlEditorProps {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  /** Reports the first parse error, or `null` when the document is valid. */
  onValidityChange?: (error: string | null) => void;
  /**
   * Slot for host actions (upload, download, format). Rendered in the bottom-right
   * corner, matching the old console's placement.
   */
  toolbar?: React.ReactNode;
  className?: string;
  /** Editor height; the container scrolls internally. */
  height?: string;
  /** Accessible name; defaults to a generic label. */
  ariaLabel?: string;
  /**
   * Copy the document to the clipboard from inside the editor.
   *
   * On by default: copying YAML is the one action every host wants (viewing an
   * object, fixing a manifest, pasting it into `kubectl`), and asking each of the
   * seven call sites to wire the same button is how they end up inconsistent. A
   * host that has no clipboard — or wants the corner to itself — turns it off.
   */
  copyable?: boolean;
  /** Label on the copy button, e.g. the host's translated "copy". */
  copyLabel?: string;
  /** Label shown briefly after a successful copy. */
  copiedLabel?: string;
}

/**
 * Mount point for the lazy editor.
 *
 * Kept separate from the CodeMirror code so that importing this module from a
 * page does not pull the editor into the main chunk.
 */
export function YamlEditor({
  value,
  onChange,
  readOnly = false,
  onValidityChange,
  toolbar,
  className,
  height = '420px',
  ariaLabel = 'YAML',
  copyable = true,
  copyLabel = '复制',
  copiedLabel = '已复制',
}: YamlEditorProps): React.ReactElement {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    onValidityChange?.(error);
  }, [error, onValidityChange]);

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-ai-md border border-ai-line bg-ai-bg-elevated',
        className,
      )}
      style={{ height }}
    >
      <React.Suspense fallback={<EditorSkeleton />}>
        <CodeMirrorEditor
          value={value}
          readOnly={readOnly}
          ariaLabel={ariaLabel}
          onChange={(next) => onChange?.(next)}
          onParseError={setError}
        />
      </React.Suspense>
      {toolbar || copyable ? (
        <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 rounded-ai-sm bg-ai-bg-overlay/80 px-1 py-0.5">
          <div className="pointer-events-auto flex items-center gap-1">
            {toolbar}
            {copyable ? <CopyButton value={value} label={copyLabel} copiedLabel={copiedLabel} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Copies the whole document, and says so.
 *
 * `navigator.clipboard` only exists on secure origins, and the lab clusters serve
 * this console over plain HTTP on an IP — there the promise is `undefined` rather
 * than rejecting, so calling it blind left the button doing nothing at all. The
 * `execCommand` path is the fallback those origins do support.
 */
function CopyButton({ value, label, copiedLabel }: {
  value: string; label: string; copiedLabel: string;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (): Promise<void> => {
    if (!(await writeClipboard(value))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void copy()}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      data-ai-id="yaml:copy"
      data-ai-copied={copied ? 'true' : undefined}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}

/** Writes text to the clipboard; `false` when neither mechanism worked. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied or insecure origin; fall through to the legacy path.
  }
  try {
    /*
     * A hidden textarea rather than the editor's own selection: this button
     * copies the whole document regardless of what the reader has highlighted.
     */
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function EditorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-2 p-3" aria-hidden="true">
      {[72, 56, 64, 44].map((width, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-ai-sm bg-ai-surface-2"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

/** Re-exported for hosts that need to reason about indentation themselves. */
export { depthOf, fieldsFor, lastSegment };
