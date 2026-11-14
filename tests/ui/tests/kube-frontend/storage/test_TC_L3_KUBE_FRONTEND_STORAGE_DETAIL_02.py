from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_02(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL-02 存储详情：状态与供应者。"""

    ui = kube_storage_page
    name = ui.unique("sd")
    try:
        assert ui.create_pvc(name) in (200, 201), "could not create the test claim"
        ui.open_detail("persistentvolumeclaims", name)
        ui.wait_detail_ready("persistentvolumeclaims")

        labels = ui.attribute_labels("persistentvolumeclaims")
        # A detail page that omits the status — the field people open it to check — is
        # the wrong shape, and the old console shows it.
        assert "状态" in labels, labels
        assert "供应者" in labels, labels

        status = ui.attribute_value("persistentvolumeclaims", "状态")
        # Same vocabulary as the list; an English value here would mean the detail
        # forgot to translate what the list translates.
        assert status in ("已绑定", "等待中", "已丢失", "扩容中", "等待文件系统扩容"), status
        screenshot(ui.page, "storage-detail-status")
    finally:
        ui.delete_pvc(name)
