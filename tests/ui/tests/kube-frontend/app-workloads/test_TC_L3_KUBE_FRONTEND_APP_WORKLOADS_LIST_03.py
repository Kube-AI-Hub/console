from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03 工作负载列表：空态标题与说明。"""

    ui = app_workloads_page

    # The criterion starts from "the project has no object of this kind". Ingresses
    # are the one project workload the platform does not seed, so it is the honest
    # candidate; if the project has grown one, the precondition no longer holds and
    # the test says so instead of asserting an empty page that should not be empty.
    total = ui.api_total("ingresses")
    if total != 0:
        pytest.skip(f"precondition not met: default project already has {total} ingress(es)")

    ui.open("ingresses")
    assert ui.state("ingresses") == "empty", ui.state("ingresses")

    text = ui.surface("ingresses").inner_text()
    assert "暂无应用路由" in text, text
    assert "创建应用路由后，这里会列出它们。" in text, text
    # No header over an empty list: a head row above "no data" reads as a table
    # whose rows failed to load. The old console shows an empty card instead.
    assert ui.surface("ingresses").locator("thead").count() == 0
    screenshot(ui.page, "empty")
