from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_02(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-02 存储卷列表：空态标题与说明且无表头。"""

    ui = kube_storage_page

    # The criterion starts from "the project has no claim". Checking first is what
    # keeps a populated project from reading as a product defect; the fix is to
    # clean the leftovers, not to assert an empty page that should not be empty.
    # `default` is shared with every other suite, so probe the demo project first
    # and fall back only to projects that the API also reports as empty.
    candidates = ["kube-frontend-demo", "kube-public", ui.namespace]
    probe = None
    for namespace in candidates:
        candidate = ui.for_namespace(namespace)
        if candidate.api_total("persistentvolumeclaims") == 0:
            probe = candidate
            break
    if probe is None:
        pytest.skip(f"precondition not met: none of {candidates} is free of PVCs")

    probe.open("persistentvolumeclaims")
    assert probe.state("persistentvolumeclaims") == "empty", probe.state("persistentvolumeclaims")

    text = probe.surface("persistentvolumeclaims").inner_text()
    assert "暂无存储卷" in text, text
    assert "创建存储卷后，这里会列出它们。" in text, text
    # No header over an empty list: a head row above "no data" reads as a table
    # whose rows failed to load. The old console shows an empty card instead.
    assert probe.surface("persistentvolumeclaims").locator("thead").count() == 0
    screenshot(probe.page, "empty")
