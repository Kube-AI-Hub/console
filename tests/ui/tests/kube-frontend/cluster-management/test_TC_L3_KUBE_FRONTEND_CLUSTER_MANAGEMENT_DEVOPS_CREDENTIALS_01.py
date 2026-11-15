from __future__ import annotations

import base64

import pytest
from playwright.sync_api import expect

from pages.devops_page import CREDENTIAL_SECRET_TYPES, DevopsPage

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_CREDENTIALS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CREDENTIALS-01 凭证四类型创建、编辑与删除。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：凭证页签需要真实工程命名空间")
    project, namespace = container

    suffix = devops.unique("pwspec-cred")[-8:]
    credentials = {
        "username_password": f"pwspec-cred-up-{suffix}",
        "ssh": f"pwspec-cred-ssh-{suffix}",
        "secret_text": f"pwspec-cred-text-{suffix}",
        "kubeconfig": f"pwspec-cred-kube-{suffix}",
    }
    remaining = set(credentials.values())

    def row(name: str):
        return ui.page.locator(f'[data-ai-id="devops-detail:credentials-table"] tbody tr[data-ai-row="{name}"]')

    def create(kind_label: str, name: str, fields: dict[str, str], expected_type: str) -> None:
        devops.click("devops-detail:credentials-create")
        devops.expect_dialog()
        devops.select("devops:credential-form-kind", kind_label)
        devops.fill("devops:credential-form-name", name)
        for ai_id, value in fields.items():
            devops.fill(ai_id, value)
        devops.click("devops:credential-form-submit")
        devops.expect_dialog_closed()
        expect(row(name)).to_be_visible(timeout=60_000)
        expect(row(name)).to_contain_text(expected_type)

    try:
        devops.open_project(project)
        devops.open_tab("credentials")
        devops.expect_exactly_one_state("credentials")
        table = devops.surface("devops-detail:credentials-table")
        if table.count() > 0:
            headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
            assert headers == ["名称", "类型", "用户名", "同步状态", "描述", "更多操作"], headers

        create(
            "用户名和密码",
            credentials["username_password"],
            {"devops:credential-form-username": "spec-user", "devops:credential-form-password": "old-password"},
            "用户名和密码",
        )
        assert "spec-user" in row(credentials["username_password"]).inner_text()

        create(
            "SSH 密钥",
            credentials["ssh"],
            {
                "devops:credential-form-username": "spec-ssh-user",
                "devops:credential-form-private-key": "-----BEGIN KEY-----",
                "devops:credential-form-passphrase": "phrase",
            },
            "SSH 密钥",
        )
        create("密钥文本", credentials["secret_text"], {"devops:credential-form-secret": "secret-value"}, "密钥文本")
        create(
            "kubeconfig",
            credentials["kubeconfig"],
            {"devops:credential-form-kubeconfig": "apiVersion: v1"},
            "kubeconfig",
        )

        # The list reads Secrets filtered by the four devops credential types.
        secrets = devops.devops_credential_secrets(namespace)
        for kind, name in credentials.items():
            assert name in secrets, f"{name} 不在 Secret 集合里"
            assert secrets[name].get("type") == CREDENTIAL_SECRET_TYPES[kind], secrets[name].get("type")
        # Sync status comes from the annotation the kapis write stamps.
        assert "pending" in row(credentials["username_password"]).inner_text()

        # ---- edit: name and kind are read-only, secret data is not echoed ----
        devops.click(f"devops-detail:credential-edit:{credentials['username_password']}")
        devops.expect_dialog()
        assert devops.locator("devops:credential-form-name").is_disabled(), "编辑时名称必须只读"
        assert devops.locator("devops:credential-form-kind").is_disabled(), "编辑时类型必须只读"
        assert devops.locator("devops:credential-form-password").input_value() == ""
        devops.fill("devops:credential-form-password", "new-password")
        devops.fill("devops:credential-form-description", "edited by the spec case")
        devops.click("devops:credential-form-submit")
        devops.expect_dialog_closed()
        expect(row(credentials["username_password"])).to_contain_text("edited by the spec case", timeout=60_000)

        secret = devops.devops_credential_secrets(namespace)[credentials["username_password"]]
        annotations = (secret.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/description") == "edited by the spec case"
        assert base64.b64decode((secret.get("data") or {})["password"]).decode() == "new-password"

        # ---- delete: typed-name confirmation, row and Secret gone ----
        text_secret = credentials["secret_text"]
        devops.delete_via_dialog(f"devops-detail:credential-delete:{text_secret}", "devops-detail", text_secret)
        expect(row(text_secret)).to_have_count(0, timeout=60_000)
        status, _ = ui.api.request("GET", f"/api/v1/namespaces/{namespace}/secrets/{text_secret}")
        assert status == 404, status
        remaining.discard(text_secret)

        screenshot(ui.page, "devops-credentials")
    finally:
        for name in remaining:
            devops.delete_credential_quiet(project, name)
