from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


def _choose_tag(dialog, page, label: str) -> None:
    """Pick a tag from the shared Select.

    The field is a Radix Select now (the same component 添加集群 uses), not a native
    `<select>`: `select_option` does not apply, and the option list lives in a portal
    outside the dialog.
    """
    dialog.locator("#ai-field-cluster-edit-group").click()
    page.get_by_role("option", name=label, exact=True).click()
    page.wait_for_timeout(300)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_EDIT_INFO_01(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01 集群列表：编辑信息写回别名/标签/供应商/描述。"""

    ui = cluster_fleet_page
    assert ui.api is not None
    cluster = ui_config.cluster

    status, before = ui.api.request("GET", f"{CLUSTERS}/{cluster}")
    assert status == 200, (status, before)
    before_meta = before.get("metadata") or {}
    before_spec = before.get("spec") or {}
    # Captured so the case can put the cluster back exactly as it found it.
    original = {
        "annotations": dict(before_meta.get("annotations") or {}),
        "labels": dict(before_meta.get("labels") or {}),
        "provider": before_spec.get("provider") or "",
    }
    alias_before = original["annotations"].get("kubesphere.io/alias-name", "")
    group_before = original["labels"].get("cluster.kubesphere.io/group", "")
    provider_before = original["provider"]

    try:
        ui.open()
        ui.wait_ready()

        dialog = ui.open_edit(cluster)
        # The name is the object's identity: every URL and the federation reference it, so
        # the field is shown but not editable.
        expect(dialog.locator("#ai-field-cluster-edit-name")).to_be_disabled()

        dialog.locator("#ai-field-cluster-edit-alias").fill("E2E 别名")
        _choose_tag(dialog, ui.page, "测试")
        dialog.locator('[data-ai-id="clusters:edit-provider"]').click()
        ui.page.get_by_role("option", name="Kube AI Hub", exact=True).first.click()
        dialog.locator("#ai-field-cluster-edit-description").fill("由 E2E 写入")
        ui.page.locator('[data-ai-id="clusters:edit-submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)

        # Read every field back: "the dialog closed" is not evidence that anything was
        # written, and a merge patch that omits a key leaves the old value in place.
        status, after = ui.api.request("GET", f"{CLUSTERS}/{cluster}")
        assert status == 200, (status, after)
        meta = after.get("metadata") or {}
        annotations = meta.get("annotations") or {}
        labels = meta.get("labels") or {}
        assert annotations.get("kubesphere.io/alias-name") == "E2E 别名", annotations
        assert annotations.get("kubesphere.io/description") == "由 E2E 写入", annotations
        assert labels.get("cluster.kubesphere.io/group") == "testing", labels
        assert (after.get("spec") or {}).get("provider") == "Kube AI Hub", after.get("spec")

        # The list shows the alias, and the object name stays readable underneath so the
        # two are never confused.
        # The name cell carries its own handle; counting `td` positions picks up the
        # status column as soon as a column is added.
        name_cell = ui.row(cluster).locator(f'[data-ai-id="clusters:name:{cluster}"]').inner_text()
        assert "E2E 别名" in name_cell, name_cell
        assert cluster in name_cell, name_cell
        screenshot(ui.page, "cluster-edit-info")

        # Clearing has to delete the keys, not leave them: an absent key in a merge patch
        # means "unchanged", which is the failure this asserts against.
        dialog = ui.open_edit(cluster)
        dialog.locator("#ai-field-cluster-edit-alias").fill("")
        dialog.locator("#ai-field-cluster-edit-description").fill("")
        _choose_tag(dialog, ui.page, "无")
        ui.page.locator('[data-ai-id="clusters:edit-submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)

        status, cleared = ui.api.request("GET", f"{CLUSTERS}/{cluster}")
        assert status == 200
        cleared_annotations = (cleared.get("metadata") or {}).get("annotations") or {}
        cleared_labels = (cleared.get("metadata") or {}).get("labels") or {}
        assert "kubesphere.io/alias-name" not in cleared_annotations, cleared_annotations
        assert "kubesphere.io/description" not in cleared_annotations, cleared_annotations
        assert "cluster.kubesphere.io/group" not in cleared_labels, cleared_labels
    finally:
        # The cluster is the platform's own host object; putting its annotations back is
        # part of the case, not cleanup of test data.
        annotations = dict(original["annotations"])
        labels = dict(original["labels"])
        restore = {
            "metadata": {
                "annotations": {
                    "kubesphere.io/alias-name": alias_before or None,
                    "kubesphere.io/description": annotations.get("kubesphere.io/description") or None,
                },
                "labels": {"cluster.kubesphere.io/group": group_before or None},
            },
            "spec": {"provider": provider_before},
        }
        # Merge patch, not a JSON patch: this only touches the keys it names.
        ui.api.request(
            "PATCH", f"{CLUSTERS}/{cluster}", restore, content_type="application/merge-patch+json"
        )
