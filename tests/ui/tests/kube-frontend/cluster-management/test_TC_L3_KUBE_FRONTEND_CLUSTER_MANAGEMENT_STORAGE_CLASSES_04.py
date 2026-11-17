from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SCS = "/apis/storage.k8s.io/v1/storageclasses"
PVCS = "/api/v1/namespaces/{namespace}/persistentvolumeclaims"
DEFAULT_KEYS = [
    "storageclass.kubernetes.io/is-default-class",
    "storageclass.beta.kubernetes.io/is-default-class",
    "storageclass.kubesphere.io/is-default-class",
]


def _unique(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000) % 1_000_000}"


def _get(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{SCS}/{name}")
    if status == 404:
        return None
    assert status == 200, (status, body)
    return body if isinstance(body, dict) else None


def _list(api) -> list[dict]:
    status, body = api.request("GET", f"{SCS}?limit=500")
    assert status == 200 and isinstance(body, dict), (status, body)
    return body.get("items") or []


def _patch(api, name: str, body: dict) -> None:
    status, _ = api.request(
        "PATCH",
        f"{SCS}/{name}",
        body,
        content_type="application/merge-patch+json",
    )
    assert status == 200, status


def _defaults(api) -> list[str]:
    names = []
    for item in _list(api):
        annotations = ((item.get("metadata") or {}).get("annotations") or {})
        if any(annotations.get(key) == "true" for key in DEFAULT_KEYS):
            names.append(str((item.get("metadata") or {}).get("name") or ""))
    return names


def _create_via_ui(ui, name: str, provisioner: str) -> None:
    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses', wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="storageclasses:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    ui.page.locator('[data-ai-id="storageclasses:create"]').click()
    dialog = ui.page.locator('[data-ai-id="storageclasses:create-dialog"]')
    expect(dialog).to_be_visible(timeout=20_000)
    ui.page.locator('[data-ai-id="storageclasses:create-name"]').fill(name)
    ui.page.locator('[data-ai-id="storageclasses:create-provisioner"]').fill(provisioner)
    # Reclaim/binding keep the Kubernetes defaults (Delete / Immediate) in this case.
    # B200 strips the two Kubesphere capability annotations on read (verified 2026-11-17:
    # the POST response carries them, a following GET has none). Those two flags are covered
    # by the API unit tests; the E2E verifies the setting that does persist here.
    ui.page.locator('[data-ai-id="storageclasses:create-expand"]').check()
    ui.page.locator('[data-ai-id="storageclasses:create-submit"]').click()
    expect(dialog).to_have_count(0, timeout=30_000)


def _wait(api, name: str, predicate, attempts: int = 30) -> dict:
    body = None
    for _ in range(attempts):
        body = _get(api, name)
        if body is not None and predicate(body):
            return body
        time.sleep(1)
    assert body is not None, name
    return body


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_STORAGE_CLASSES_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-04 存储类型写能力。"""

    ui = cluster_management_page
    assert ui.api is not None
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name_a = f"tc-e2e-sc-{stamp}-a"
    name_b = f"tc-e2e-sc-{stamp}-b"
    pvc_name = f"tc-e2e-pvc-{stamp}"
    namespace = "default"
    original_defaults = _defaults(api)
    original_default = original_defaults[0] if original_defaults else ""

    try:
        _create_via_ui(ui, name_a, "example.com/tc-e2e")
        created = _wait(api, name_a, lambda body: body.get("allowVolumeExpansion") is True)
        assert created.get("reclaimPolicy") == "Delete", created

        # ---- 编辑信息 + YAML ----
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses/{name_a}', wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="sc-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="sc-detail:edit-info"]').click()
        ui.page.locator('[data-ai-id="sc-detail:edit-alias"]').fill(f"e2e-{stamp}")
        ui.page.locator('[data-ai-id="sc-detail:edit-info-submit"]').click()
        expect(ui.page.locator('[data-ai-id="sc-detail:edit-info-submit"]')).to_have_count(0, timeout=30_000)
        alias_ready = _wait(
            api,
            name_a,
            lambda body: ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == f"e2e-{stamp}",
        )
        assert ((alias_ready.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == f"e2e-{stamp}"

        ui.page.locator('[data-ai-id="sc-detail:edit-yaml"]').click()
        editor = ui.page.locator(".cm-content")
        expect(editor).to_be_visible(timeout=30_000)
        line = ui.page.locator(".cm-line", has_text="kubesphere.io/alias-name").first
        expect(line).to_be_visible(timeout=20_000)
        box = line.bounding_box()
        ui.page.mouse.click(box["x"] + box["width"] - 4, box["y"] + box["height"] / 2)
        ui.page.keyboard.press("End")
        ui.page.keyboard.type("-yaml", delay=30)
        ui.page.locator('[data-ai-id="yaml:submit"]').click()
        expect(ui.page.locator('[data-ai-id="yaml:submit"]')).to_have_count(0, timeout=30_000)
        _wait(api, name_a, lambda body: ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == f"e2e-{stamp}-yaml")

        # ---- 卷功能：关闭扩容再打开（B200 不保留 clone/snapshot 注解，见上） ----
        ui.page.locator('[data-ai-id="sc-detail:features"]').click()
        dialog = ui.page.locator('[data-ai-id="sc-detail:features-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="sc-detail:feature:expansion"]').uncheck()
        ui.page.locator('[data-ai-id="sc-detail:features-submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        _wait(api, name_a, lambda body: not body.get("allowVolumeExpansion"))
        ui.page.locator('[data-ai-id="sc-detail:features"]').click()
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="sc-detail:feature:expansion"]').check()
        ui.page.locator('[data-ai-id="sc-detail:features-submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        features_on = _wait(api, name_a, lambda body: body.get("allowVolumeExpansion") is True)
        assert features_on.get("allowVolumeExpansion") is True

        # ---- 设为默认，并恢复原默认 ----
        ui.page.locator('[data-ai-id="sc-detail:set-default"]').click()
        _wait(api, name_a, lambda body: any(((body.get("metadata") or {}).get("annotations") or {}).get(key) == "true" for key in DEFAULT_KEYS))
        if original_default:
            for item in _list(api):
                name = str((item.get("metadata") or {}).get("name") or "")
                if name == name_a:
                    continue
                annotations = ((item.get("metadata") or {}).get("annotations") or {})
                if any(annotations.get(key) == "true" for key in DEFAULT_KEYS):
                    assert False, f"second default left: {name}"
            _patch(api, original_default, {"metadata": {"annotations": {DEFAULT_KEYS[0]: "true"}}})

        # ---- PVC 守卫 + 批量跳过 ----
        pvc_body = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {"name": pvc_name, "namespace": namespace},
            "spec": {
                "accessModes": ["ReadWriteOnce"],
                "storageClassName": name_a,
                "resources": {"requests": {"storage": "1Gi"}},
            },
        }
        status, body = api.request("POST", PVCS.format(namespace=namespace), pvc_body)
        assert status in (200, 201), (status, body)

        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses/{name_a}', wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="sc-detail:delete"]')).to_be_disabled(timeout=90_000)
        expect(ui.page.locator('[data-ai-id="sc-detail:delete-protected"]')).to_be_visible(timeout=20_000)
        screenshot(ui.page, "storageclass-delete-protected")

        created_b = api.request(
            "POST",
            SCS,
            {
                "apiVersion": "storage.k8s.io/v1",
                "kind": "StorageClass",
                "metadata": {"name": name_b},
                "provisioner": "example.com/tc-e2e",
                "reclaimPolicy": "Delete",
                "volumeBindingMode": "Immediate",
            },
        )
        assert created_b[0] in (200, 201), created_b
        ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses', wait_until="domcontentloaded")
        surface = ui.page.locator('[data-ai-id="storageclasses:surface"]')
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        for name in (name_a, name_b):
            ui.page.locator(f'[data-ai-id="storageclasses:select:{name}"]').check()
        ui.page.locator('[data-ai-id="storageclasses:bulk-delete"]').click()
        confirm = ui.page.locator('[data-ai-id="storageclasses:delete-confirm"]')
        input_box = ui.page.locator('[data-ai-id="storageclasses:delete-input"]')
        # One deletable class means the confirmation text is that class's name; if the
        # page still sees both as deletable, it asks for the count. Derive it instead of
        # assuming which render won.
        input_box.fill(name_b)
        if confirm.is_disabled():
            input_box.fill("2")
        confirm.click()
        expect(ui.page.locator('[data-ai-id="storageclasses:delete-confirm"]')).to_have_count(0, timeout=60_000)
        result = ui.page.locator('[data-ai-id="storageclasses:batch-result"]')
        expect(result).to_be_visible(timeout=30_000)
        assert result.get_attribute("data-ai-deleted") == "1", result.inner_text()
        assert result.get_attribute("data-ai-skipped") == "1", result.inner_text()
        assert _get(api, name_b) is None
        assert _get(api, name_a) is not None
    finally:
        api.request("DELETE", PVCS.format(namespace=namespace) + f"/{pvc_name}")
        for name in (name_a, name_b):
            api.request("DELETE", f"{SCS}/{name}")
        if original_default:
            try:
                _patch(api, original_default, {"metadata": {"annotations": {DEFAULT_KEYS[0]: "true"}}})
            except Exception:  # noqa: BLE001 - 清理尽力而为
                pass
