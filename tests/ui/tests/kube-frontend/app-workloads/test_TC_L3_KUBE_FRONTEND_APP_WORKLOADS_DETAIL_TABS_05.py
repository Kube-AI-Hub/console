from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
SECRET_VALUE = "s3cr3t-value"
CONFIGMAP_VALUE = "hello-from-configmap"


def _create_pod(ui, name: str, spec: dict) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        "spec": {"terminationGracePeriodSeconds": 0, "nodeSelector": UNSCHEDULABLE, **spec},
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _open_env(ui, name: str):
    ui.open_detail("pods", name)
    surface = ui.detail_surface("pods")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    ui.page.locator('[data-ai-id="workload-detail:tab-trigger:env"]').click()
    panel = ui.page.locator('[data-ai-id="workload-detail:tab:env"]')
    expect(panel).to_be_visible(timeout=20_000)
    return panel


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_TABS_05(
    app_workloads_page, seeded_configmaps, e2e_objects, screenshot
):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05 容器组详情：环境变量页签。"""

    ui = app_workloads_page
    assert ui.api is not None

    configmap = seeded_configmaps["create"]("envsrc", {"greeting": CONFIGMAP_VALUE})
    secret = e2e_objects["secret"](
        e2e_objects["unique"]("envsec"), data={"password": SECRET_VALUE}, namespace="default"
    )

    with_env = _create_pod(
        ui,
        ui.unique("env"),
        {
            "initContainers": [
                {
                    "name": "init-setup",
                    "image": UNPULLABLE,
                    "env": [{"name": "INIT_FLAG", "value": "init-ok"}],
                }
            ],
            "containers": [
                {
                    "name": "main",
                    "image": UNPULLABLE,
                    "env": [
                        {"name": "PLAIN_VALUE", "value": "plain-ok"},
                        {"name": "FROM_CONFIGMAP", "valueFrom": {"configMapKeyRef": {"name": configmap, "key": "greeting"}}},
                        # Not named "*secret*": the mask rule looks at the variable name, so a
                        # name containing it would be masked and could not prove decoding.
                        {"name": "FROM_KEYSTORE", "valueFrom": {"secretKeyRef": {"name": secret, "key": "password"}}},
                        {"name": "DB_PASSWORD", "value": "s3cr3t-literal"},
                        {
                            "name": "MISSING_REF",
                            "valueFrom": {"configMapKeyRef": {"name": "tc-e2e-no-such-configmap", "key": "k"}},
                        },
                    ],
                }
            ],
        },
    )
    without_env = _create_pod(ui, ui.unique("noenv"), {"containers": [{"name": "main", "image": UNPULLABLE}]})
    try:
        panel = _open_env(ui, with_env)
        # The env tab resolves valueFrom against ConfigMaps/Secrets, so the cards appear a
        # moment after the panel: wait for the first card instead of reading an empty list.
        expect(panel.locator('[data-ai-id="pods-detail:env:init-setup"]')).to_be_visible(timeout=60_000)

        # ---- one card per container, init container first, the first one open ----
        card_ids = [
            ai_id
            for ai_id in panel.locator('[data-ai-id^="pods-detail:env:"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
            if ai_id not in ("pods-detail:env-empty", "pods-detail:env-error")
        ]
        assert card_ids == ["pods-detail:env:init-setup", "pods-detail:env:main"], f"卡片顺序不对：{card_ids}"

        init_card = panel.locator('[data-ai-id="pods-detail:env:init-setup"]')
        main_card = panel.locator('[data-ai-id="pods-detail:env:main"]')
        expect(init_card).to_be_visible(timeout=20_000)
        expect(main_card).to_be_visible(timeout=20_000)
        assert init_card.get_attribute("open") is not None, "首个卡片（init 容器）应默认展开"
        assert main_card.get_attribute("open") is None, "非首个卡片应默认收起"

        # ---- the literal value of the init container is readable without expanding ----
        init_row = init_card.locator('[data-ai-row="INIT_FLAG"]')
        expect(init_row).to_be_visible(timeout=20_000)
        assert "init-ok" in init_row.inner_text(), init_row.inner_text()

        # ---- expand the second card and check every kind of value ----
        main_card.locator("summary").first.click()
        expect(main_card.locator('[data-ai-row="PLAIN_VALUE"]')).to_be_visible(timeout=20_000)

        plain = main_card.locator('[data-ai-row="PLAIN_VALUE"]').inner_text()
        assert "plain-ok" in plain, plain

        from_cm = main_card.locator('[data-ai-row="FROM_CONFIGMAP"]').inner_text()
        assert CONFIGMAP_VALUE in from_cm, f"ConfigMap 引用应显示被引用键的值：{from_cm!r}"

        from_secret = main_card.locator('[data-ai-row="FROM_KEYSTORE"]').inner_text()
        assert SECRET_VALUE in from_secret, f"Secret 引用应显示解码后的值：{from_secret!r}"

        masked = main_card.locator('[data-ai-row="DB_PASSWORD"]').inner_text()
        assert "******" in masked, f"名称含 password 的值应掩码：{masked!r}"
        assert "s3cr3t-literal" not in masked, f"掩码不能泄漏明文：{masked!r}"

        missing = main_card.locator('[data-ai-row="MISSING_REF"]').inner_text()
        assert "configMapKeyRef" in missing, f"读不到引用时应显示来源：{missing!r}"
        assert "读取失败" in missing, f"读不到引用时应标明读取失败：{missing!r}"

        screenshot(ui.page, "pods-detail-env")

        # ---- a pod without any env shows the empty copy, not a blank panel ----
        empty_panel = _open_env(ui, without_env)
        empty_panel.wait_for(state="visible")
        # The cards mount after the env query settles; the copy lives in the card when the
        # container simply has no variables.
        empty_panel.locator('[data-ai-id^="pods-detail:env:"]').first.wait_for(state="visible", timeout=60_000)
        empty_text = empty_panel.inner_text()
        assert "没有环境变量" in empty_text, f"没有环境变量时应显示说明：{empty_text!r}"
        assert empty_panel.locator("[data-ai-row]").count() == 0, "空态不该有变量行"
    finally:
        ui.delete_pod(with_env, timeout=120)
        ui.delete_pod(without_env, timeout=120)
