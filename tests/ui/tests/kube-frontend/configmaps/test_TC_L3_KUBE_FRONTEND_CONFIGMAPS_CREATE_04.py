from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

from helpers.auth import api_headers

pytestmark = pytest.mark.ui

# A project that exists on this cluster and is not the one the page opened on.
OTHER_PROJECT = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_04(configmaps_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04 创建时选择项目，对象落在所选项目。"""

    configmaps_page.url = f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps"
    configmaps_page.open()
    configmaps_page.wait_ready()

    name = f"tc-create-ns-{uuid.uuid4().hex[:8]}"
    page = configmaps_page.page
    configmaps_page.create_button.click()

    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()

    combo = dialog.get_by_role("combobox", name="项目")
    # Seeded from the page's project, so the common case needs no interaction.
    expect(combo).to_contain_text("kube-frontend-demo")

    combo.click()
    page.get_by_role("option", name=OTHER_PROJECT, exact=True).click()
    expect(dialog.get_by_role("combobox", name="项目")).to_contain_text(OTHER_PROJECT)

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
    url = f"{ui_config.app}/api/v1/namespaces/{OTHER_PROJECT}/configmaps/{name}"
    try:
        created = page.request.get(url, headers=headers)
        assert created.status == 200, created.status
    finally:
        # Unconditional: a failed assertion above must not leave the object behind
        # for the next run to trip over.
        page.request.delete(url, headers=headers)
