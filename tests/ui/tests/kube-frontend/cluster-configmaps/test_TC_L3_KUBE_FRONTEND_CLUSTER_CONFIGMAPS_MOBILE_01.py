from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_MOBILE_01(cluster_configmaps_page, page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-MOBILE-01 手机宽度。"""
    original = page.viewport_size
    page.set_viewport_size({"width": 390, "height": 780})
    try:
        cluster_configmaps_page.open()
        cluster_configmaps_page.wait_ready()

        widths = page.evaluate(
            "() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })"
        )
        assert widths["scroll"] == widths["client"], widths

        # The project column must survive: without it two same-named rows are
        # indistinguishable on a phone.
        assert "项目" in cluster_configmaps_page.headers, cluster_configmaps_page.headers
        screenshot(page, "cluster-mobile")
    finally:
        page.set_viewport_size(original)
