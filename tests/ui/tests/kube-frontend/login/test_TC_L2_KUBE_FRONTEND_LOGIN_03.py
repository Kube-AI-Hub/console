from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_L2_KUBE_FRONTEND_LOGIN_03(anonymous_page, ui_config, login_page, screenshot):
    """TC-L2-KUBE-FRONTEND-LOGIN-03 退出后 token 在浏览器与集群两侧都失效。"""

    page = anonymous_page
    deep_link = "/kube-frontend/system-workspace/clusters/host/projects/default/configmaps"

    # Enter through a deep link so signing in has somewhere to return to: a bare
    # `/login` correctly lands on the home page, which has no account menu.
    page.goto(f"{ui_config.base_url}{deep_link}")
    page.wait_for_url("**/login**")
    login_page.sign_in(ui_config.login_user, ui_config.login_pass)
    page.wait_for_url(f"**{deep_link}")
    # The shell paints before `/api/session/me` settles; signing out needs the
    # account menu, which only renders once that call has answered.
    page.locator('[data-ai-id="shell:user-menu"]').wait_for(state="visible")

    token = page.evaluate("() => localStorage.getItem('kubesphere-token')")
    assert token, "signing in must store a token"

    login_page.sign_out()
    page.locator('[data-ai-id="login:surface"]').wait_for(state="visible")
    assert page.evaluate("() => localStorage.getItem('kubesphere-token')") is None

    # The cluster must have revoked it, not merely been forgotten by the browser.
    # Asked from Python rather than from the page: the page has just navigated to
    # /login and an in-page fetch races that navigation (net::ERR_ABORTED).
    revoked = page.request.get(
        f"{ui_config.base_url}/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoked.status == 401, revoked.status

    # A revoked token written back must not paint the console.
    page.evaluate("(token) => localStorage.setItem('kubesphere-token', token)", token)
    page.goto(f"{ui_config.base_url}{deep_link}")
    page.wait_for_url("**/login**")
    assert page.locator("aside").count() == 0
    screenshot(page, "login-after-logout")
