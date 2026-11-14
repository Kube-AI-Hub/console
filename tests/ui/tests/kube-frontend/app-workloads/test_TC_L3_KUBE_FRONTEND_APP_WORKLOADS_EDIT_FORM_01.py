from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

from pages.app_workloads import UNPULLABLE_IMAGE

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_FORM_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01 编辑设置：改镜像、增删环境变量，提交前可见变更。"""

    ui = app_workloads_page
    name = ui.unique("editform")
    suffix = f"{int(time.time() * 1000) % 1_000_000}"
    edited_image = f"tc-e2e.invalid/never-pulled:edit-{suffix}"
    env_name = "TC_E2E_EDIT"
    env_value = f"enabled-{suffix}"

    try:
        ui.create_deployment(name, replicas=1)
        ui.open_detail("deployments", name)

        # ---- change one container image ----
        expect(ui.detail_edit_settings_button).to_be_visible()
        ui.open_edit_settings()
        # The workload has one container, so the handles are unsuffixed.
        expect(ui.image_input()).to_have_value(UNPULLABLE_IMAGE)
        ui.set_container_image(edited_image)

        # The change list is what makes a whole-object PUT safe to click: it names
        # the exact field and shows both values before saving.
        diff = ui.change_diff_text()
        assert "spec.template.spec.containers.main.image" in diff, diff
        assert edited_image in diff, diff

        ui.click("deployments-edit:submit")
        ui.wait_dialog_closed()
        ui.wait_deployment_image(name, edited_image)

        # Untouched fields survive the PUT: replicas and the container name are
        # exactly what a form rebuild (instead of a clone) would have lost.
        status, body = ui.get_deployment(name)
        assert status == 200, (status, body)
        spec = body.get("spec") or {}
        assert spec.get("replicas") == 1, spec
        containers = ((spec.get("template") or {}).get("spec") or {}).get("containers") or []
        assert containers and containers[0].get("name") == "main", containers

        # ---- add one environment variable ----
        ui.open_edit_settings()
        # The refetched detail seeds the dialog; a stale seed would show the old image.
        expect(ui.image_input()).to_have_value(edited_image)
        ui.add_env(env_name, env_value)
        assert f".env.{env_name}" in ui.change_diff_text(), ui.change_diff_text()

        ui.click("deployments-edit:submit")
        ui.wait_dialog_closed()
        ui.wait_deployment_env(name, env_name, env_value)

        # Saving the env list must not roll the image back to the value the first
        # dialog saw.
        status, body = ui.get_deployment(name)
        assert status == 200, (status, body)
        containers = ((((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers") or [])
        assert containers[0].get("image") == edited_image, containers

        # ---- restore the original state ----
        ui.open_edit_settings()
        ui.set_container_image(UNPULLABLE_IMAGE)
        ui.remove_env(env_name)
        ui.click("deployments-edit:submit")
        ui.wait_dialog_closed()
        ui.wait_deployment_image(name, UNPULLABLE_IMAGE)
        ui.wait_deployment_env(name, env_name, None)
        screenshot(ui.page, "edit-form")
    finally:
        ui.delete_deployment(name)
