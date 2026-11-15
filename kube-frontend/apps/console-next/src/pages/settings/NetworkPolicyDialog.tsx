import * as React from 'react';
import { Button, Icon, Input, Modal, Select } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import {
  type PolicyCreateInput,
  type PolicyPeerKind,
  type PolicyPortInput,
  type PolicyRuleInput,
} from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * 创建网络策略: the whitelist wizard.
 *
 * The old console asks for a traffic direction and then which projects or services to admit.
 * This form asks the same question in the object's own terms — one rule per admitted peer, each
 * with an optional port — because that is what the policy stores: a namespace peer is a
 * `namespaceSelector`, a service peer is the service's `podSelector`, and a rule can also be an
 * address range. Ports were not offered before and are the most common reason a whitelist is
 * written by hand.
 */
export interface NetworkPolicyDialogProps {
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Omit<PolicyCreateInput, 'namespace'>) => void | Promise<void>;
}

interface RuleDraft extends PolicyRuleInput {
  id: number;
}

let sequence = 0;
function nextId(): number {
  sequence += 1;
  return sequence;
}

const PEER_KINDS: PolicyPeerKind[] = ['pod', 'namespace', 'ipBlock'];
const PROTOCOLS: PolicyPortInput['protocol'][] = ['TCP', 'UDP', 'SCTP'];

function emptyRule(): RuleDraft {
  return { id: nextId(), peer: { kind: 'pod', value: '' }, port: { protocol: 'TCP', port: '' } };
}

/** Rule rows share one control: ingress and egress differ only in which list they land in. */
function RuleList({
  group,
  label,
  hint,
  rows,
  onChange,
  pending,
}: {
  group: string;
  label: string;
  hint: string;
  rows: RuleDraft[];
  onChange: (rows: RuleDraft[]) => void;
  pending: boolean;
}): React.ReactElement {
  const t = useT();
  const patch = (id: number, changes: Partial<RuleDraft>): void => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  };
  return (
    <div className="flex flex-col gap-2" data-ai-id={`networkpolicies-create:${group}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ai-fg-secondary">{label}</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          {...actionProps(`networkpolicies-create:${group}-add`)}
          onClick={() => onChange([...rows, emptyRule()])}
        >
          <Icon name="add" size={12} />
          {t('settings.network.ruleAdd')}
        </Button>
      </div>
      <span className="text-[11px] text-ai-fg-muted">{hint}</span>
      {rows.length === 0 ? <p className="text-[11px] text-ai-fg-muted">{t('settings.network.ruleEmpty')}</p> : null}
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]"
          data-ai-row={`${group}-${row.id}`}
        >
          <Select
            value={row.peer.kind}
            options={PEER_KINDS.map((kind) => ({ value: kind, label: t(`settings.network.peerKind.${kind}` as 'settings.network.peerKind.pod') }))}
            data-ai-id={`networkpolicies-create:${group}-kind:${row.id}`}
            aria-label={t('settings.network.peerKind')}
            onValueChange={(value: string) => patch(row.id, { peer: { ...row.peer, kind: value as PolicyPeerKind } })}
          />
          <Input
            value={row.peer.value}
            placeholder={t(`settings.network.peerValue.${row.peer.kind}` as 'settings.network.peerValue.pod')}
            aria-label={t('settings.network.peerValue')}
            disabled={pending}
            {...actionProps(`networkpolicies-create:${group}-value:${row.id}`)}
            onChange={(event) => patch(row.id, { peer: { ...row.peer, value: event.target.value } })}
          />
          <Select
            value={row.port?.protocol ?? 'TCP'}
            options={PROTOCOLS.map((protocol) => ({ value: protocol, label: protocol }))}
            data-ai-id={`networkpolicies-create:${group}-protocol:${row.id}`}
            aria-label={t('settings.network.portProtocol')}
            onValueChange={(value: string) => patch(row.id, { port: { protocol: value as PolicyPortInput['protocol'], port: row.port?.port ?? '' } })}
          />
          <Input
            value={row.port?.port ?? ''}
            placeholder={t('settings.network.portPlaceholder')}
            aria-label={t('settings.network.port')}
            disabled={pending}
            {...actionProps(`networkpolicies-create:${group}-port:${row.id}`)}
            onChange={(event) => patch(row.id, { port: { protocol: row.port?.protocol ?? 'TCP', port: event.target.value } })}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('settings.network.ruleRemove')}
            disabled={pending}
            {...actionProps(`networkpolicies-create:${group}-remove:${row.id}`)}
            onClick={() => onChange(rows.filter((entry) => entry.id !== row.id))}
          >
            <Icon name="trash" size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function NetworkPolicyDialog({ open, pending = false, onOpenChange, onSubmit }: NetworkPolicyDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [podSelector, setPodSelector] = React.useState('');
  const [ingress, setIngress] = React.useState<RuleDraft[]>([]);
  const [egress, setEgress] = React.useState<RuleDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Re-seed on open: the same dialog creates several policies in a row.
  React.useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setPodSelector('');
    setIngress([]);
    setEgress([]);
    setError(null);
  }, [open]);

  const nameInvalid = name.trim() !== '' && !/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name.trim());
  /** A rule with no peer selects nothing; it is almost always a half-filled row. */
  const peerMissing = [...ingress, ...egress].some((rule) => !rule.peer.value.trim());
  const blocked = pending || !name.trim() || nameInvalid || peerMissing || (ingress.length === 0 && egress.length === 0);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      const strip = (rows: RuleDraft[]): PolicyRuleInput[] =>
        rows.map((row) => ({ peer: { kind: row.peer.kind, value: row.peer.value.trim() }, ...(row.port ? { port: row.port } : {}) }));
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        podSelector: podSelector.trim(),
        ingress: strip(ingress),
        egress: strip(egress),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('settings.network.createFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('settings.network.create')}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={blocked} {...actionProps('networkpolicies-create:submit')} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="networkpolicies-create:surface">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('settings.column.name')}</span>
          <Input value={name} {...actionProps('networkpolicies-create:name')} onChange={(event) => setName(event.target.value)} />
          {nameInvalid ? (
            <span role="alert" className="text-[11px] text-ai-danger">
              {t('platform.users.field.nameInvalid')}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('settings.network.descriptionField')}</span>
          <Input value={description} {...actionProps('networkpolicies-create:description')} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('settings.network.podSelector')}</span>
          <Input
            value={podSelector}
            placeholder="app=backend"
            {...actionProps('networkpolicies-create:pod-selector')}
            onChange={(event) => setPodSelector(event.target.value)}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('settings.network.podSelectorHint')}</span>
        </label>

        <RuleList
          group="ingress"
          label={t('settings.network.ingressRules')}
          hint={t('settings.network.ingressRulesHint')}
          rows={ingress}
          onChange={setIngress}
          pending={pending}
        />
        <RuleList
          group="egress"
          label={t('settings.network.egressRules')}
          hint={t('settings.network.egressRulesHint')}
          rows={egress}
          onChange={setEgress}
          pending={pending}
        />

        {ingress.length === 0 && egress.length === 0 ? (
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="networkpolicies-create:no-rules">
            {t('settings.network.noRules')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[11px] text-ai-danger" data-ai-id="networkpolicies-create:error">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
