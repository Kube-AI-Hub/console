from __future__ import annotations

from pathlib import Path
import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_04(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04 组件、可见性与安全配置工具。"""
    ui = cluster_overview_page
    assert ui.api is not None
    requests = []
    ui.page.on("request", lambda request: requests.append(request))
    ui.open()
    ui.wait_ready()
    expect(ui.control("components")).to_be_visible()
    status, components = ui.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/components")
    assert status == 200
    groups = {"kubeaihub": "kubesphere-system", "kubernetes": "kube-system", "istio": "istio-system",
              "monitoring": "kubesphere-monitoring-system", "logging": "kubesphere-logging-system", "devops": "kubesphere-devops-system"}
    for group, namespace in groups.items():
        expect(ui.control(f"component:{group}")).to_have_attribute(
            "href", f"/kube-frontend/clusters/{ui.cluster}/components?type={group}")
        count = sum(item.get("namespace") == namespace for item in components)
        expect(ui.control(f"component-count:{group}")).to_have_text(str(count))
    cluster = ui.cluster_object()
    public = cluster["metadata"].get("labels", {}).get("cluster.kubesphere.io/visibility") == "public"
    expect(ui.control("visibility")).to_contain_text("所有企业空间" if public else "只有被授权")
    ui.control("component:monitoring").click()
    expect(ui.component_group()).to_contain_text("监控")
    expect(ui.components_rows()).to_have_count(sum(item.get("namespace") == groups["monitoring"] for item in components))
    ui.component_group().click()
    ui.page.get_by_role("option", name="全部组件", exact=True).click()
    expect(ui.components_rows()).to_have_count(len(components))
    ui.open()
    ui.wait_ready()
    assert not any("/users/" in request.url and request.url.endswith("/kubeconfig") for request in requests)
    with ui.page.expect_response(lambda response: response.url.endswith("/kubeconfig")) as configuration:
        ui.control("kubeconfig-open").click()
    try:
        expect(ui.control("kubeconfig-content")).to_be_visible()
        has_version = ui.control("kubeconfig-content").input_value().startswith("apiVersion:")
        readonly = ui.control("kubeconfig-content").get_attribute("readonly") is not None
    finally:
        ui.control("kubeconfig-close").click()
    assert configuration.value.status == 200 and has_version and readonly
    expect(ui.control("kubeconfig-content")).to_have_count(0)

    # Downloads and denial use non-sensitive mocked text, never real credentials in artifacts.
    text = "apiVersion: v1\nclusters: []\nusers: []\n"
    ui.page.route("**/users/*/kubeconfig", lambda route: route.fulfill(body=text, content_type="text/plain"))
    ui.control("kubeconfig-open").click()
    expect(ui.control("kubeconfig-content")).to_have_value(text)
    with ui.page.expect_download() as pending:
        ui.control("kubeconfig-download").click()
    download = pending.value
    assert download.suggested_filename == "kubeconfig.yaml"
    assert Path(download.path()).read_text() == text
    ui.control("kubeconfig-close").click()
    ui.page.unroute("**/users/*/kubeconfig")
    ui.page.route("**/users/*/kubeconfig", lambda route: route.fulfill(status=403, json={"message": "denied"}))
    with ui.page.expect_response(lambda response: response.url.endswith("/kubeconfig") and response.status == 403):
        ui.control("kubeconfig-open").click()
    expect(ui.control("kubeconfig-download")).to_have_count(0)
    expect(ui.control("kubeconfig-retry")).to_have_count(0)
    ui.control("kubeconfig-close").click()
    assert not any(request.method in ("PUT", "PATCH", "DELETE") for request in requests)
    screenshot(ui.page, "overview-tools-closed-no-credentials")
