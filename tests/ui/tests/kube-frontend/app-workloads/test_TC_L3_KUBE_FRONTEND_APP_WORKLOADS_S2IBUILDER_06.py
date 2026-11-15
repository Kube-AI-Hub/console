from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _wait(predicate, timeout: float = 30, interval: float = 0.3):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f"condition not met within {timeout}s; last={last!r}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_06(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-06 运行/重新构建：预填、PATCH、更新工作负载开关、触发 S2iRun。"""

    ui = image_builder_page
    name = ui.unique("run")
    secret_name = f"{name}-registry"
    try:
        assert ui.create_registry_secret(secret_name) == 201
        assert (
            ui.create_builder(
                name,
                display_name="运行构建器",
                service_name="tc-e2e-svc",
                tag="v1",
                registry_secret=secret_name,
            )
            == 201
        )
        ui.open_detail(name)

        ui.open_run()
        expect(ui.page.locator('[data-ai-id="image-builder-run:source-url"]')).to_have_value(
            "https://github.com/kubesphere/hello-world.git"
        )
        expect(ui.page.locator('[data-ai-id="image-builder-run:tag"]')).to_have_value("v1")
        # The object carries a serviceName annotation, so the workload switch is offered and on.
        switch = ui.page.locator('[data-ai-id="image-builder-run:update-workload"]')
        expect(switch).to_be_visible()
        expect(switch).to_have_attribute("aria-checked", "true")

        ui.fill("image-builder-run:tag", "v2")
        ui.run_submit()
        ui.wait_dialog_closed()

        def tag_updated():
            status, body = ui.get_builder(name)
            if status != 200:
                return None
            config = (body.get("spec") or {}).get("config") or {}
            annotations = (body.get("metadata") or {}).get("annotations") or {}
            if config.get("tag") != "v2":
                return None
            if "devops.kubesphere.io/donotautoscale" in annotations:
                return None
            return body

        _wait(tag_updated)
        _wait(lambda: len(ui.list_runs(name)) == 1 and ui.list_runs(name))

        # Turning the switch off writes the donotautoscale annotation.
        ui.open_run()
        ui.click("image-builder-run:update-workload")
        expect(ui.page.locator('[data-ai-id="image-builder-run:update-workload"]')).to_have_attribute("aria-checked", "false")
        ui.run_submit()
        ui.wait_dialog_closed()

        def annotation_written():
            status, body = ui.get_builder(name)
            if status != 200:
                return None
            annotations = (body.get("metadata") or {}).get("annotations") or {}
            return annotations.get("devops.kubesphere.io/donotautoscale") == "true" or None

        _wait(annotation_written)
        _wait(lambda: len(ui.list_runs(name)) == 2 and ui.list_runs(name))
        screenshot(ui.page, "image-builder-run")
    finally:
        ui.delete_builder(name)
        ui.delete_secret(secret_name)
