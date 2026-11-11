from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_AI_SURFACE_01(cluster_configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01 智能体句柄。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    ids = cluster_configmaps_page.ai_ids()
    for required in (
        "cluster-configmaps:surface",
        "cluster-configmaps:search",
        "cluster-configmaps:create",
        "cluster-configmaps:bulk-delete",
    ):
        assert required in ids, f"缺少句柄 {required}: {ids}"

    # Row handles carry the project so two same-named objects stay distinct.
    select_ids = [value for value in ids if value.startswith("cluster-configmaps:select:")]
    assert select_ids, ids
    assert all(value.split(":", 2)[2].count("/") == 1 for value in select_ids), select_ids

    screenshot(cluster_configmaps_page.page, "cluster-ai-surface")
