import * as React from 'react';
import type { NodeTaint } from '@kube-ai-hub/api-client';
import { Button, Icon, Input, Select, Tooltip } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { TAINT_EFFECTS, taintId } from './nodeTaints';

/**
 * Row editor for a taint list.
 *
 * The detail dialog edits taints as YAML because it is replacing one object's whole
 * array and the reader may want to paste one. Bulk editing is different: the same
 * operation is repeated across nodes, so the control has to make "which row am I
 * changing" obvious and must not require the reader to hand-write YAML N times.
 *
 * Rows are keyed by index, not by `key`+`effect`: a row's identity changes while the
 * reader types its key, and keying by content would remount the input and lose focus
 * on every keystroke.
 */
export function TaintEditor({ value, onChange, disabled, aiId = 'node-taints' }: {
  value: NodeTaint[];
  onChange: (next: NodeTaint[]) => void;
  disabled?: boolean;
  /**
   * Handle prefix, rendered on the editor and each row.
   *
   * The bulk dialog shows one editor per node, so a page-level handle is ambiguous:
   * `[data-ai-id="node-taints:row:0"]` matches once per node. A caller that renders
   * several passes its own prefix, and automation can address one node's list.
   */
  aiId?: string;
}): React.ReactElement {
  const t = useT();
  const effects = TAINT_EFFECTS.map((effect) => ({ value: effect, label: t(`node.taints.effect.${effect}`) }));
  const duplicateIds = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const taint of value) seen.set(taintId(taint), (seen.get(taintId(taint)) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  }, [value]);

  const patch = (index: number, next: Partial<NodeTaint>) =>
    onChange(value.map((taint, position) => position === index ? { ...taint, ...next } : taint));

  return <div className="flex flex-col gap-2" data-ai-id={`${aiId}:editor`}>
    {value.length === 0 ? <p className="text-xs text-ai-fg-muted">{t('node.taints.none')}</p> : null}
    {value.map((taint, index) => {
      const duplicate = duplicateIds.has(taintId(taint));
      return <div key={index} className="flex flex-wrap items-start gap-2" data-ai-id={`${aiId}:row:${index}`}>
        <Input className="min-w-[8rem] flex-1" disabled={disabled} value={taint.key}
          aria-label={t('node.taints.key')} placeholder={t('node.taints.keyPlaceholder')}
          aria-invalid={duplicate || undefined}
          onChange={(event) => patch(index, { key: event.target.value })} />
        <Input className="min-w-[8rem] flex-1" disabled={disabled} value={taint.value}
          aria-label={t('node.taints.value')} placeholder={t('node.taints.valuePlaceholder')}
          onChange={(event) => patch(index, { value: event.target.value })} />
        <div className="w-44 shrink-0">
          <Select value={taint.effect} options={effects} {...(disabled === undefined ? {} : { disabled })}
            aria-label={t('node.taints.effect')} data-ai-id={`${aiId}:effect:${index}`}
            onValueChange={(effect) => patch(index, { effect })} />
        </div>
        <Tooltip content={t('node.taints.remove')}>
          <Button variant="ghost" size="icon" disabled={disabled} aria-label={t('node.taints.remove')}
            onClick={() => onChange(value.filter((_, position) => position !== index))}>
            <Icon name="trash" size={14} />
          </Button>
        </Tooltip>
        {duplicate ? <p role="alert" className="w-full text-xs text-ai-danger">
          {t('node.taints.duplicateRow', { taint: taintId(taint) })}</p> : null}
      </div>;
    })}
    <div>
      <Button variant="secondary" size="sm" disabled={disabled}
        data-ai-id={`${aiId}:add`}
        onClick={() => onChange([...value, { key: '', value: '', effect: 'NoSchedule' }])}>
        <Icon name="add" size={14} className="mr-1" />{t('node.taints.add')}
      </Button>
    </div>
  </div>;
}
