from __future__ import annotations

import base64
import json

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_DETAIL_02(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02 保密字典详情：设为默认镜像仓库。"""

    old = e2e_objects["secret"](
        e2e_objects["unique"]() + "-registry-old",
        type_="kubernetes.io/dockerconfigjson",
        data={".dockerconfigjson": json.dumps({"auths": {"https://old.example.com": {"username": "a", "password": "b"}}})},
        annotations={"secret.kubesphere.io/is-default-class": "true"},
    )
    new = e2e_objects["secret"](
        e2e_objects["unique"]() + "-registry-new",
        type_="kubernetes.io/dockerconfigjson",
        data={".dockerconfigjson": json.dumps({"auths": {"https://new.example.com": {"username": "c", "password": "d"}}})},
    )

    secrets_page.open_detail(new)
    expect(secrets_page.set_default_button).to_be_visible()
    secrets_page.set_default_button.click()
    secrets_page.page.locator('[data-ai-id="secrets:set-default-confirm"]').click()

    # The old default must be cleared, not merely shadowed.
    expect(secrets_page.page.locator('[data-ai-id="secrets:set-default-confirm"]')).to_have_count(0)
    secrets_page.page.reload()
    secrets_page.wait_ready(secrets_page.detail_surface)

    current = e2e_objects["get"]("secrets", new)
    previous = e2e_objects["get"]("secrets", old)
    assert current["metadata"]["annotations"]["secret.kubesphere.io/is-default-class"] == "true"
    assert previous["metadata"]["annotations"]["secret.kubesphere.io/is-default-class"] == "false"
    expect(secrets_page.set_default_button).to_have_count(0)
    screenshot(secrets_page.page, "detail-default-registry")
