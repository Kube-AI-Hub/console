from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

# The account each token Secret belongs to (the Secret carries its name).
SERVICE_ACCOUNT = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_LIST_02(serviceaccounts_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-02 令牌链接到保密字典详情。"""

    name = e2e_objects["service_account"](e2e_objects["unique"]())
    token_secret = e2e_objects["account_token"](e2e_objects["unique"]() + "-token", name)
    e2e_objects["token_data"](token_secret)
    # The controller fills `token`/`ca.crt` from the annotation; only the account's
    # `secrets[]` entry is the client's to set.
    assert e2e_objects["patch"]("serviceaccounts", name, {"secrets": [{"name": token_secret}]}) in (200, 201)
    serviceaccounts_page.open()

    link = serviceaccounts_page.page.locator(f'[data-ai-id="serviceaccounts:open-secret:{token_secret}"]')
    expect(link).to_be_visible()
    link.click()
    # Compare the pathname: a pattern against the whole URL has to account for the
    # port and host, and `to_have_url` prints a trailing space that makes the
    # spinner output read like a mismatch when it is not.
    from urllib.parse import urlparse

    expect(serviceaccounts_page.page).to_have_url(re.compile(rf"/projects/default/secrets/{re.escape(token_secret)}$"))
    expect(serviceaccounts_page.page.locator('[data-ai-id="secret-detail:surface"]')).to_be_visible()
    assert name  # the account exists to carry the token
