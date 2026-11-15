from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_OVERVIEW_USAGE_04(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-04 项目概览资源用量趋势。"""

    ui = project_settings_page
    assert ui.api is not None

    ranges: list[str] = []

    def watch(request) -> None:
        url = request.url
        if '/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/' in url and 'start=' in url:
            ranges.append(url)

    ui.page.on('request', watch)
    ui.page.goto(ui.url('overview'), wait_until='domcontentloaded')

    section = ui.page.locator('[data-ai-id="project-overview:trend"]')
    expect(section).to_be_visible(timeout=60_000)

    # The 1h window is the default and must be the selected tab.
    expect(ui.page.locator('[data-ai-id="project-overview:trend:window:1h"]')).to_have_attribute('data-state', 'active', timeout=30_000)

    charts = ui.page.locator('[data-ai-id="project-overview:trend:charts"]')
    empty = ui.page.locator('[data-ai-id="project-overview:trend:empty"]')
    error = ui.page.locator('[data-ai-id="project-overview:trend:error"]')
    expect(charts.or_(empty).or_(error).first).to_be_visible(timeout=60_000)

    if charts.count() == 0:
        # No samples or no monitoring: the section must say which, and must not draw a zero line.
        assert empty.count() or error.count()
        pytest.skip('该项目在当前窗口没有采样，曲线分支无法验证')

    expect(ui.page.locator('[data-ai-id="project-overview:trend:cpu"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="project-overview:trend:memory"]')).to_be_visible()
    assert ui.page.locator('[data-ai-id="project-overview:trend:cpu"] svg').count() >= 1, 'CPU 曲线没有渲染 svg'

    before = len(ranges)
    ui.page.locator('[data-ai-id="project-overview:trend:window:6h"]').click()
    ui.page.wait_for_timeout(4000)
    expect(ui.page.locator('[data-ai-id="project-overview:trend:window:6h"]')).to_have_attribute('data-state', 'active', timeout=20_000)

    after = ranges[before:]
    assert after, f'切换时间窗后没有新的区间请求：{ranges[-2:]}'
    # A 6h window asks for a different start than the 1h one.
    assert any('start=' in url for url in after)
    assert ranges[0] != after[0], '切换窗口后请求区间没有变化'

    screenshot(ui.page, 'project-overview-trend')

