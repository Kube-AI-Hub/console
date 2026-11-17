import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { RuleStateCell, formatEvaluationTime } from '@/pages/cluster/ClusterAlertingPoliciesPage';

/**
 * Cluster alerting policy presentation rules.
 *
 * The two things the old console rendered from the aggregated status are pinned here:
 * a **missing** status must read `-` (the API did not answer), while a real zero must
 * read zero (the rule was evaluated and nothing is firing). Filling either with the
 * other is the kind of silent lie that makes an operator stop trusting the page.
 */

function renderCell(status: Parameters<typeof RuleStateCell>[0]['status']) {
  return render(
    <I18nProvider locale="zh">
      <RuleStateCell status={status} />
    </I18nProvider>,
  );
}

describe('formatEvaluationTime', () => {
  it('renders a real zero as three decimals, not as missing', () => {
    expect(formatEvaluationTime(0)).toBe('0.000');
  });

  it('renders missing and non-finite values as a dash', () => {
    expect(formatEvaluationTime(undefined)).toBe('-');
    expect(formatEvaluationTime(Number.NaN)).toBe('-');
    expect(formatEvaluationTime(Number.POSITIVE_INFINITY)).toBe('-');
  });
});

describe('RuleStateCell', () => {
  it('shows a dash when the read path carried no status', () => {
    const { container } = renderCell(undefined);
    expect(container.textContent).toBe('-');
    expect(container.querySelector('[data-ai-id="cluster-alerting-policies:no-status"]')).not.toBeNull();
  });

  it('renders only the states the API reported, with their counts', () => {
    renderCell({ stats: { firing: 2, inactive: 1 }, rules: [] });
    // "已触发 2" and "未触发 1" are present; pending/disabled were not reported and
    // must not be invented as 0.
    expect(screen.getByText('已触发 2')).toBeTruthy();
    expect(screen.getByText('未触发 1')).toBeTruthy();
    expect(screen.queryByText('验证中 0')).toBeNull();
    expect(screen.queryByText('已禁用 0')).toBeNull();
  });

  it('keeps a reported zero visible', () => {
    renderCell({ stats: { firing: 0, inactive: 3 }, rules: [] });
    expect(screen.getByText('已触发 0')).toBeTruthy();
    expect(screen.getByText('未触发 3')).toBeTruthy();
  });

  it('shows a dash when status exists but reported no counts at all', () => {
    const { container } = renderCell({ stats: {}, rules: [] });
    expect(container.textContent).toBe('-');
  });
});
