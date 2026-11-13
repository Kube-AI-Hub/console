import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';

/**
 * One label/value pair in a detail page's definition list.
 *
 * Eight detail pages had their own copy of this, and they had already drifted: some
 * printed the value in the primary text colour, others in the secondary one, and the
 * wrapping rule differed. The same kind of fact therefore looked different depending on
 * which resource you were reading.
 */
export interface DefinitionRowProps {
  label: string;
  value: string;
  /** Agent handle for the value, when automation needs to read exactly this field. */
  aiId?: string;
}

export function DefinitionRow({ label, value, aiId }: DefinitionRowProps): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ai-fg-secondary" {...(aiId ? actionProps(aiId) : {})}>
        {value}
      </dd>
    </>
  );
}
