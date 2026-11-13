from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01 存储：详情八项属性。"""

    ui = storage_page
    name = ui.unique("detail")
    try:
        assert ui.create_pvc(name) in (200, 201), "could not create the test claim"

        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")
        ui.click_name("persistentvolumeclaims", name)

        expect(ui.detail_surface("persistentvolumeclaims")).to_be_visible()
        ui.page.wait_for_url(f"**/persistentvolumeclaims/{name}")
        ui.wait_detail_ready("persistentvolumeclaims")

        labels = ui.attribute_labels("persistentvolumeclaims")
        # The required set, in the order a reader scans it. Written as a subsequence
        # check rather than an exact list so adding an attribute (状态、供应者 were added
        # later) does not break a case that is really about these eight being present.
        required = ["集群", "项目", "存储类型", "容量", "访问模式", "持久卷", "创建时间", "创建者"]
        positions = [labels.index(label) for label in required if label in labels]
        assert len(positions) == len(required), f"missing attributes: {set(required) - set(labels)}"
        assert positions == sorted(positions), f"attributes out of order: {labels}"
        assert ui.attribute_value("persistentvolumeclaims", "集群") == "host"
        assert ui.attribute_value("persistentvolumeclaims", "项目") == "default"
        assert ui.attribute_value("persistentvolumeclaims", "容量") == "1Gi"
        assert ui.attribute_value("persistentvolumeclaims", "访问模式") == "RWO"
        screenshot(ui.page, "storage-detail")
    finally:
        ui.delete_pvc(name)
