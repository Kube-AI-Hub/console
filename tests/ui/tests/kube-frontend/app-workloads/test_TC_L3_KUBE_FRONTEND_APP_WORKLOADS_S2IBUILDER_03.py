from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

REGISTRY = "registry.example.com"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_03(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03 创建源码构建：两步表单、字段落库、触发 S2iRun。"""

    ui = image_builder_page
    suffix = ui.unique().replace("tc-e2e-s2i-", "")
    secret_name = f"tc-e2e-s2i-registry-{suffix}"
    image_name = f"tc-e2e/img-{suffix}"
    tag = f"t{suffix}"
    created_builder: str | None = None
    try:
        assert ui.create_registry_secret(secret_name, REGISTRY) == 201

        ui.open_list()
        ui.open_create()
        ui.create_choose("s2i", "java")
        ui.create_next()
        ui.wait_template_selected()

        ui.fill("image-builder-create:source-url", "https://github.com/kubesphere/hello-world.git")
        ui.fill("image-builder-create:branch", "master")
        ui.fill("image-builder-create:image-name", image_name)
        ui.fill("image-builder-create:tag", tag)
        ui.choose_select("image-builder-create:registry", secret_name)
        env_key = ui.add_environment("tc-e2e-env-value")
        assert env_key, "环境变量名没有默认选中"
        ui.submit_create()
        ui.wait_dialog_closed()

        # Read the created object back: the UI generated the name, so find it by its image.
        status, items = ui.list_builders()
        assert status == 200
        match = [
            item
            for item in items
            if ((item.get("spec") or {}).get("config") or {}).get("imageName") == f"{REGISTRY}/{image_name}"
        ]
        assert len(match) == 1, [(item.get("metadata") or {}).get("name") for item in items]
        created_builder = (match[0].get("metadata") or {}).get("name")
        assert created_builder

        status, body = ui.get_builder(created_builder)
        assert status == 200, (status, body)
        metadata = body.get("metadata") or {}
        labels = metadata.get("labels") or {}
        annotations = metadata.get("annotations") or {}
        config = (body.get("spec") or {}).get("config") or {}
        assert labels.get("s2i-type.kubesphere.io") == "s2i", labels
        assert annotations.get("languageType") == "java", annotations
        assert annotations.get("kubesphere.io/repoUrl") == REGISTRY, annotations
        assert config.get("builderPullPolicy") == "if-not-present", config
        assert config.get("sourceUrl") == "https://github.com/kubesphere/hello-world.git", config
        assert config.get("revisionId") == "master", config
        assert config.get("imageName") == f"{REGISTRY}/{image_name}", config
        assert config.get("tag") == tag, config
        assert {"name": env_key, "value": "tc-e2e-env-value"} in (config.get("environment") or []), config

        # The create flow must start a build run for the new builder.
        runs = ui.list_runs(created_builder)
        assert len(runs) == 1, runs
        assert (runs[0].get("spec") or {}).get("builderName") == created_builder

        # And the new builder is visible on the list.
        ui.open_list()
        ui.ensure_row(created_builder)
        screenshot(ui.page, "image-builder-create-s2i")
    finally:
        if created_builder:
            ui.delete_builder(created_builder)
        ui.delete_secret(secret_name)
