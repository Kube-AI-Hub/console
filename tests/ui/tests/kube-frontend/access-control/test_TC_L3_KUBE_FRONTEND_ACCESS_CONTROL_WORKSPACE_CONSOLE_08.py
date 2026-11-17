from __future__ import annotations

from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACE = "system-workspace"
CLUSTERS = f"/kapis/tenant.kubesphere.io/v1alpha2/workspaces/{WORKSPACE}/clusters?limit=-1"
CLUSTER_METRICS = "/kapis/monitoring.kubesphere.io/v1alpha3/cluster"

METRICS = [
    "cluster_cpu_usage",
    "cluster_cpu_total",
    "cluster_memory_usage_wo_cache",
    "cluster_memory_total",
    "cluster_pod_running_count",
    "cluster_pod_quota",
    "cluster_disk_size_usage",
    "cluster_disk_size_capacity",
]

RATIO_PAIRS = [
    ("cpu", "cluster_cpu_usage", "cluster_cpu_total"),
    ("memory", "cluster_memory_usage_wo_cache", "cluster_memory_total"),
    ("pods", "cluster_pod_running_count", "cluster_pod_quota"),
    ("disk", "cluster_disk_size_usage", "cluster_disk_size_capacity"),
]


def _clusters(api) -> list[dict]:
    status, body = api.request("GET", CLUSTERS)
    assert status == 200 and isinstance(body, dict), f"{CLUSTERS} -> {status} {body}"
    return body.get("items") or []


def _cluster_metrics(api, cluster: str) -> dict[str, float]:
    """One cluster's used/total metrics, or an empty dict when the backend has none.

    The cluster segment is part of the **path**: the monitoring API ignores a
    `cluster=` query parameter for member clusters and answers with the host's numbers
    (measured 2026-11-17). Reading the expected value the wrong way would have made the
    page's correct member numbers look wrong.
    """
    metrics_filter = "|".join(f"{name}$" for name in METRICS)
    path = (
        CLUSTER_METRICS
        if cluster in ("", "host")
        else f"/kapis/clusters/{quote(cluster)}/monitoring.kubesphere.io/v1alpha3/cluster"
    )
    status, body = api.request("GET", f"{path}?metrics_filter={quote(metrics_filter)}")
    if status != 200 or not isinstance(body, dict):
        return {}
    values: dict[str, float] = {}
    for result in body.get("results") or []:
        samples = (result.get("data") or {}).get("result") or []
        if not samples:
            continue
        raw = (samples[0].get("value") or [None, ""])[1]
        try:
            values[str(result.get("metric_name"))] = float(raw)
        except (TypeError, ValueError):
            continue
    return values


