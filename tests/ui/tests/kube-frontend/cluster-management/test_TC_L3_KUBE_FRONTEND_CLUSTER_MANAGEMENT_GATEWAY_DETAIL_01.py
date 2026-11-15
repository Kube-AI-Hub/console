from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

GROUP = "/apis/gateway.kubesphere.io/v1alpha1"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"
CONTROLS_NAMESPACE = "kubesphere-controls-system"
CLUSTER_NAMESPACES = {"kubesphere-system", "kubesphere-controls-system"}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GATEWAY_DETAIL_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-01 集群网关详情。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, body = ui.api.request("GET", f"{GROUP}/gateways")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("网关 API 不可用")
    gateways = body.get("items") or []
    cluster_gateways = [
        item for item in gateways if ((item.get("metadata") or {}).get("namespace")) in CLUSTER_NAMESPACES
    ]
    if not cluster_gateways:
        pytest.skip("集群没有集群网关")
    gateway = cluster_gateways[0]
    name = (gateway.get("metadata") or {}).get("name") or ""

    # The ingress class comes from the Nginx CR that manages this gateway.
    status, nginx_body = ui.api.request("GET", f"{GROUP}/namespaces/{CONTROLS_NAMESPACE}/nginxes")
    nginx_items = (nginx_body.get("items") or []) if status == 200 and isinstance(nginx_body, dict) else []
    nginx = next(
        (
            item
            for item in nginx_items
            if ((item.get("spec") or {}).get("fullnameOverride") == name)
            or ((item.get("metadata") or {}).get("name") == name + "-ingress")
        ),
        None,
    )
    if nginx is None:
        pytest.skip("没有找到该网关的 Nginx CR")
    controller = (nginx.get("spec") or {}).get("controller") or {}
    ingress_class = controller.get("ingressClass") or ""

    status, ingress_body = ui.api.request("GET", f"{KAPIS}/ingresses?limit=-1", timeout=60)
    ingress_items = (ingress_body.get("items") or []) if status == 200 and isinstance(ingress_body, dict) else []
    expected_ingresses = [
        item for item in ingress_items if ((item.get("spec") or {}).get("ingressClassName") or "") == ingress_class
    ]

    # Enter through the list, not by typing the URL: that link is part of the deliverable.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gateways/cluster")
    list_surface = ui.page.locator('[data-ai-id="cluster-gateways:surface"]').last
    expect(list_surface).to_be_visible(timeout=30_000)
    expect(list_surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    link = ui.page.locator(f'[data-ai-id="cluster-gateways:name:{name}"]')
    expect(link).to_be_visible(timeout=20_000)
    link.click()

    expect(ui.page).to_have_url(re.compile(r"/gateways/" + re.escape(name) + "$"), timeout=20_000)
    surface = ui.page.locator('[data-ai-id="gateway-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    assert name in surface.inner_text()
    attributes = ui.page.locator('[data-ai-id="gateway-detail:attributes"]')
    expect(attributes).to_be_visible(timeout=20_000)
    attributes_text = attributes.inner_text()
    # 创建者 and 链路追踪 are on the old console card; both come from the same Gateway CR.
    for label in ("访问地址", "端口", "IngressClass", "TLS", "副本数", "镜像", "创建者", "链路追踪"):
        assert label in attributes_text, f"属性缺「{label}」: {attributes_text[:300]}"

    ingress_section = ui.page.locator('[data-ai-id="gateway-detail:ingresses"]')
    expect(ingress_section).to_be_visible(timeout=20_000)
    if expected_ingresses:
        rows = ingress_section.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(len(expected_ingresses), timeout=30_000)
        handles = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        wanted = {
            ((item.get("metadata") or {}).get("namespace")) + "/" + ((item.get("metadata") or {}).get("name"))
            for item in expected_ingresses
        }
        assert set(handles) == wanted, handles
        href = rows.first.locator("a").first.get_attribute("href") or ""
        assert "/ingresses/" in href, href
    else:
        # B200 currently has no Ingress at all; the explicit empty state is the
        # shipped outcome and must not be a blank section.
        empty = ingress_section.locator('[data-ai-id="gateway-detail:ingresses-empty"]')
        expect(empty).to_be_visible(timeout=20_000)
        assert "关联的应用路由" in empty.inner_text()

    # Read-only: no install/edit/delete control on the detail.
    action_labels = surface.locator("button").all_inner_texts()
    for forbidden in ("安装", "编辑", "删除", "升级"):
        assert not any(forbidden in label for label in action_labels), (forbidden, action_labels)

    screenshot(ui.page, "gateway-detail")