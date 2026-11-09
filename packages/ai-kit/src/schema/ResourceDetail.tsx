import * as React from 'react';
import { cn } from '../utils/cn';
import { Badge, Card, CardContent, Panel } from '../primitives/Display';
import { getByPath } from './registry';

/* ---------------- Types ---------------- */

export interface DetailField<TRow> {
  key: string;
  label: React.ReactNode;
  /** Built-in presentation; defaults to plain text. */
  type?: 'text' | 'status' | 'tags' | 'link' | 'code';
  /** Escape hatch; takes precedence over `type`. */
  render?: (row: TRow) => React.ReactNode;
  /** Span the full row of a two-column grid. */
  wide?: boolean;
  /** Hide the field when the value is empty. */
  hideEmpty?: boolean;
}

export interface DetailSection<TRow> {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  fields?: Array<DetailField<TRow>>;
  /** Custom body; when present, `fields` is ignored. */
  render?: (row: TRow) => React.ReactNode;
}

export interface DetailSchema<TRow> {
  header: {
    title: (row: TRow) => React.ReactNode;
    subtitle?: (row: TRow) => React.ReactNode;
    status?: (row: TRow) => { label: string; tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger' };
    /** Rendered at the right edge of the header. */
    actions?: (row: TRow) => React.ReactNode;
  };
  /** Summary cards above the sections. */
  stats?: Array<{ key: string; label: React.ReactNode; value: (row: TRow) => React.ReactNode }>;
  sections: Array<DetailSection<TRow>>;
}

export interface ResourceDetailProps<TRow> {
  schema: DetailSchema<TRow>;
  data: TRow;
  loading?: boolean;
  className?: string;
}

/* ---------------- Field rendering ---------------- */

function renderFieldValue<TRow>(field: DetailField<TRow>, row: TRow): React.ReactNode {
  if (field.render) return field.render(row);
  const value = getByPath(row, field.key);
  if (value === undefined || value === null || value === '') return <span className="text-ai-fg-faint">-</span>;

  switch (field.type) {
    case 'status':
      return <Badge tone="info" dot>{String(value)}</Badge>;
    case 'tags': {
      const items = Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
      return (
        <span className="flex flex-wrap gap-1">
          {items.map((item) => (
            <Badge key={String(item)} tone="neutral">{String(item)}</Badge>
          ))}
        </span>
      );
    }
    case 'link':
      return <span className="break-all text-ai-accent">{String(value)}</span>;
    case 'code':
      return (
        <code className="break-all rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 font-ai-mono text-[11px] text-ai-fg-secondary">
          {String(value)}
        </code>
      );
    default:
      return <span className="break-words">{String(value)}</span>;
  }
}

function isEmptyValue<TRow>(field: DetailField<TRow>, row: TRow): boolean {
  if (field.render) return false;
  const value = getByPath(row, field.key);
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/* ---------------- Component ---------------- */

export function ResourceDetail<TRow>({ schema, data, loading = false, className }: ResourceDetailProps<TRow>): React.ReactElement {
  if (loading) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="h-16 animate-pulse rounded-ai-lg bg-ai-surface-2" />
        <div className="h-40 animate-pulse rounded-ai-lg bg-ai-surface-2" />
      </div>
    );
  }

  const status = schema.header.status?.(data);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-ai-fg">{schema.header.title(data)}</h1>
            {status ? <Badge tone={status.tone ?? 'neutral'} dot>{status.label}</Badge> : null}
          </div>
          {schema.header.subtitle ? (
            <p className="mt-1 text-xs text-ai-fg-muted">{schema.header.subtitle(data)}</p>
          ) : null}
        </div>
        {schema.header.actions ? <div className="flex shrink-0 gap-2">{schema.header.actions(data)}</div> : null}
      </header>

      {schema.stats?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {schema.stats.map((stat) => (
            <Card key={stat.key} interactive>
              <CardContent className="pt-3">
                <p className="text-[11px] text-ai-fg-muted">{stat.label}</p>
                <p className="mt-1 truncate text-lg font-semibold text-ai-fg">{stat.value(data)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {schema.sections.map((section) => (
        <Panel key={section.id} title={section.title} description={section.description}>
          {section.render ? (
            section.render(data)
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {(section.fields ?? []).map((field) => {
                if (field.hideEmpty && isEmptyValue(field, data)) return null;
                return (
                  <div key={field.key} className={cn('min-w-0', field.wide && 'sm:col-span-2')}>
                    <dt className="text-[11px] text-ai-fg-muted">{field.label}</dt>
                    <dd className="mt-0.5 text-xs text-ai-fg-secondary">{renderFieldValue(field, data)}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </Panel>
      ))}
    </div>
  );
}
