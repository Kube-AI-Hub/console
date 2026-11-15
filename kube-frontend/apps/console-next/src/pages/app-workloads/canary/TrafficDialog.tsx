import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import type { StrategyDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * Traffic adjustment for one release.
 *
 * The control follows the release mode, because the same object field means different
 * things in each: a canary split is a weight pair, a content-routed canary has no weight
 * to move and is steered by the governing version, and a blue-green release is a
 * single-version choice. Offering one slider for all three would be a control that
 * cannot work for two of them.
 */
export type TrafficChange =
  | { kind: 'weight'; weight: number }
  | { kind: 'governor'; version: string }
  | { kind: 'bluegreen'; version: string };

export interface TrafficDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: StrategyDetail;
  pending: boolean;
  error?: string;
  onSubmit: (change: TrafficChange) => void;
}

/** Versions that are not the principal: the release candidates. */
function candidateVersions(detail: StrategyDetail): string[] {
  return detail.versions.filter((version) => version.role === 'canary').map((version) => version.version);
}

export function TrafficDialog({ open, onOpenChange, detail, pending, error, onSubmit }: TrafficDialogProps): React.ReactElement {
  const t = useT();
  const candidates = candidateVersions(detail);
  const newVersion = candidates[0] ?? detail.mirror?.subset ?? '';
  const storedWeight = detail.versions.find((version) => version.version === newVersion)?.weight;
  const [weightText, setWeightText] = React.useState('50');
  const [governorChoice, setGovernorChoice] = React.useState('');
  const [bluegreenChoice, setBluegreenChoice] = React.useState('');

  // Reset on each open: a previous attempt's number must not become the next write.
  React.useEffect(() => {
    if (!open) return;
    setWeightText(String(storedWeight ?? 50));
    setGovernorChoice(detail.governor);
    setBluegreenChoice(detail.governor || detail.principal);
  }, [open, detail.name, detail.governor, detail.principal, storedWeight]);

  const weight = Number(weightText);
  const weightValid = Number.isInteger(weight) && weight >= 0 && weight <= 100;
  const mode = detail.mode;

  const canSubmit = !pending && (mode === 'traffic' ? weightValid : mode === 'content' || mode === 'bluegreen');

  function submit(): void {
    if (mode === 'traffic') {
      if (!weightValid) return;
      onSubmit({ kind: 'weight', weight });
      return;
    }
    if (mode === 'content') {
      onSubmit({ kind: 'governor', version: governorChoice });
      return;
    }
    if (mode === 'bluegreen') {
      onSubmit({ kind: 'bluegreen', version: bluegreenChoice });
    }
  }

  function choiceRow(input: {
    key: string;
    label: string;
    selected: boolean;
    onSelect: () => void;
  }): React.ReactElement {
    return (
      <li key={input.key}>
        <Button
          size="sm"
          variant={input.selected ? 'primary' : 'secondary'}
          className="w-full justify-start"
          {...actionProps(input.key)}
          onClick={input.onSelect}
        >
          {input.label}
        </Button>
      </li>
    );
  }

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onOpenChange(false))} title={t('grayRelease.traffic.title')} size="md">
      <div className="flex flex-col gap-4" data-ai-id="grayrelease-traffic:dialog">
        {mode === 'traffic' ? (
          <>
            <p className="text-xs text-ai-fg-muted">{t('grayRelease.traffic.description')}</p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('grayRelease.traffic.weight')}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={weightValid ? weight : 0}
                className="h-2 w-full accent-ai-accent"
                aria-label={t('grayRelease.traffic.weight')}
                {...actionProps('grayrelease-traffic:slider')}
                onChange={(event) => setWeightText(event.target.value)}
              />
              <Input
                value={weightText}
                inputMode="numeric"
                maxLength={3}
                aria-label={t('grayRelease.traffic.weight')}
                {...actionProps('grayrelease-traffic:weight')}
                onChange={(event) => setWeightText(event.target.value)}
              />
            </label>
            {weightValid ? (
              <p className="text-xs text-ai-fg-secondary" data-ai-id="grayrelease-traffic:summary">
                {t('grayRelease.traffic.summary', {
                  newVersion: newVersion || '-',
                  newWeight: String(weight),
                  oldVersion: detail.principal || '-',
                  oldWeight: String(100 - weight),
                })}
              </p>
            ) : (
              <p role="alert" className="text-xs text-ai-danger" data-ai-id="grayrelease-traffic:error">
                {t('grayRelease.traffic.error.range')}
              </p>
            )}
          </>
        ) : null}

        {mode === 'content' ? (
          <>
            <p className="text-xs text-ai-fg-muted">{t('grayRelease.traffic.contentDescription')}</p>
            <ul className="flex flex-col gap-1.5">
              {choiceRow({
                key: 'grayrelease-traffic:mode:rules',
                label: t('grayRelease.traffic.mode.rules'),
                selected: governorChoice === '',
                onSelect: () => setGovernorChoice(''),
              })}
              {candidates.map((version) =>
                choiceRow({
                  key: 'grayrelease-traffic:mode:new:' + version,
                  label: t('grayRelease.traffic.mode.newVersion') + ' (' + version + ')',
                  selected: governorChoice === version,
                  onSelect: () => setGovernorChoice(version),
                }),
              )}
              {choiceRow({
                key: 'grayrelease-traffic:mode:old',
                label: t('grayRelease.traffic.mode.oldVersion'),
                selected: governorChoice === detail.principal,
                onSelect: () => setGovernorChoice(detail.principal),
              })}
            </ul>
          </>
        ) : null}

        {mode === 'bluegreen' ? (
          <>
            <p className="text-xs text-ai-fg-muted">{t('grayRelease.traffic.bluegreenDescription')}</p>
            <ul className="flex flex-col gap-1.5">
              {choiceRow({
                key: 'grayrelease-traffic:version:' + detail.principal,
                label: t('grayRelease.traffic.mode.bluegreenOld', { version: detail.principal }),
                selected: bluegreenChoice === detail.principal,
                onSelect: () => setBluegreenChoice(detail.principal),
              })}
              {candidates.map((version) =>
                choiceRow({
                  key: 'grayrelease-traffic:version:' + version,
                  label: t('grayRelease.traffic.mode.bluegreenNew', { version }),
                  selected: bluegreenChoice === version,
                  onSelect: () => setBluegreenChoice(version),
                }),
              )}
            </ul>
          </>
        ) : null}

        {mode === 'mirror' || mode === 'unknown' ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="grayrelease-traffic:readonly">
            {t('grayRelease.traffic.mirrorDescription')}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-ai-danger" data-ai-id="grayrelease-traffic:error">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={pending} {...actionProps('grayrelease-traffic:cancel')} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={!canSubmit} {...actionProps('grayrelease-traffic:submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
