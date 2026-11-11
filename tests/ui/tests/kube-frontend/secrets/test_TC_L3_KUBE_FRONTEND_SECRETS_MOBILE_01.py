from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MOBILE = {"width": 375, "height": 667}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_MOBILE_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-MOBILE-01 保密字典：375px 视口。"""

    e2e_objects["secret"](e2e_objects["unique"]())
    secrets_page.page.set_viewport_size(MOBILE)
    secrets_page.open()

    metrics = secrets_page.page.evaluate(
        "() => ({ scroll: document.scrollingElement.scrollWidth, inner: window.innerWidth })"
    )
    assert metrics["scroll"] <= metrics["inner"], metrics

    # Only the name column survives on a phone.
    assert secrets_page.headers == ["名称"], secrets_page.headers
    expect(secrets_page.page.locator('[data-ai-id="shell:nav-toggle"]')).to_be_visible()

    # The touch target is the field's control shell, not the inner `<input>` (which
    # is 20px tall inside a 44px minimum). ai-kit owns that shell; a reader taps the
    # shell, so that is what the promise covers.
    control = secrets_page.search_box.locator("xpath=..")
    box = control.bounding_box()
    assert box and box["height"] >= 44, box
    screenshot(secrets_page.page, "list-mobile")
