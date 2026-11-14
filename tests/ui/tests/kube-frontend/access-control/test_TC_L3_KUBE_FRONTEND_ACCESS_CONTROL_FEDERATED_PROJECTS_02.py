from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

FEDERATED = "/apis/types.kubefed.io/v1beta1"
NAMESPACES = FEDERATED + "/federatednamespaces"
SURFACE = '[data-ai-id="federated-project:surface"]'

#: The same grouping the page uses; the test reads each collection to derive the
#: expected row count instead of hard-coding an environment.
GROUPS = {
    "workloads": (
        "federatedapplications",
        "federateddeployments",
        "federatedstatefulsets",
        "federatedreplicasets",
        "federatedjobs",
        "federatedservices",
        "federatedingresses",
    ),
    "config": (
        "federatedconfigmaps",
        "federatedsecrets",
        "federatedserviceaccounts",
        "federatedlimitranges",
    ),
    "storage": ("federatedpersistentvolumeclaims",),
}


def _workspace_of(item: dict) -> str:
    template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
    labels = (item.get("metadata") or {}).get("labels") or {}
    return template.get("kubesphere.io/workspace") or labels.get("kubesphere.io/workspace") or ""


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-02 联邦项目详情资源页签。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", NAMESPACES)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取联邦项目（federatednamespaces）")
    projects = [
        item
        for item in (body.get("items") or [])
        if (item.get("metadata") or {}).get("name") and _workspace_of(item)
    ]
    if not projects:
        pytest.skip("没有带 workspace 标签的 FederatedNamespace")

    project = projects[0]
    name = (project.get("metadata") or {}).get("name")
    namespace = (project.get("metadata") or {}).get("namespace") or name
    workspace = _workspace_of(project)

    expected_counts = {}
    for tab, plurals in GROUPS.items():
        total = 0
        for plural in plurals:
            status, collection = ui.api.request(
                "GET", f"{FEDERATED}/namespaces/{namespace}/{plural}"
            )
            assert status == 200, (plural, status, collection)
            total += len((collection or {}).get("items") or [])
        expected_counts[tab] = total

    ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects/{name}")
    surface = ui.page.locator(SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    for tab in ("overview", "workloads", "config", "storage"):
        expect(ui.page.locator(f'[data-ai-id="federated-project:tab:{tab}:trigger"]')).to_be_visible()

    # Default tab is the overview and it keeps the basic information.
    expect(ui.page.locator('[data-ai-id="federated-project:tab:overview"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="federated-project:basic"]')).to_be_visible()
    types_root = ui.page.locator('[data-ai-id="federated-project:types"]')
    expect(types_root).to_be_visible()

    for tab, expected in expected_counts.items():
        ui.page.locator(f'[data-ai-id="federated-project:tab:{tab}:trigger"]').click()
        panel = ui.page.locator(f'[data-ai-id="federated-project:tab:{tab}"]')
        expect(panel).to_be_visible(timeout=30_000)
        expect(ui.page.locator('[data-ai-id="federated-project:tab:overview"]')).to_have_count(0)

        table = ui.page.locator(f'[data-ai-id="federated-project:resources:{tab}"]')
        empty = ui.page.locator(f'[data-ai-id="federated-project:resources:{tab}:empty"]')
        if expected == 0:
            expect(empty).to_be_visible(timeout=60_000)
            assert "还没有此类已联邦资源" in empty.inner_text(), empty.inner_text()
            expect(table).to_have_count(0)
        else:
            expect(table).to_be_visible(timeout=60_000)
            headers = [
                text.strip()
                for text in table.locator("thead th").all_inner_texts()
                if text.strip()
            ]
            assert headers == ["名称", "类型", "创建时间"], headers
            expect(table.locator("tbody tr[data-ai-row]")).to_have_count(expected, timeout=60_000)

    ui.page.locator('[data-ai-id="federated-project:tab:overview:trigger"]').click()
    expect(ui.page.locator('[data-ai-id="federated-project:basic"]')).to_be_visible(timeout=30_000)
    screenshot(ui.page, "federated-project-tabs")