def _ratio(values: dict[str, float], used_key: str, total_key: str) -> str:
    used = values.get(used_key)
    total = values.get(total_key)
    if used is None or total is None or total <= 0:
        return "-"
    return f"{round(used / total * 100)}%"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_08(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-08 企业空间概览：集群信息页签。"""

    ui = access_control_page
    assert ui.api is not None
    expected = _clusters(ui.api)

    ui.page.goto(
        f'{ui.base_url}/kube-frontend/workspaces/{WORKSPACE}/overview',
        wait_until="domcontentloaded",
    )

    # The resource tab is the default: the previously delivered sections must still be
    # visible without clicking anything (regression guard for AC-07).
    resources_tab = ui.page.locator('[data-ai-id="workspace-overview:tab:resources"]')
    clusters_tab = ui.page.locator('[data-ai-id="workspace-overview:tab:clusters"]')
    expect(resources_tab).to_be_visible(timeout=60_000)
    expect(clusters_tab).to_be_visible(timeout=60_000)
    expect(ui.page.locator('[data-ai-id="workspace-overview:usage"]')).to_be_visible(timeout=60_000)

    clusters_tab.click()
    section = ui.page.locator('[data-ai-id="workspace-overview:clusters"]')
    expect(section).to_be_visible(timeout=30_000)
    expect(section).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    state = section.get_attribute("data-ai-state")

    if not expected:
        assert state == "empty", state
        expect(section.locator('[data-ai-id="workspace-overview:clusters:empty"]')).to_be_visible(timeout=20_000)
        screenshot(ui.page, "workspace-overview-clusters-empty")
        return

    assert state == "ready", state
    rows = section.locator("[data-ai-row]")
    expect(rows).to_have_count(len(expected), timeout=30_000)

    for item in expected:
        name = (item.get("metadata") or {}).get("name") or ""
        assert name, item
        meta = item.get("metadata") or {}
        annotations = meta.get("annotations") or {}
        status = item.get("status") or {}
        spec = item.get("spec") or {}
        conditions = status.get("conditions") or []
        ready = any(
            str(condition.get("type") or "") == "Ready" and str(condition.get("status") or "") == "True"
            for condition in conditions
        )

        card = section.locator(f'[data-ai-row="{name}"]')
        expect(card).to_be_visible(timeout=20_000)
        text = card.inner_text()

        alias = annotations.get("kubesphere.io/alias-name") or ""
        assert (alias or name) in text, (name, text[:300])
        assert ("已就绪" if ready else "未就绪") in text, (name, ready, text[:300])

        provider = spec.get("provider") or "-"
        assert provider in text, (name, provider, text[:300])
        version = status.get("kubernetesVersion") or "-"
        assert version in text, (name, version, text[:300])

        node_count = status.get("nodeCount")
        nodes_text = card.locator(f'[data-ai-id="workspace-overview:clusters:card:{name}:nodes"]').inner_text()
        assert nodes_text == (str(node_count) if isinstance(node_count, int) else "-"), (name, nodes_text, node_count)

        # The four resource ratios: same used/total numbers the monitoring API reports for
        # this cluster, rounded the same way. A missing denominator must read "-", never 0%.
        usage_box = card.locator(f'[data-ai-id="workspace-overview:clusters:card:{name}:usage"]')
        for _ in range(40):
            if usage_box.get_attribute("data-ai-state") != "loading":
                break
            ui.page.wait_for_timeout(500)
        values = _cluster_metrics(ui.api, name)
        for key, used_key, total_key in RATIO_PAIRS:
            shown = card.locator(f'[data-ai-id="workspace-overview:clusters:card:{name}:usage:{key}"]').inner_text()
            assert shown.splitlines()[0].strip() == _ratio(values, used_key, total_key), (name, key, shown, values)
            # The detail keeps the old card's used / allocated / total facts visible; a
            # missing side shows a dash rather than a fabricated zero.
            detail = card.locator(
                f'[data-ai-id="workspace-overview:clusters:card:{name}:usage:{key}:detail"]'
            ).inner_text()
            if _ratio(values, used_key, total_key) == "-":
                assert detail == "-", (name, key, detail)
            else:
                assert "/" in detail, (name, key, detail)

        if ready:
            link = card.locator(f'[data-ai-id="workspace-overview:clusters:card:{name}:link"]')
            expect(link).to_be_visible(timeout=20_000)
            href = link.get_attribute("href") or ""
            assert href.endswith(f"/kube-frontend/clusters/{name}/overview"), href
        else:
            expect(
                card.locator(f'[data-ai-id="workspace-overview:clusters:card:{name}:unavailable"]')
            ).to_be_visible(timeout=20_000)

    screenshot(ui.page, "workspace-overview-clusters")

    # Back to the resource tab: the existing sections must still be there and the page
    # must not have lost its basic information.
    resources_tab.click()
    expect(ui.page.locator('[data-ai-id="workspace-overview:usage"]')).to_be_visible(timeout=30_000)
    expect(ui.page.locator('[data-ai-id="workspace-overview:basic"]')).to_be_visible(timeout=30_000)
