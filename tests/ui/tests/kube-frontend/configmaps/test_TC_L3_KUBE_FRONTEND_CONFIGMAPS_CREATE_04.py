from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient
from helpers.auth import api_headers

pytestmark = pytest.mark.ui

# Two projects that exist on the cluster under test, resolved at run time.
#
# These used to be literals (`kube-frontend-demo` as the page's project, `default` as the
# target). That only works on the cluster where those names happen to exist: on the
# reference cluster `kube-frontend-demo` is absent, the page opened on nothing, and the
# case failed as if the create dialog were broken. The case is about "the object lands in
# the project chosen in the dialog", which needs two real projects, not two specific ones.
def _two_projects(session_token, app_base) -> tuple[str, str]:
    api = ApiClient(app_base, session_token)
    status, body = api.request("GET", "/api/v1/namespaces?limit=-1")
    names = sorted(
        item["metadata"]["name"] for item in (body.get("items") or []) if item["metadata"].get("name")
    )
    if len(names) < 2:
        pytest.skip(f"集群不足两个项目，无法验证跨项目创建：{names}")
    return names[0], names[1]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_04(configmaps_page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04 创建时选择项目，对象落在所选项目。"""

    page_project, other_project = _two_projects(session_token, ui_config.app)
    configmaps_page.url = (
        f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/{page_project}/configmaps"
    )
    configmaps_page.open()
    configmaps_page.wait_ready()

    name = f"tc-create-ns-{uuid.uuid4().hex[:8]}"
    page = configmaps_page.page
    configmaps_page.create_button.click()

    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()

    combo = dialog.get_by_role("combobox", name="项目")
    # Seeded from the page's project, so the common case needs no interaction.
    expect(combo).to_contain_text(page_project)

    combo.click()
    page.get_by_role("option", name=other_project, exact=True).click()
    expect(dialog.get_by_role("combobox", name="项目")).to_contain_text(other_project)

    dialog.get_by_role("textbox", name="名称").fill(name)
    dialog.get_by_role("button", name="下一步").click()
    # The Create button only exists on the data step; a slower first render means
    # the click that just happened may not have re-rendered yet.
    dialog.get_by_role("button", name="创建").click(timeout=15_000)

    expect(dialog).to_be_hidden()
    screenshot(page, "create-project-created")

    # The object must exist in the project chosen in the dialog, not the page's.
    # `page.request` fires outside the app, so the bearer header has to be passed
    # explicitly: the BFF reads the token from the request, not from the browser.
    token = page.evaluate("() => localStorage.getItem('kubesphere-token')")
    headers = api_headers(token)
    url = f"{ui_config.app}/api/v1/namespaces/{other_project}/configmaps/{name}"
    try:
        created = page.request.get(url, headers=headers)
        assert created.status == 200, created.status
    finally:
        # Unconditional: a failed assertion above must not leave the object behind
        # for the next run to trip over.
        page.request.delete(url, headers=headers)
