from __future__ import annotations

import copy
import json
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"
ANNOTATION = "alerting.kubesphere.io/initial-configuration"
MARKER = " [tc-reset-probe]"


def _get(api, path: str) -> dict:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body


def _wait_spec(api, path: str, initial_spec: dict, timeout: float = 60) -> dict:
    deadline = time.time() + timeout
    last: dict = {}
    while time.time() < deadline:
        last = _get(api, path)
        if last.get("spec") == initial_spec:
            return last
        time.sleep(1)
    return last


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_ALERTING_WRITE_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02 集群告警：内置策略恢复初始配置。"""

    ui = cluster_management_page
    assert ui.api is not None

    groups = _get(ui.api, f"{API}/globalrulegroups").get("items") or []
    target = None
    initial_spec = None
    for group in groups:
        encoded = ((group.get("metadata") or {}).get("annotations") or {}).get(ANNOTATION)
        if not encoded:
            continue
        try:
            initial = json.loads(encoded)
        except ValueError:
            continue
        spec = initial.get("spec")
        if isinstance(spec, dict) and spec == group.get("spec") and (spec.get("rules") or []):
            target = group
            initial_spec = spec
            break
    if target is None or initial_spec is None:
        pytest.skip("没有带初始配置注解且 spec 与注解一致的内置策略")

    name = target["metadata"]["name"]
    path = f"{API}/globalrulegroups/{name}"
    snapshot = copy.deepcopy(target)
    try:
        # ---- UI: built-in tab row offers reset ----
        ui.page.goto(ui.url("alerting-policies"))
        surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:builtin"]').click()
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        expect(ui.page.get_by_role("menuitem", name="恢复初始配置", exact=True)).to_be_visible(timeout=20_000)
        ui.page.keyboard.press("Escape")

        # ---- make the rules differ from the initial configuration ----
        mutated = copy.deepcopy(initial_spec)
        rules = mutated.get("rules") or []
        annotations = rules[0].setdefault("annotations", {})
        annotations["description"] = str(annotations.get("description") or "") + MARKER
        status, body = ui.api.request(
            "PATCH",
            path,
            {"spec": {"rules": rules}},
            "application/merge-patch+json",
        )
        assert status == 200, f"制造差异失败: {status} {body}"
        assert _get(ui.api, path).get("spec") != initial_spec, "PATCH 没有改到规则"

        # ---- reset through the confirmed dialog ----
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="恢复初始配置", exact=True).click()
        dialog = ui.page.locator('[data-ai-id="cluster-alerting-policies:reset-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        assert "覆盖" in dialog.inner_text(), dialog.inner_text()
        ui.page.locator('[data-ai-id="cluster-alerting-policies:reset-confirm"]').click()

        reset_item = _wait_spec(ui.api, path, initial_spec)
        assert reset_item.get("spec") == initial_spec, "reset 后 spec 与初始配置不一致"
        # Reset restores rules only; the operator's enable/disable state stays as it was.
        assert (reset_item.get("metadata") or {}).get("labels") == (snapshot.get("metadata") or {}).get("labels")
        expect(ui.page.locator('[data-ai-id="cluster-alerting-policies:reset-success"]')).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="cluster-alerting-policies:reset-error"]')).to_have_count(0, timeout=5_000)

        screenshot(ui.page, "cluster-alerting-policy-reset")
    finally:
        # Reset changes real rules; always put the snapshot back, annotations and all.
        current = _get(ui.api, path)
        restore = copy.deepcopy(current)
        restore["spec"] = copy.deepcopy(snapshot.get("spec") or {})
        restore.setdefault("metadata", {})["labels"] = copy.deepcopy((snapshot.get("metadata") or {}).get("labels") or {})
        status, body = ui.api.request("PUT", path, restore)
        assert status == 200, f"复原失败: {status} {body}"
        assert _get(ui.api, path).get("spec") == snapshot.get("spec"), "finally 未恢复到快照 spec"
