import * as React from 'react';
import { CLUSTER_GROUPS, CLUSTER_PROVIDERS } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { FormField, Input, Select, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * The four writable cluster attributes, shared by 添加集群 and 编辑信息.
 *
 * Both dialogs collect the same four fields with the same hints and the same option
 * sets; the only difference is that 编辑信息 shows the name read-only and 添加集群
 * collects it. Duplicating the block is how the two ended up disagreeing before —
 * 添加集群 had a free-text provider with a `<datalist>` while 编辑信息 had a plain
 * text input, and 编辑信息's tag list was missing `demo`.
 *
 * The fields are controlled from the outside (`value` / `onChange`) rather than
 * holding their own state: each dialog owns its form state, and a component that also
 * stored a copy would need syncing on every open.
 */

/** Sentinel for "no tag": Radix `Select` refuses an empty option value. */
export const NO_CLUSTER_GROUP = '__none__';

export interface ClusterIdentityFieldsProps {
  alias: string;
  onAliasChange: (next: string) => void;
  group: string;
  onGroupChange: (next: string) => void;
  provider: string;
  onProviderChange: (next: string) => void;
  description: string;
  onDescriptionChange: (next: string) => void;
  /**
   * Handle prefix, e.g. `clusters:add` or `clusters:edit`. Field handles stay
   * `#ai-field-cluster-<field>` for the add dialog and
   * `#ai-field-cluster-edit-<field>` for the edit one, so existing automation keeps
   * working on both.
   */
  idPrefix: string;
  /** `add` / `edit`; only the automation ids differ, not the fields. */
  aiPrefix: 'clusters:add' | 'clusters:edit';
  /** Alias validation message; shown under the field when set. */
  aliasError?: string | null;
  disabled?: boolean;
}

export const ALIAS_MAX = 63;
export const DESCRIPTION_MAX = 256;

export function ClusterIdentityFields({
  alias,
  onAliasChange,
  group,
  onGroupChange,
  provider,
  onProviderChange,
  description,
  onDescriptionChange,
  idPrefix,
  aiPrefix,
  aliasError,
  disabled = false,
}: ClusterIdentityFieldsProps): React.ReactElement {
  const t = useT();

  const groupOptions = React.useMemo(
    () => [
      { value: NO_CLUSTER_GROUP, label: t('cluster.group.none') },
      ...CLUSTER_GROUPS.map((value) => ({ value, label: t(`cluster.group.${value}` as 'cluster.group.production') })),
    ],
    [t],
  );
  const providerOptions = React.useMemo(() => CLUSTER_PROVIDERS.map((value) => ({ value, label: value })), []);

  return (
    <>
      <FormField htmlFor={`${idPrefix}-alias`} label={t('cluster.edit.alias')} hint={t('cluster.edit.aliasHint')} {...(aliasError ? { error: aliasError } : {})}>
        <Input
          id={`${idPrefix}-alias`}
          value={alias}
          maxLength={ALIAS_MAX}
          disabled={disabled}
          onChange={(event) => onAliasChange(event.target.value)}
          placeholder={t('cluster.add.aliasPlaceholder')}
          {...actionProps(`${aiPrefix}-alias`)}
        />
      </FormField>

      <FormField htmlFor={`${idPrefix}-group`} label={t('cluster.add.group')} hint={t('cluster.add.groupHint')}>
        <div {...actionProps(`${aiPrefix}-group`)}>
          <Select
            id={`${idPrefix}-group`}
            value={group === '' ? NO_CLUSTER_GROUP : group}
            options={groupOptions}
            placeholder={t('cluster.group.none')}
            disabled={disabled}
            aria-label={t('cluster.add.group')}
            onValueChange={(next) => onGroupChange(next === NO_CLUSTER_GROUP ? '' : next)}
          />
        </div>
      </FormField>

      {/* Searchable, and free text is still accepted by the platform: the list is the
          old console's presets, not an enum. */}
      <FormField htmlFor={`${idPrefix}-provider`} label={t('cluster.edit.provider')} hint={t('cluster.add.providerHint')}>
        <Select
          id={`${idPrefix}-provider`}
          value={provider}
          options={providerOptions}
          placeholder={t('cluster.edit.provider')}
          disabled={disabled}
          searchable
          aria-label={t('cluster.edit.provider')}
          onValueChange={onProviderChange}
          data-ai-id={`${aiPrefix}-provider`}
        />
      </FormField>

      <FormField htmlFor={`${idPrefix}-description`} label={t('cluster.edit.descriptionLabel')} hint={t('cluster.edit.descriptionHint')}>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          maxLength={DESCRIPTION_MAX}
          rows={2}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
          {...actionProps(`${aiPrefix}-description`)}
        />
      </FormField>
    </>
  );
}
