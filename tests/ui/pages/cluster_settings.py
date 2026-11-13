"""页面对象：kube-frontend 的集群设置。

集群设置展示集群属性，其中可写的四项（别名、标签、供应商、描述）通过**与列表同一个**
「编辑信息」弹窗修改；安装器写入的部分（连接方式、端点、版本、节点数）只读。

用例的职责是把「保存成功」与「实际写进去了」分开验证：页面显示只能证明请求回来了，
只有回读集群对象才能证明注解真的变了——这正是本项目反复出现的「保存成功但没保存」类
缺陷的检查点。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

CLUSTER_READ = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"
CLUSTER_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"
DESCRIPTION_ANNOTATION = "kubesphere.io/description"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ClusterSettingsPage:
    """集群设置页。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.api = api

    @property
    def url(self) -> str:
        return f"{self.base_url}/kube-frontend/clusters/{self.cluster}/settings"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-settings:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible(timeout=30_000)

    def wait_ready(self, timeout_ms: int = 120_000) -> None:
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def edit_description(self, value: str) -> None:
        """改描述：开编辑信息弹窗（与列表共用），只动描述字段，其余保持原样。"""
        self.page.locator('[data-ai-id="cluster-settings:edit"]').click()
        field = self.page.locator('#ai-field-cluster-edit-description')
        expect(field).to_be_visible(timeout=20_000)
        field.fill(value)
        self.page.locator('[data-ai-id="clusters:edit-submit"]').click()

    def wait_saved(self, timeout_ms: int = 30_000) -> None:
        """等弹窗关闭：保存成功后它自己关，关了就说明请求回来了。

        写入是否生效由用例回读集群对象判定 —— 界面上的值只能证明组件重渲染了。
        """
        expect(self.page.locator('[data-ai-id="clusters:edit-submit"]')).to_have_count(0, timeout=timeout_ms)

    def description_text(self) -> str:
        return self.page.locator('[data-ai-id="cluster-settings:description"]').last.inner_text().strip()

    def readonly_text(self) -> str:
        return self.page.locator('[data-ai-id="cluster-settings:readonly"]').last.inner_text()

    # ---------------- 数据 ----------------

    def cluster_object(self) -> dict[str, Any] | None:
        assert self.api is not None, "api client required"
        status, body = self.api.request("GET", f"{CLUSTER_READ}/{self.cluster}")
        if status != 200 or not isinstance(body, dict):
            return None
        return body

    def description_annotation(self) -> str | None:
        cluster = self.cluster_object() or {}
        annotations = (cluster.get("metadata") or {}).get("annotations") or {}
        return annotations.get(DESCRIPTION_ANNOTATION)

    def description_present(self) -> bool:
        cluster = self.cluster_object() or {}
        annotations = (cluster.get("metadata") or {}).get("annotations") or {}
        return DESCRIPTION_ANNOTATION in annotations

    def restore_description(self, value: str | None) -> int:
        """Put the original annotation back, or delete it when there was none."""
        assert self.api is not None, "api client required"
        status, _ = self.api.request(
            "PATCH",
            f"{CLUSTER_WRITE}/{self.cluster}",
            {"metadata": {"annotations": {DESCRIPTION_ANNOTATION: value}}},
            "application/merge-patch+json",
        )
        return status