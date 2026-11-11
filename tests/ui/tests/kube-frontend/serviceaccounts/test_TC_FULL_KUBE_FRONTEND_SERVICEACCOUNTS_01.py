from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_SERVICEACCOUNTS_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-FULL-KUBE-FRONTEND-SERVICEACCOUNTS-01 服务账户：详情属性与 kubeconfig。"""

    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", SERVICE_ACCOUNT)
    name = e2e_objects["service_account"](
        e2e_objects["unique"](), role="viewer", description="E2E 账户", secrets=[token_secret]
    )
    # The api-server fills token/ca.crt after creation; wait before the page reads.
    data = e2e_objects["token_data"](token_secret)

    serviceaccounts_page.open_detail(name)
    assert serviceaccounts_page.detail_surface.get_attribute("data-ai-state") == "ready"
    assert serviceaccounts_page.attribute("cluster") == "host"
    assert serviceaccounts_page.attribute("project") == "default"
    assert serviceaccounts_page.attribute("role") == "viewer"

    # The preview masks the token until the eye is pressed; the document itself is
    # checked through the unmasked form below.
    serviceaccounts_page.reveal()
    kubeconfig = serviceaccounts_page.kubeconfig(token_secret)
    assert "server: https://kubernetes.default.svc:443" in kubeconfig
    assert f"current-context: {name}@local" in kubeconfig
    assert "namespace: default" in kubeconfig
    import base64
    import time

    # The kubeconfig is a function of the Secret's `data`, so the honest assertion
    # is that the page's document carries the token that is stored — read after the
    # page has rendered. A mismatch means the preview disagrees with the Secret,
    # which is exactly the failure worth reporting.
    # The detail page fetches the token Secret in its own request; wait until a read
    # already returns a populated token before judging the rendered document,
    # otherwise the assertion races the page's own fetch.
    deadline = time.time() + 20
    while time.time() < deadline:
        stored = (e2e_objects["get"]("secrets", token_secret).get("data") or {}).get("token", "")
        if stored:
            break
        time.sleep(0.5)
    serviceaccounts_page.open_detail(name)
    serviceaccounts_page.reveal()
    kubeconfig = serviceaccounts_page.kubeconfig(token_secret)
    stored = (e2e_objects["get"]("secrets", token_secret).get("data") or {}).get("token", "")
    deadline = time.time() + 10
    while stored and base64.b64decode(stored).decode() not in kubeconfig and time.time() < deadline:
        time.sleep(1)
        stored = (e2e_objects["get"]("secrets", token_secret).get("data") or {}).get("token", "")
        serviceaccounts_page.page.reload()
        serviceaccounts_page.wait_ready(serviceaccounts_page.detail_surface)
        serviceaccounts_page.reveal()
        kubeconfig = serviceaccounts_page.kubeconfig(token_secret)
    decoded = base64.b64decode(stored).decode()
    assert decoded in kubeconfig, f"kubeconfig does not carry the stored token (stored {decoded[:12]}…)"
    screenshot(serviceaccounts_page.page, "detail-kubeconfig")
