import * as React from 'react';
import { Title, Subtitle, Controls, Stories } from '@storybook/blocks';

/**
 * Shared layout for component docs pages.
 *
 * Mirrors the shape of the kube-design `.mdx` docs so a reader moving between
 * the two libraries finds the same order: title, one-line summary, prop table,
 * then worked examples. Written once here because repeating the same blocks in
 * twenty files is how documentation drifts.
 */
export function ComponentDocs({
  name,
  summary,
  description,
}: {
  name: string;
  summary: string;
  description?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <Title>{name}</Title>
      <Subtitle>{summary}</Subtitle>
      <p className="mb-6 text-xs leading-5 text-ai-fg-muted">
        每个示例都可交互。右上角可切换深浅色与配色，改动会实时反映到下方画布。
      </p>
      {description ? (
        <div className="mb-6 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4 text-sm leading-6 text-ai-fg-secondary">
          {/* Deliberately not the `Description` block: that reads the component's
              source comment, which is written in English for maintainers. The
              prose here is the reader-facing summary. */}
          <div>{description}</div>
        </div>
      ) : null}

      <SectionTitle>Props</SectionTitle>
      <div className="mb-8 overflow-hidden rounded-ai-lg border border-ai-line bg-ai-surface-1">
        <Controls />
      </div>

      <SectionTitle>Examples</SectionTitle>
      {/* `Stories` prints its own "Stories" heading; the section title above
          already says the same thing, so only the list is rendered. The primary
          story stays included — it is one of the examples. */}
      <Stories title="" />
    </div>
  );
}

/** A docs page whose stories are the document; no separate primary example. */
export function ComponentDocsPage({
  name,
  summary,
  note,
}: {
  name: string;
  summary: string;
  note?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <Title>{name}</Title>
      <Subtitle>{summary}</Subtitle>
      <p className="mb-6 text-xs leading-5 text-ai-fg-muted">
        每个示例都可交互。右上角可切换深浅色与配色，改动会实时反映到下方画布。
      </p>
      {note ? (
        <div className="mb-6 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4 text-sm leading-6 text-ai-fg-secondary">
          {/* No `Description` block here: it pulls the component's source comment,
              which is written for maintainers, not readers. */}
          <div>{note}</div>
        </div>
      ) : null}
      <SectionTitle>Examples</SectionTitle>
      <Stories title="" />
    </div>
  );
}

/**
 * Prop table without examples.
 *
 * Used by components whose behaviour is better shown in a composite page than in
 * isolated canvases; the table still documents every prop.
 */
export function PropsOnly({ name, summary }: { name: string; summary: string }): React.ReactElement {
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <Title>{name}</Title>
      <Subtitle>{summary}</Subtitle>
      <SectionTitle>Props</SectionTitle>
      <div className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1">
        <Controls />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className='mb-3 border-b border-ai-line pb-1.5 text-sm font-semibold text-ai-fg [&:not(:first-child)]:mt-6'>
      {children}
    </h2>
  );
}
