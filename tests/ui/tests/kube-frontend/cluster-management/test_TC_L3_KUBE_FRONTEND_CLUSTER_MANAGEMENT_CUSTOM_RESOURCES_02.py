from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CRDS = "/apis/apiextensions.k8s.io/v1/customresourcedefinitions"


def _read_version(spec: dict) -> str | None:
    versions = spec.get("versions") or []
    storage = next((v.get("name") for v in versions if v.get("storage")), None)
    served = next((v.get("name") for v in versions if v.get("served", True)), None)
    return storage or served


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_RESOURCES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-02 自定义资源：详情与实例列表。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{CRDS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取 CRD 列表")

    # Prefer a CRD that already has instances: the point of the page is the instance
    # list, and an empty one would pass without exercising it.
    target = None
    for crd in body.get("items") or []:
        spec = crd.get("spec") or {}
        group = spec.get("group")
        plural = (spec.get("names") or {}).get("plural")
        version = _read_version(spec)
        if not (group and plural and version):
            continue
        inst_status, inst_body = ui.api.request(
            "GET", f"/apis/{group}/{version}/{plural}?limit=-1"
        )
        items = (inst_body.get("items") or []) if inst_status == 200 and isinstance(inst_body, dict) else []
        if items:
            target = {
                "name": crd["metadata"]["name"],
                "kind": (spec.get("names") or {}).get("kind"),
                "group": group,
                "version": version,
                "scope": spec.get("scope"),
                "instances": len(items),
                "first_namespace": (items[0].get("metadata") or {}).get("namespace"),
            }
            break
    if target is None:
        pytest.skip("没有带实例的 CRD，无法核对详情")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/custom-resources")
    surface = ui.page.locator('[data-ai-id="custom-resources:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Reach the detail the way a reader does: search the kind, click it.
    ui.page.locator('[data-ai-id="custom-resources:search"]').last.fill(target["kind"])
    ui.page.wait_for_timeout(900)
    link = ui.page.locator(f'[data-ai-id="custom-resources:kind:{target["name"]}"] a').first
    expect(link).to_be_visible(timeout=20_000)
    link.click()

    detail = ui.page.locator('[data-ai-id="custom-resource:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert f"/custom-resources/{target['name']}" in ui.page.url, ui.page.url

    attributes = ui.page.locator('[data-ai-id="custom-resource:attributes"]').last.inner_text()
    for expected in (target["kind"], target["group"], target["version"]):
        assert expected in attributes, f"定义区缺少 {expected}: {attributes[:200]}"
    scope_label = "命名空间级" if target["scope"] == "Namespaced" else "集群级"
    assert scope_label in attributes, f"作用域应为 {scope_label}: {attributes[:200]}"

    rows = detail.locator("[data-ai-row]")
    assert rows.count() == target["instances"], (
        f"实例行数 {rows.count()} 与 {target['version']} 下 {target['group']}/{target['instances']} 不一致"
    )

    # A namespaced kind's instances must say which project each lives in; without it two
    # same-named objects in different projects are indistinguishable.
    if target["scope"] == "Namespaced" and target["first_namespace"]:
        assert target["first_namespace"] in detail.inner_text(), "命名空间级实例未显示所属项目"

    screenshot(ui.page, "cluster-custom-resource-detail")
