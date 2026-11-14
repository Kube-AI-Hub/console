from __future__ import annotations

import re
import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MONITORING = "/kapis/monitoring.kubesphere.io/v1alpha3"
SYSTEM_NAMESPACE = "kubesphere-system"
SYSTEM_WORKSPACE = "system-workspace"

#: Deployments whose series are always present on a running cluster; trying these
#: first keeps the probe below from walking every Deployment in the namespace.
PREFERRED = ("ks-console", "ks-apiserver", "ks-controller-manager", "tower")


def _sample_count(api, path: str) -> int | None:
    """Samples a monitoring range query returns, or None when the API failed."""
    end = int(time.time())
    start = end - 3600
    separator = '&' if '?' in path else '?'
    status, body = api.request(
        'GET',
        f'{path}{separator}start={start}&end={end}&step=60s&cluster=host',
    )
    if status != 200 or not isinstance(body, dict):
        return None
    total = 0
    for result in body.get('results') or []:
        for series in ((result.get('data') or {}).get('result') or []):
            total += len(series.get('values') or [])
    return total


def _workload_samples(api, namespace: str, name: str) -> int | None:
    path = (
        f'{MONITORING}/namespaces/{namespace}/workloads/deployment'
        f'?resources_filter={quote(name)}&metrics_filter=workload_cpu_usage$'
    )
    return _sample_count(api, path)


def _pod_samples(api, namespace: str, pod: str) -> int | None:
    path = (
        f'{MONITORING}/namespaces/{namespace}/pods/{quote(pod)}'
        '?metrics_filter=pod_cpu_usage$'
    )
    return _sample_count(api, path)


def _monitored_deployment(api):
    """A Deployment whose CPU series has samples in the last hour, or (None, 0)."""
    status, body = api.request('GET', f'/apis/apps/v1/namespaces/{SYSTEM_NAMESPACE}/deployments')
    if status != 200 or not isinstance(body, dict):
        return None, 0
    names = [str(item['metadata']['name']) for item in body.get('items') or [] if item.get('metadata', {}).get('name')]
    names.sort(key=lambda name: (name not in PREFERRED, name))
    for name in names[:8]:
        samples = _workload_samples(api, SYSTEM_NAMESPACE, name)
        if samples:
            return name, samples
    return None, 0


