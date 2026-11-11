from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_DETAIL_02(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-02 无令牌与下载。"""

    with_token = e2e_objects["service_account"](e2e_objects["unique"]())
    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", with_token)
    e2e_objects["token_data"](token_secret)
    assert e2e_objects["patch"]("serviceaccounts", with_token, {"secrets": [{"name": token_secret}]}) in (200, 201)
    without_token = e2e_objects["service_account"](e2e_objects["unique"]())

    serviceaccounts_page.open_detail(with_token)
    with serviceaccounts_page.page.expect_download() as download:
        serviceaccounts_page.page.locator(f'[data-ai-id="serviceaccount-detail:download-kubeconfig:{token_secret}"]').click()
    assert download.value.suggested_filename == "kubeconfig.yaml"

    serviceaccounts_page.open_detail(without_token)
    expect(serviceaccounts_page.data_section.get_by_text("没有绑定令牌", exact=False)).to_be_visible()
    assert serviceaccounts_page.detail_surface.get_attribute("data-ai-state") == "ready"
    screenshot(serviceaccounts_page.page, "detail-no-token")
