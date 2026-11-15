from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

RANK = '/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/default/workloads'


def _ranked(api, metric: str) -> list[str]:
    status, body = api.request(
        'GET',
        f'{RANK}?sort_metric={metric}&sort_type=desc&page=1&limit=5'
        '&metrics_filter=workload_cpu_usage%7Cworkload_memory_usage_wo_cache',
    )
    if status != 200 or not isinstance(body, dict):
        return []
    for result in body.get('results') or []:
        if result.get('metric_name') != metric:
            continue
        names = []
        for sample in (result.get('data') or {}).get('result') or []:
            workload = ((sample.get('metric') or {}).get('workload') or '').strip()
            raw = (sample.get('value') or [None, ''])[1]
            if not workload or raw in (None, ''):
                continue
            names.append(workload.split(':', 1)[-1])
        return names
    return []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_OVERVIEW_USAGE_03(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-03 项目概览资源使用排行。"""

    ui = project_settings_page
    assert ui.api is not None
    expected_cpu = _ranked(ui.api, 'workload_cpu_usage')
    expected_memory = _ranked(ui.api, 'workload_memory_usage_wo_cache')
    if not expected_cpu and not expected_memory:
        pytest.skip('该项目的工作负载没有上报用量指标，排行无法验证')

    ui.page.goto(ui.url('overview'), wait_until='domcontentloaded')

    section = ui.page.locator('[data-ai-id="project-overview:ranking"]')
    expect(section).to_be_visible(timeout=60_000)

    # CPU tab is the default; wait for the list or an explicit empty/error state.
    listing = section.locator('[data-ai-id="project-overview:ranking:list"]')
    if expected_cpu:
        expect(listing).to_be_visible(timeout=60_000)
        rows = listing.locator('li')
        expect(rows).to_have_count(min(5, len(expected_cpu)), timeout=30_000)
        text = listing.inner_text()
        assert expected_cpu[0] in text, f'第一名 {expected_cpu[0]} 不在排行里：{text[:200]}'
        for index in range(rows.count()):
            assert str(index + 1) in rows.nth(index).inner_text()
    else:
        expect(section.locator('[data-ai-id="project-overview:ranking:empty"], [data-ai-id="project-overview:ranking:error"]')).to_be_visible(timeout=60_000)

    screenshot(ui.page, 'project-overview-ranking-cpu')

    # Memory tab
    section.locator('[data-ai-id="project-overview:ranking:tab:memory"]').click()
    ui.page.wait_for_timeout(2500)
    if expected_memory:
        expect(listing).to_be_visible(timeout=60_000)
        rows = listing.locator('li')
        assert rows.count() <= 5, rows.count()
        assert expected_memory[0] in listing.inner_text(), listing.inner_text()[:200]
        assert any(unit in listing.inner_text() for unit in ('GiB', 'MiB', 'KiB', 'B')), listing.inner_text()[:200]
    else:
        expect(section.locator('[data-ai-id="project-overview:ranking:empty"], [data-ai-id="project-overview:ranking:error"]')).to_be_visible(timeout=60_000)

    screenshot(ui.page, 'project-overview-ranking-memory')

