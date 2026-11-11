from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_AI_SURFACE_01(serviceaccounts_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-AI_SURFACE-01 状态与句柄契约。"""

    name = e2e_objects["service_account"](e2e_objects["unique"]())
    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", name)
    e2e_objects["token_data"](token_secret)
    assert e2e_objects["patch"]("serviceaccounts", name, {"secrets": [{"name": token_secret}]}) in (200, 201)
    serviceaccounts_page.open()

    assert serviceaccounts_page.state == "ready"
    assert name in serviceaccounts_page.row_names()
    bulk = serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:bulk-delete"]')
    assert bulk.get_attribute("data-ai-needs") == "serviceaccounts:row-select"

    serviceaccounts_page.open_detail(name)
    assert serviceaccounts_page.detail_surface.get_attribute("data-ai-state") == "ready"
    kubeconfig = serviceaccounts_page.page.locator(f'[data-ai-id="serviceaccount-detail:kubeconfig:{token_secret}"]')
    assert kubeconfig.inner_text().strip()
    assert serviceaccounts_page.toggle_values.get_attribute("aria-pressed") == "false"
