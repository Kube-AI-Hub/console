from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"

MOBILE = {"width": 375, "height": 667}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_MOBILE_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-MOBILE-01 375px 视口。"""

    name = e2e_objects["service_account"](e2e_objects["unique"](), role="viewer")
    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", name)
    e2e_objects["token_data"](token_secret)
    assert e2e_objects["patch"]("serviceaccounts", name, {"secrets": [{"name": token_secret}]}) in (200, 201)
    serviceaccounts_page.page.set_viewport_size(MOBILE)
    serviceaccounts_page.open()

    metrics = serviceaccounts_page.page.evaluate(
        "() => ({ scroll: document.scrollingElement.scrollWidth, inner: window.innerWidth })"
    )
    assert metrics["scroll"] <= metrics["inner"], metrics
    assert serviceaccounts_page.headers == ["名称"], serviceaccounts_page.headers
    screenshot(serviceaccounts_page.page, "list-mobile")

    serviceaccounts_page.open_detail(name)
    detail = serviceaccounts_page.page.evaluate(
        "() => ({ scroll: document.scrollingElement.scrollWidth, inner: window.innerWidth })"
    )
    assert detail["scroll"] <= detail["inner"], detail
    assert serviceaccounts_page.kubeconfig(token_secret).strip()
    screenshot(serviceaccounts_page.page, "detail-mobile")
