from __future__ import annotations

import base64
import json
import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SECRETS = "/api/v1/namespaces/default/secrets"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/secrets"
DEFAULT_KEY = "secret.kubesphere.io/is-default-class"


def _dockerconfig(name: str) -> dict:
    payload = base64.b64encode(json.dumps({"auths": {"registry.example.com": {}}}).encode()).decode()
    return {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {"name": name, "namespace": "default"},
        "type": "kubernetes.io/dockerconfigjson",
        "data": {".dockerconfigjson": payload},
    }


def _create(ui, name: str) -> None:
    status, payload = ui.api.request("POST", SECRETS, _dockerconfig(name))
    assert status in (200, 201), f"创建 Secret {name} 失败：{status} {repr(payload)[:200]}"


def _delete(ui, name: str) -> None:
    ui.api.request("DELETE", f"{SECRETS}/{quote(name)}")


def _is_default(ui, name: str) -> bool:
    status, body = ui.api.request("GET", f"{KAPIS}/{quote(name)}")
    if status != 200 or not isinstance(body, dict):
        return False
    annotations = (body.get("metadata") or {}).get("annotations") or {}
    return annotations.get(DEFAULT_KEY) == "true"


def _wait_default(ui, name: str, expected: bool, timeout: float = 30) -> None:
    deadline = time.time() + timeout
    seen = None
    while time.time() < deadline:
        seen = _is_default(ui, name)
        if seen is expected:
            return
        time.sleep(1)
    raise AssertionError(f"{name} 的默认标记应为 {expected}，实际 {seen}")


def _search(ui, surface, name: str) -> None:
    ui.page.locator('[data-ai-id="secrets:search"]').fill(name)
    expect(surface.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)
    expect(surface.locator("[data-ai-row]")).to_have_count(1, timeout=30_000)
    ui.page.wait_for_timeout(400)


def _set_default(ui, name: str, previous_hint: str) -> None:
    row = ui.page.locator(f'[data-ai-row="{name}"]')
    expect(row).to_be_visible(timeout=30_000)
    row.get_by_role("button", name="更多操作").click()
    ui.page.get_by_role("menuitem", name="设为默认镜像仓库").click()
    dialog = ui.page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=20_000)
    body = dialog.inner_text()
    assert name in body, f"确认框应写明目标对象：{body[:200]}"
    if previous_hint:
        assert previous_hint in body, f"确认框应写明会取消哪个旧默认：{body[:200]}"
    dialog.locator('[data-ai-id="secrets:set-default-confirm"]').click()
    expect(dialog).to_have_count(0, timeout=30_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_LIST_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-LIST-04 保密字典列表：设为默认镜像仓库。"""

    ui = app_workloads_page
    assert ui.api is not None

    stamp = int(time.time()) % 100000
    first = f"tc-e2e-reg-{stamp}-a"
    second = f"tc-e2e-reg-{stamp}-b"
    _create(ui, first)
    _create(ui, second)
    try:
        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/secrets")
        surface = ui.page.locator('[data-ai-id="secrets:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        # Search each Secret by its exact name: the kapis name filter is exact, so a shared
        # prefix would return nothing and the case would fail on "no rows" rather than on the
        # behaviour under test.
        _search(ui, surface, first)
        _set_default(ui, first, "")
        _wait_default(ui, first, True)
        screenshot(ui.page, "secrets-set-default")

        # The second one takes the mark and the first loses it — never two defaults.
        _search(ui, surface, second)
        _set_default(ui, second, first)
        _wait_default(ui, second, True)
        _wait_default(ui, first, False)
    finally:
        _delete(ui, first)
        _delete(ui, second)