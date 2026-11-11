from __future__ import annotations

import base64

import pytest

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"



@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_DETAIL_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DETAIL-01 属性顺序与 kubeconfig 内容。"""

    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", SERVICE_ACCOUNT)
    import base64

    name = e2e_objects["service_account"](e2e_objects["unique"](), role="operator", secrets=[token_secret])
    # Wait for the controller-populated token before the page opens.
    e2e_objects["token_data"](token_secret)
    serviceaccounts_page.open_detail(name)

    labels = serviceaccounts_page.page.locator('[data-ai-id="serviceaccount-detail:surface"] dt').all_inner_texts()
    assert labels[:5] == ["集群", "项目", "项目角色", "创建时间", "创建者"], labels

    # Masked first: the token must not be readable before the eye is pressed.
    assert not serviceaccounts_page.values_revealed
    masked = serviceaccounts_page.kubeconfig(token_secret)
    stored = base64.b64decode((e2e_objects["get"]("secrets", token_secret).get("data") or {})["token"]).decode()
    assert stored not in masked

    serviceaccounts_page.reveal()
    kubeconfig = serviceaccounts_page.kubeconfig(token_secret)
    # The page may have cached the Secret just after creation; the kubeconfig is a
    # function of what is stored, so reload until the two agree.
    import time

    deadline = time.time() + 20
    while f"token: {stored}" not in kubeconfig and time.time() < deadline:
        serviceaccounts_page.open_detail(name)
        serviceaccounts_page.reveal()
        kubeconfig = serviceaccounts_page.kubeconfig(token_secret)
        stored = base64.b64decode((e2e_objects["get"]("secrets", token_secret).get("data") or {})["token"]).decode()
        time.sleep(0.5)
    assert f"token: {stored}" in kubeconfig
    assert "namespace: default" in kubeconfig
    screenshot(serviceaccounts_page.page, "detail-revealed")
