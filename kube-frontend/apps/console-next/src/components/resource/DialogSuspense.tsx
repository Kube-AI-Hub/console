import * as React from 'react';
import { cn } from '@kube-ai-hub/ui';

/**
 * Suspense boundary for a lazily-imported dialog.
 *
 * The editor dialog is 188 KB gzip of CodeMirror; it is imported on demand so no
 * list page pays for it (DEC-CORE-KUBE_FRONTEND-04). The fallback is what the
 * reader sees between clicking "编辑 YAML" and the dialog appearing.
 *
 * First open only: the chunk is cached and `React.lazy` caches the resolved
 * module, so later opens render synchronously.
 */
export function LazyDialogFallback(): React.ReactElement {
  return (
    <div role="status" aria-label="正在加载编辑器" className="flex items-center justify-center py-8 text-ai-fg-muted">
      <svg viewBox="0 0 16 16" className="size-4 animate-spin" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function DialogSuspense({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return (
    <React.Suspense fallback={<LazyDialogFallback />}>
      <div className={cn(className)}>{children}</div>
    </React.Suspense>
  );
}
