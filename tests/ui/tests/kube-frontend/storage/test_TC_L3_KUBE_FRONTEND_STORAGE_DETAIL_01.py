from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-01 存储卷详情：八项属性顺序与取值。"""

    ui = kube_storage_page
    name = ui.unique("detail")
    storage_class = ui.writable_storage_class()
    try:
        ui.create_pvc(name, storage_class=storage_class)

        # Enter through the list's name link, which is the path the criterion names.
        ui.open("persistentvolumeclaims")
        ui.click_name("persistentvolumeclaims", name)
        ui.page.wait_for_url(f"**/persistentvolumeclaims/{name}")
        expect(ui.detail_surface("persistentvolumeclaims")).to_be_visible()
        ui.wait_detail_ready("persistentvolumeclaims")

        labels = ui.attribute_labels("persistentvolumeclaims")
        # The eight attributes the criterion pins, in this relative order. The
        # detail also carries 状态 and 供应者 (covered by DETAIL-02); extra fields
        # between them do not violate the promised order.
        required = ["集群", "项目", "存储类型", "容量", "访问模式", "持久卷", "创建时间", "创建者"]
        assert [label for label in labels if label in required] == required, labels
        assert ui.attribute_value("persistentvolumeclaims", "集群") == "host"
        assert ui.attribute_value("persistentvolumeclaims", "项目") == "default"
        assert ui.attribute_value("persistentvolumeclaims", "容量") == "1Gi"
        assert ui.attribute_value("persistentvolumeclaims", "访问模式") == "RWO"
        if storage_class:
            assert ui.attribute_value("persistentvolumeclaims", "存储类型") == storage_class
        # The backing volume is empty until a provisioner binds the claim; the
        # attribute must still render rather than disappear.
        assert ui.attribute_value("persistentvolumeclaims", "持久卷") != ""
        # No creator annotation on a claim this test made, so the documented
        # placeholder is what the detail shows.
        assert ui.attribute_value("persistentvolumeclaims", "创建者") == "-"
        screenshot(ui.page, "detail")
    finally:
        ui.delete_pvc(name)