def _deployment_pods(api, name: str) -> list[str]:
    """Pod names of one Deployment, from its own selector rather than a name prefix.

    Prefer Running pods: a pod still pulling its image has no metrics yet, so the
    pod half of the case would only ever see the empty state.
    """
    status, deployment = api.request('GET', f'/apis/apps/v1/namespaces/{SYSTEM_NAMESPACE}/deployments/{name}')
    if status != 200 or not isinstance(deployment, dict):
        return []
    labels = (((deployment.get('spec') or {}).get('selector') or {}).get('matchLabels')) or {}
    if not labels:
        return []
    selector = ','.join(f'{key}={value}' for key, value in labels.items())
    status, body = api.request(
        'GET',
        f'/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods?labelSelector={quote(selector)}',
    )
    if status != 200 or not isinstance(body, dict):
        return []
    pods = [item for item in body.get('items') or [] if item.get('metadata', {}).get('name')]
    pods.sort(key=lambda item: (item.get('status', {}).get('phase') != 'Running', item['metadata']['name']))
    return [str(item['metadata']['name']) for item in pods]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_MONITOR_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_MONITOR-01 详情监控页签：趋势/窗口/三态。"""

    ui = app_workloads_page
    assert ui.api is not None

    deployment, samples = _monitored_deployment(ui.api)
    if deployment is None:
        pytest.skip('没有 workload_cpu_usage 有采样点的 Deployment，无法验证监控页签')

    origin = ui.base.split('/kube-frontend/')[0]
    project = f'{origin}/kube-frontend/{SYSTEM_WORKSPACE}/clusters/{ui.cluster}/projects/{SYSTEM_NAMESPACE}'

    # ---- Deployment detail: the monitor tab exists, opens, and plots ----
    ui.page.goto(f'{project}/deployments/{deployment}')
    surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=90_000)

    trigger = ui.page.locator('[data-ai-id="workload-detail:tab-trigger:monitor"]')
    expect(trigger).to_be_visible(timeout=20_000)
    trigger.click()
    expect(ui.page.locator('[data-ai-id="workload-detail:tab:monitor"]')).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="workload-detail:monitor"]')).to_be_visible(timeout=20_000)

    # The panel settles into exactly one of the three states.
    ui.page.wait_for_selector(
        '[data-ai-id="workload-detail:monitor:chart"], '
        '[data-ai-id="workload-detail:monitor:empty"], '
        '[data-ai-id="workload-detail:monitor:unavailable"]',
        timeout=90_000,
    )

    chart = ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')
    if samples > 0:
        expect(chart).to_be_visible(timeout=20_000)
        expect(chart).to_have_attribute('data-ai-window', '1h')
        assert int(chart.get_attribute('data-ai-points') or 0) > 0, '图表没有采样点'
        # Count the DOM, not visibility: a series of zeros draws zero-height bars,
        # which are still data and must not be read as missing.
        bars = chart.locator('[data-ai-bar]')
        assert bars.count() > 0, '有采样点但趋势图没有柱子'
        for key in ('cpu', 'memory'):
            card = ui.page.locator(f'[data-ai-id="workload-detail:monitor:{key}"]')
            expect(card).to_be_visible()
            assert int(card.get_attribute('data-ai-points') or 0) > 0, f'{key} 卡片没有采样点'
    else:
        expect(ui.page.locator('[data-ai-id="workload-detail:monitor:empty"]')).to_be_visible()

    # ---- window switching changes the pressed button and the plotted window ----
    six_hours = ui.page.locator('[data-ai-id="workload-detail:monitor:range:6h"]')
    expect(six_hours).to_be_visible()
    six_hours.click()
    expect(six_hours).to_have_attribute('aria-pressed', 'true')
    expect(ui.page.locator('[data-ai-id="workload-detail:monitor:range:1h"]')).to_have_attribute('aria-pressed', 'false')
    if samples > 0:
        # The chart unmounts while the new window loads; the assertion waits for the
        # next mount rather than reading the old attribute.
        expect(ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')).to_have_attribute('data-ai-window', '6h', timeout=90_000)
        expect(
            ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')
        ).to_have_attribute('data-ai-points', re.compile(r'^[1-9][0-9]*$'), timeout=90_000)

        day = ui.page.locator('[data-ai-id="workload-detail:monitor:range:24h"]')
        day.click()
        expect(day).to_have_attribute('aria-pressed', 'true')
        expect(ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')).to_have_attribute('data-ai-window', '24h', timeout=90_000)

        ui.page.locator('[data-ai-id="workload-detail:monitor:range:1h"]').click()
        expect(ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')).to_have_attribute('data-ai-window', '1h', timeout=90_000)

    screenshot(ui.page, 'workload-detail-monitor')

    # ---- Pod detail: same tab, the pod's own series ----
    pods = _deployment_pods(ui.api, deployment)
    if not pods:
        pytest.skip('该 Deployment 没有 Pod，Pod 侧监控无法验证')
    pod = pods[0]
    pod_samples = _pod_samples(ui.api, SYSTEM_NAMESPACE, pod)

    ui.page.goto(f'{project}/pods/{pod}')
    pod_surface = ui.page.locator('[data-ai-id="pods-detail:surface"]').last
    expect(pod_surface).to_be_visible(timeout=30_000)
    expect(pod_surface).not_to_have_attribute('data-ai-state', 'loading', timeout=90_000)

    pod_trigger = ui.page.locator('[data-ai-id="workload-detail:tab-trigger:monitor"]')
    expect(pod_trigger).to_be_visible(timeout=20_000)
    pod_trigger.click()
    expect(ui.page.locator('[data-ai-id="workload-detail:tab:monitor"]')).to_be_visible(timeout=20_000)
    ui.page.wait_for_selector(
        '[data-ai-id="workload-detail:monitor:chart"], '
        '[data-ai-id="workload-detail:monitor:empty"], '
        '[data-ai-id="workload-detail:monitor:unavailable"]',
        timeout=90_000,
    )
    pod_chart = ui.page.locator('[data-ai-id="workload-detail:monitor:chart"]')
    if pod_samples and pod_samples > 0:
        expect(pod_chart).to_be_visible(timeout=20_000)
        assert pod_chart.locator('[data-ai-bar]').count() > 0, 'Pod 有采样点但没有柱子'
    else:
        # A pod created seconds ago has no metrics until the next scrape: the empty
        # state is the correct answer, not a failure.
        expect(ui.page.locator('[data-ai-id="workload-detail:monitor:empty"]')).to_be_visible(timeout=20_000)

