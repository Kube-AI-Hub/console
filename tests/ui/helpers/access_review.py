"""Mock the console's permission checks.

The console first asks ks-apiserver's IAM route (answered as the request user) and only
falls back to kube-apiserver's SelfSubjectAccessReview on an older backend. A test that
wants to simulate a deny must therefore intercept both transports; this helper keeps the
body/response shapes straight so each test only supplies the decision.
"""
from __future__ import annotations

import json


def install_access_review_mock(page, decide):
    """Intercept permission reviews; `decide` receives resourceAttributes and returns bool."""

    def handler(route):
        body = json.loads(route.request.post_data or "{}")
        attributes = (body.get("spec") or {}).get("resourceAttributes") or body
        allowed = bool(decide(attributes))
        if "/kapis/iam.kubesphere.io/" in route.request.url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"allowed": allowed}))
        else:
            route.fulfill(
                status=201,
                content_type="application/json",
                body=json.dumps({"status": {"allowed": allowed}}),
            )

    page.route("**/selfsubjectaccessreviews", handler)
    return handler
