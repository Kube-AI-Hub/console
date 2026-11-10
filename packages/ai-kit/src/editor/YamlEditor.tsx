import * as React from 'react';
import { cn } from '../utils/cn';
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
      {toolbar ? (
        <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 rounded-ai-sm bg-ai-bg-overlay/80 px-1 py-0.5">
          <div className="pointer-events-auto flex items-center gap-1">{toolbar}</div>
        </div>
      ) : null}
    </div>
  );
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
