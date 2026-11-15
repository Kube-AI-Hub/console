from __future__ import annotations

import pathlib
import tempfile
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_04(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04 创建制品构建：S2iBinary 上传链路与失败如实报错。"""

    ui = image_builder_page
    suffix = ui.unique().replace("tc-e2e-s2i-", "")
    artifact = pathlib.Path(tempfile.gettempdir()) / f"tc-e2e-artifact-{suffix}.jar"
    artifact.write_bytes(b"tc-e2e artifact " + suffix.encode())
    created_builder: str | None = None
    try:
        before_names = {
            ((item.get("metadata") or {}).get("name") or "") for item in ui.list_builders()[1]
        }
        requests: list[str] = []
        ui.page.on("request", lambda request: requests.append(f"{request.method} {request.url}"))

        ui.open_list()
        ui.open_create()
        ui.create_choose("b2i", "jar")
        ui.create_next()
        ui.wait_template_selected()
        ui.upload_artifact(str(artifact))

        # The upload goes through the real chain: create S2iBinary, then PUT its /file.
        # Both are asynchronous, so poll for the requests the same way a reader waits for
        # the progress state; an immediate assertion only sees the first one.
        def upload_requests() -> tuple[list[str], list[str]]:
            return (
                [entry for entry in requests if "/s2ibinaries" in entry and entry.startswith("POST ")],
                [entry for entry in requests if "/file" in entry and entry.startswith("PUT ")],
            )

        creates: list[str] = []
        uploads: list[str] = []
        deadline = time.time() + 30
        while time.time() < deadline:
            creates, uploads = upload_requests()
            if creates and uploads:
                break
            ui.page.wait_for_timeout(200)
        assert creates, f"没有创建 S2iBinary 的请求: {requests}"
        assert uploads, f"没有上传 /file 的请求: {requests}"

        error = ui.page.locator('[data-ai-id="image-builder-create:artifact-error"]')
        uploaded = ui.page.locator('[data-ai-id="image-builder-create:artifact-info"]')
        # Either the cluster can store the artifact, or the upload fails and the dialog has
        # to say why. Both are valid results; a silent success or silent failure is not.
        expect(error.or_(uploaded)).to_be_visible(timeout=60_000)
        upload_failed = error.count() > 0

        if upload_failed:
            message = ui.artifact_error()
            assert message.strip(), "上传失败但页面没有显示原因"
            # A failed upload must not create a builder, and must clean up its half object.
            # Compare name sets rather than counts: the project is shared, and another test
            # deleting its own object between the two reads must not look like a new builder.
            after_names = {
                ((item.get("metadata") or {}).get("name") or "") for item in ui.list_builders()[1]
            }
            assert after_names - before_names == set(), f"上传失败却创建了构建器: {after_names - before_names}"
            binaries = ui.request("GET", "/apis/devops.kubesphere.io/v1alpha1/namespaces/default/s2ibinaries")[1]
            names = [((item.get("metadata") or {}).get("name") or "") for item in (binaries.get("items") or [])]
            assert not [name for name in names if suffix in name], names
            screenshot(ui.page, "image-builder-create-b2i-blocked")
        else:
            # Storage worked on this cluster: finish the create and verify the binary wiring.
            secret_name = f"tc-e2e-s2i-registry-{suffix}"
            assert ui.create_registry_secret(secret_name) == 201
            try:
                ui.fill("image-builder-create:image-name", f"tc-e2e/b2i-{suffix}")
                ui.fill("image-builder-create:tag", f"t{suffix}")
                ui.choose_select("image-builder-create:registry", secret_name)
                ui.submit_create()
                ui.wait_dialog_closed()
                status, items = ui.list_builders()
                assert status == 200
                match = [
                    item
                    for item in items
                    if "tc-e2e/b2i-" in str(((item.get("spec") or {}).get("config") or {}).get("imageName"))
                ]
                assert len(match) == 1, items
                created_builder = (match[0].get("metadata") or {}).get("name")
                config = (match[0].get("spec") or {}).get("config") or {}
                assert config.get("isBinaryURL") is True, config
                assert config.get("sourceUrl"), config
                screenshot(ui.page, "image-builder-create-b2i")
            finally:
                ui.delete_secret(secret_name)
    finally:
        artifact.unlink(missing_ok=True)
        if created_builder:
            ui.delete_builder(created_builder)
