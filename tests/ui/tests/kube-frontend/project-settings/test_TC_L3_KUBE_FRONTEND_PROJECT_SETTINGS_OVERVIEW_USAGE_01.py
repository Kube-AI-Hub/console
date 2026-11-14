from __future__ import annotations

import re
import time
import urllib.parse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USAGE_PATH = "/kapis/monitoring.kubesphere.io/v1alpha3/namespaces/default"
METRICS = [
    "namespace_cpu_usage",
    "namespace_memory_usage_wo_cache",
    "namespace_memory_usage",
    "namespace_pod_count",
    "namespace_pod_running_count",
    "namespace_pvc_usage",
    "namespace_storage_usage",
]


def _has_samples(body: dict) -> bool:
    for result in body.get("results") or []:
        for sample in ((result.get("data") or {}).get("result") or []):
            if sample.get("values"):
                return True
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_OVERVIEW_USAGE_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW_USAGE-01 项目概览 · 资源用量卡。"""

    ui = project_settings_page
    assert ui.api is not None

    # Which branch the card must take is decided by the API, not by what this cluster
    # usually looks like: monitoring may be absent, present with samples, or present with none.
    now = int(time.time())
    metrics_filter = urllib.parse.quote("|".join(f"{metric}$" for metric in METRICS), safe="$|")
    status, body = ui.api.request(
        "GET",
        f"{USAGE_PATH}?metrics_filter={metrics_filter}&start={now - 300}&end={now}&step=60s&cluster=host",
    )
    if status == 200:
        branch = "ready" if _has_samples(body if isinstance(body, dict) else {}) else "empty"
    else:
        branch = "unavailable"

    ui.page.goto(f"{ui.base_url}/kube-frontend/public/clusters/{ui.cluster}/projects/default/overview")
    surface = ui.page.locator('[data-ai-id="project-overview:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    usage = ui.page.locator('[data-ai-id="project-overview:usage"]')
    expect(usage).to_be_visible(timeout=30_000)

    if branch == "ready":
        for key in ("cpu", "memory", "pods"):
            cell = ui.page.locator(f'[data-ai-id="project-overview:usage:{key}"]').last
            expect(cell).to_be_visible(timeout=60_000)
            text = cell.inner_text().strip()
            # The cell is "<used>" or "<used> / <hard>"; the used half must be a number.
            used = text.split("/")[0].strip()
            assert used and used != "-", f"{key} usage should be a number, got {text!r}"
            # A number optionally followed by a unit ("0", "47", "1.7 GiB"); a dash would mean
            # the card rendered "could not read" as if it were a reading.
            assert re.match(r"^[0-9]", used), f"{key} usage is not a number: {text!r}"
        expect(ui.page.locator('[data-ai-id="project-overview:usage:empty"]')).to_have_count(0)
        expect(ui.page.locator('[data-ai-id="project-overview:usage:unavailable"]')).to_have_count(0)
    elif branch == "empty":
        expect(ui.page.locator('[data-ai-id="project-overview:usage:empty"]')).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="project-overview:usage:cpu"]')).to_have_count(0)
    else:
        expect(ui.page.locator('[data-ai-id="project-overview:usage:unavailable"]')).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="project-overview:usage:retry"]')).to_be_visible()
        # An unavailable monitor must not be rendered as a row of zeros.
        expect(ui.page.locator('[data-ai-id="project-overview:usage:cpu"]')).to_have_count(0)

    # The quota block is a separate read and must stay visible whatever usage did.
    expect(ui.page.locator('[data-ai-id="project-overview:quota"]')).to_be_visible()

    screenshot(ui.page, "project-overview-usage")
