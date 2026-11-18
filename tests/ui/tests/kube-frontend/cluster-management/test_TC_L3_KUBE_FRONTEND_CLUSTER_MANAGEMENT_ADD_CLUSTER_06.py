from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

CLUSTERS = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"
AGENT_MANIFEST = "/kapis/cluster.kubesphere.io/v1alpha1/clusters/{cluster}/agent/deployment"


def _proxy_cluster(ui) -> str:
    # Pick a proxy-connected member cluster, or skip when the platform has none.
    #
    # The manifest only exists for `spec.connection.type: proxy` — a direct cluster answers
    # 404 — so a platform without one cannot exercise this case. Skipping is honest here:
    # the contract is about what the generator emits, and there is nothing to generate.
    #
    # Deliberately a comment, not a docstring: the gate reads the first docstring in the
    # file as the test's declared TC ID, so a helper documented with one would be mistaken
    # for the test itself.
    response = ui.api.get(CLUSTERS)
    assert response.status_code == 200, response.text
    for item in response.json().get("items", []):
        spec = item.get("spec") or {}
        if (spec.get("connection") or {}).get("type") == "proxy":
            return item["metadata"]["name"]
    pytest.skip("no proxy-connected cluster on this platform; nothing to generate")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_06(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06 代理接入清单的 cluster-agent 资源规格。"""

    ui = cluster_management_page
    assert ui.api is not None

    # Read the manifest from the endpoint the overview page consumes. Asserting on the
    # response rather than the rendered editor keeps this independent of which cluster is
    # the current proxy member and of CodeMirror's DOM.
    cluster = _proxy_cluster(ui)
    response = ui.api.get(AGENT_MANIFEST.format(cluster=cluster))
    assert response.status_code == 200, response.text
    manifest = response.text

    assert "name: cluster-agent" in manifest, manifest
    assert "namespace: kubesphere-system" in manifest, manifest

    # Binary units only: `2G` is 2,000,000,000 bytes and `2Gi` is 2,147,483,648, so a
    # decimal spelling would silently be ~147MB smaller than the contract promises.
    assert "memory: 2Gi" in manifest, manifest
    assert "memory: 100Mi" in manifest, manifest
    assert "memory: 2G\n" not in manifest, manifest
    assert "memory: 512M" not in manifest, manifest
    assert "memory: 200M" not in manifest, manifest

    assert 'cpu: "1"' in manifest, manifest
    assert "cpu: 100m" in manifest, manifest

    screenshot("agent-manifest-resources")
