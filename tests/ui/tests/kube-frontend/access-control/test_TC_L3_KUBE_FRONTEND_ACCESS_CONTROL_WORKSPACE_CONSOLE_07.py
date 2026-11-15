from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACE = 'system-workspace'
USAGE = f'/kapis/monitoring.kubesphere.io/v1alpha3/workspaces/{WORKSPACE}'
RANK = '/kapis/monitoring.kubesphere.io/v1alpha3/namespaces'


def _usage(api) -> dict[str, float]:
    status, body = api.request(
        'GET',
        f'{USAGE}?metrics_filter=workspace_cpu_usage%7Cworkspace_memory_usage_wo_cache%7Cworkspace_pod_count&step=60s',
    )
    if status != 200 or not isinstance(body, dict):
        return {}
    out: dict[str, float] = {}
    for result in body.get('results') or []:
        samples = (result.get('data') or {}).get('result') or []
        if not samples:
            continue
        raw = (samples[0].get('value') or [None, ''])[1]
        try:
            out[str(result.get('metric_name'))] = float(raw)
        except (TypeError, ValueError):
            continue
    return out


def _ranking(api, metric: str) -> list[str]:
    status, body = api.request(
        'GET',
        f'{RANK}?sort_metric={metric}&sort_type=desc&page=1&limit=20&metrics_filter={metric}%24',
    )
    if status != 200 or not isinstance(body, dict):
        return []
    for result in body.get('results') or []:
        if result.get('metric_name') != metric:
            continue
        names = []
        for sample in (result.get('data') or {}).get('result') or []:
            metric_labels = sample.get('metric') or {}
            if metric_labels.get('workspace') != WORKSPACE:
                continue
            raw = (sample.get('value') or [None, ''])[1]
            if not metric_labels.get('namespace') or raw in (None, ''):
                continue
            names.append(str(metric_labels['namespace']))
        return names
    return []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_07(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07 企业空间概览用量与排行。"""

    ui = access_control_page
    assert ui.api is not None
    expected = _usage(ui.api)
    ranked = _ranking(ui.api, 'namespace_cpu_usage')

    ui.page.goto(f'{ui.base_url.rstrip("/")}/kube-frontend/workspaces/{WORKSPACE}/overview', wait_until='domcontentloaded')

    usage_section = ui.page.locator('[data-ai-id="workspace-overview:usage"]')
    expect(usage_section).to_be_visible(timeout=60_000)

    if 'workspace_cpu_usage' not in expected:
        # No workspace-level sample: the section must say so rather than print a 0.
        expect(usage_section.locator('[data-ai-id="workspace-overview:usage:unavailable"]')).to_be_visible(timeout=30_000)
        pytest.skip('该企业空间没有空间级用量采样，数值分支无法验证')

    cpu_text = ui.page.locator('[data-ai-id="workspace-overview:usage:cpu"]').inner_text()
    assert cpu_text not in ('', '-', '0'), cpu_text
    assert abs(float(cpu_text) - expected['workspace_cpu_usage']) <= max(0.2, expected['workspace_cpu_usage'] * 0.25), (
        cpu_text,
        expected['workspace_cpu_usage'],
    )
    if 'workspace_pod_count' in expected:
        pods = ui.page.locator('[data-ai-id="workspace-overview:usage:pods"]').inner_text()
        assert pods.isdigit(), pods
        assert abs(int(pods) - expected['workspace_pod_count']) <= 5, (pods, expected['workspace_pod_count'])

    # Ranking: only projects of this workspace, and every listed name must come from the API set.
    ranking = ui.page.locator('[data-ai-id="workspace-overview:ranking"]')
    expect(ranking).to_be_visible(timeout=30_000)
    listing = ranking.locator('[data-ai-id="workspace-overview:ranking:list"]')
    if ranked:
        expect(listing).to_be_visible(timeout=60_000)
        rows = listing.locator('li')
        assert rows.count() <= 5, rows.count()
        for index in range(rows.count()):
            # The row starts with its rank; the project name lives in its own element.
            name = rows.nth(index).locator('[data-ai-id^="workspace-overview:ranking:name:"]').inner_text().strip()
            assert name in ranked, f'{name} 不属于本空间的排行样本：{ranked[:5]}'
    else:
        expect(ranking.locator('[data-ai-id="workspace-overview:ranking:empty"]')).to_be_visible(timeout=30_000)

    screenshot(ui.page, 'workspace-overview-usage')

