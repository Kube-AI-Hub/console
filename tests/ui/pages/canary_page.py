"""页面对象：项目控制台的灰度发布列表与详情（servicemesh Strategy）。

列表、详情、调整流量弹窗与删除确认框的选择器只出现在这里；规格与用例只写
`data-ai-id` 的语义。对象的前置数据通过原生 `/apis` 端点创建，因为
servicemesh 的 kapis 代理返回的是资源代理信封，且写操作走原生端点更直接。

写用例的三条约定和本仓库其他页面一致：

1. 对象名带本次运行唯一的前缀，finally 里无条件删除；
2. 详情断言基于自己创建的对象，不取「第一行」；
3. 断言服务端回读，而不是只看页面文案。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

STRATEGY_API = "/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/{namespace}/strategies"
DEPLOYMENT_API = "/apis/apps/v1/namespaces/{namespace}/deployments"

#: An image that never pulls, so a test Deployment stays at 0 ready replicas without
#: downloading anything (and cleans up fast).
UNPULLABLE_IMAGE = "tc-e2e.invalid/never-pulled:1.0"


class ApiLike(Protocol):
    """`conftest.ApiClient` 的最小接口。"""

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


def strategy_manifest(
    name: str,
    target: str,
    namespace: str = "default",
    *,
    type_: str | None = None,
    principal: str = "v1",
    canary: str = "v2",
    weights: tuple[int, int] | None = (80, 20),
    match: list[dict] | None = None,
    mirror: bool = False,
    governor: str = "",
) -> dict:
    """A Strategy the servicemesh API accepts (POST returns 201 in this environment).

    Shapes:
    - weighted canary (default): one http rule with two weighted destinations;
    - content canary (`match`): first rule matches and routes to the canary version,
      second rule sends the rest to the principal version;
    - mirror (`mirror=True`): one rule to the principal plus a `mirror` destination.

    Weightless canary (`weights=None`) omits `weight` entirely, which Istio interprets
    as an even split — used to test that the page does not print 0% for it.
    """
    # A mirror release is its own CRD type; the caller only says "mirror" and the
    # manifest must carry type=Mirror or the page (correctly) reads it as a canary.
    if type_ is None:
        type_ = "Mirror" if mirror else "Canary"
    template_http: list[dict[str, Any]] = []
    if mirror:
        template_http = [
            {
                "route": [{"destination": {"host": target, "subset": principal}, "weight": 100}],
                "mirror": {"host": target, "subset": canary},
            }
        ]
        governor = governor or principal
    elif match is not None:
        template_http = [
            {"match": match, "route": [{"destination": {"host": target, "subset": canary}, "weight": 100}]},
            {"route": [{"destination": {"host": target, "subset": principal}, "weight": 100}]},
        ]
    elif weights is None:
        template_http = [
            {
                "route": [
                    {"destination": {"host": target, "subset": principal}},
                    {"destination": {"host": target, "subset": canary}},
                ]
            }
        ]
    else:
        template_http = [
            {
                "route": [
                    {"destination": {"host": target, "subset": principal}, "weight": weights[0]},
                    {"destination": {"host": target, "subset": canary}, "weight": weights[1]},
                ]
            }
        ]
    return {
        "apiVersion": "servicemesh.kubesphere.io/v1alpha2",
        "kind": "Strategy",
        "metadata": {"name": name, "namespace": namespace, "labels": {"app": target}},
        "spec": {
            "type": type_,
            "principal": principal,
            "governor": governor,
            "strategyPolicy": "WaitForWorkloadReady",
            "selector": {"matchLabels": {"app": target}},
            "template": {"metadata": {"labels": {"app": target}}, "spec": {"hosts": [target], "http": template_http}},
        },
    }


def deployment_manifest(name: str, namespace: str, labels: dict[str, str], replicas: int = 1) -> dict:
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": name, "namespace": namespace, "labels": dict(labels)},
        "spec": {
            "replicas": replicas,
            "selector": {"matchLabels": dict(labels)},
            "template": {
                "metadata": {"labels": dict(labels)},
                "spec": {"containers": [{"name": "c", "image": UNPULLABLE_IMAGE, "command": ["true"]}]},
            },
        },
    }


class CanaryPage:
    """灰度发布的列表、详情与写操作，以及测试对象的创建/清理。"""

    def __init__(self, page: Page, base: str, namespace: str = "default", api: ApiLike | None = None) -> None:
        self.page = page
        # `base` ends at .../projects/<namespace>, the same scope the app tabs use.
        self.base = base.rstrip("/")
        self.namespace = namespace
        self.api = api

    # ---------------- URLs ----------------

    @property
    def list_url(self) -> str:
        return self.base + "/grayrelease"

    def detail_url(self, name: str) -> str:
        return self.list_url + "/" + name

    # ---------------- List ----------------

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:surface"]').last

    def open_list(self) -> None:
        self.page.goto(self.list_url)
        expect(self.surface).to_be_visible(timeout=20_000)
        self.wait_ready(self.surface)

    def wait_ready(self, surface: Locator | None = None, timeout_ms: int = 60_000) -> None:
        expect(surface or self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    def headers(self) -> list[str]:
        return [text.strip() for text in self.surface.locator("thead th:visible").all_inner_texts() if text.strip()]

    def row(self, name: str) -> Locator:
        return self.surface.locator('[data-ai-row="' + name + '"]')

    def rows(self) -> list[str]:
        return [value for value in self.surface.locator("[data-ai-row]").evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if value]

    def open_link(self, name: str) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:open:' + name + '"]')

    def open_detail(self, name: str) -> None:
        """Click the row's name link — the same path a reader takes."""
        self.open_link(name).click()
        self.page.wait_for_url("**/grayrelease/" + name)
        expect(self.detail_surface).to_be_visible(timeout=20_000)
        self.wait_ready(self.detail_surface)

    @property
    def create_button(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:create"]')

    @property
    def search_box(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:search"]')

    @property
    def created_notice(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:created"]')

    # ---------------- Detail ----------------

    @property
    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:surface"]')

    def open_detail_url(self, name: str) -> None:
        self.page.goto(self.detail_url(name))
        expect(self.detail_surface).to_be_visible(timeout=20_000)
        self.wait_ready(self.detail_surface)

    @property
    def back_link(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:back"]')

    @property
    def notice(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:notice"]')

    def definition(self, label: str) -> str:
        """The value next to one label of the attributes block."""
        term = self.page.locator('[data-ai-id="grayrelease-detail:attributes"] dt', has_text=label).first
        return term.locator("xpath=following-sibling::dd[1]").inner_text().strip()

    @property
    def attributes(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:attributes"]')

    @property
    def versions_section(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:versions"]')

    def version_card(self, version: str) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:version:' + version + '"]')

    def workload_link(self, name: str) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:workload:' + name + '"]')

    @property
    def match_rules_section(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:match-rules"]')

    @property
    def match_rules_empty(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:match-rules-empty"]')

    def match_rule_rows(self) -> Locator:
        return self.match_rules_section.locator("tbody tr")

    @property
    def conditions_section(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:conditions"]')

    @property
    def conditions_empty(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:conditions-empty"]')

    def condition_rows(self) -> Locator:
        return self.conditions_section.locator("tbody tr")

    def section_tops(self) -> list[int]:
        """Vertical position of each detail section, for the fixed order assertion."""
        boxes = []
        for ai_id in (
            "grayrelease-detail:attributes",
            "grayrelease-detail:versions",
            "grayrelease-detail:match-rules",
            "grayrelease-detail:conditions",
        ):
            boxes.append(round(self.page.locator('[data-ai-id="' + ai_id + '"]').bounding_box()["y"]))
        return boxes

    @property
    def edit_traffic_button(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:edit-traffic"]')

    @property
    def pause_button(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:pause"]')

    @property
    def resume_button(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:resume"]')

    @property
    def delete_button(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-detail:delete"]')

    # ---------------- Traffic dialog ----------------

    def open_traffic(self) -> Locator:
        self.edit_traffic_button.click()
        dialog = self.page.locator('[data-ai-id="grayrelease-traffic:dialog"]')
        expect(dialog).to_be_visible(timeout=15_000)
        return dialog

    @property
    def traffic_dialog(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:dialog"]')

    @property
    def traffic_weight(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:weight"]')

    @property
    def traffic_summary(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:summary"]')

    @property
    def traffic_error(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:error"]')

    @property
    def traffic_submit(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:submit"]')

    @property
    def traffic_cancel(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:cancel"]')

    def traffic_mode(self, mode: str) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:' + mode + '"]')

    def traffic_version(self, version: str) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease-traffic:version:' + version + '"]')

    def set_weight(self, value: int | str) -> None:
        self.traffic_weight.fill(str(value))

    # ---------------- Delete dialog ----------------

    @property
    def delete_input(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:delete-input"]')

    @property
    def delete_confirm(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:delete-confirm"]')

    def open_delete(self) -> None:
        self.delete_button.click()
        expect(self.delete_input).to_be_visible(timeout=15_000)

    # ---------------- Create wizard ----------------

    def open_create(self) -> None:
        self.create_button.click()
        expect(self.page.locator('[data-ai-id="grayrelease:create-dialog"]')).to_be_visible(timeout=15_000)

    def fill_create(self, name: str, *, type_: str = "Canary", traffic: str | None = None) -> None:
        self.page.locator('[data-ai-id="grayrelease:create-name"]').fill(name)
        self.page.locator('[data-ai-id="grayrelease:create-type"]').select_option(type_)
        if traffic is not None:
            self.page.locator('[data-ai-id="grayrelease:create-traffic"]').fill(traffic)

    @property
    def create_next(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:create-next"]')

    @property
    def create_confirm(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:create-confirm"]')

    @property
    def create_workload(self) -> Locator:
        return self.page.locator('[data-ai-id="grayrelease:create-workload"]')

    # ---------------- API helpers ----------------

    def _api(self) -> ApiLike:
        if self.api is None:
            raise RuntimeError("CanaryPage was created without an ApiClient")
        return self.api

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]:
        return self._api().request(method, path, body)

    def strategies_path(self) -> str:
        return STRATEGY_API.format(namespace=self.namespace)

    def get_strategy(self, name: str) -> dict[str, Any] | None:
        status, body = self._request("GET", self.strategies_path() + "/" + name)
        return body if status == 200 and isinstance(body, dict) else None

    def list_strategies(self) -> list[dict[str, Any]]:
        status, body = self._request("GET", self.strategies_path())
        assert status == 200 and isinstance(body, dict), (status, body)
        return body.get("items") or []

    def create_strategy(self, manifest: dict) -> dict[str, Any]:
        status, body = self._request("POST", self.strategies_path(), manifest)
        assert status in (200, 201), (status, body)
        return body

    def put_strategy(self, name: str, body: dict) -> dict[str, Any]:
        status, returned = self._request("PUT", self.strategies_path() + "/" + name, body)
        assert status in (200, 201), (status, returned)
        return returned

    def set_conditions(self, name: str, conditions: list[dict], completion_time: str | None = None) -> dict[str, Any]:
        """Write `status.conditions` through a normal PUT.

        The CRD has no status subresource, so a whole-object PUT persists `status`. This
        is how the tests produce the Complete/Failed branches without a controller.
        """
        current = self.get_strategy(name)
        assert current is not None
        status: dict[str, Any] = {"conditions": conditions}
        if completion_time:
            status["completionTime"] = completion_time
        current["status"] = status
        return self.put_strategy(name, current)

    def delete_strategy(self, name: str) -> None:
        status, _ = self._request("DELETE", self.strategies_path() + "/" + name)
        assert status in (200, 202, 404), status

    def wait_strategy(self, name: str, present: bool = True, timeout: float = 60) -> dict[str, Any] | None:
        deadline = time.time() + timeout
        seen: dict[str, Any] | None = None
        while time.time() < deadline:
            seen = self.get_strategy(name)
            if (seen is not None) == present:
                return seen
            time.sleep(0.5)
        return seen

    def route_weights(self, name: str) -> list[int | None]:
        item = self.get_strategy(name)
        assert item is not None, name
        rules = ((item.get("spec") or {}).get("template") or {}).get("spec", {}).get("http") or []
        return [route.get("weight") for route in (rules[0].get("route") or [])]

    def governor_of(self, name: str) -> str:
        item = self.get_strategy(name)
        assert item is not None, name
        return str((item.get("spec") or {}).get("governor") or "")

    def wait_governor(self, name: str, expected: str, timeout: float = 60) -> bool:
        """Poll the object until `spec.governor` reads `expected`."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.governor_of(name) == expected:
                return True
            time.sleep(0.4)
        return False

    def wait_weights(self, name: str, expected: list[int | None], timeout: float = 60) -> bool:
        """Poll the first http rule's route weights until they read `expected`."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.route_weights(name) == expected:
                return True
            time.sleep(0.4)
        return False

    def deployments_path(self) -> str:
        return DEPLOYMENT_API.format(namespace=self.namespace)

    def create_deployment(self, name: str, labels: dict[str, str], replicas: int = 1) -> None:
        status, body = self._request("POST", self.deployments_path(), deployment_manifest(name, self.namespace, labels, replicas))
        assert status in (200, 201), (status, body)

    def delete_deployment(self, name: str) -> None:
        status, _ = self._request("DELETE", self.deployments_path() + "/" + name)
        assert status in (200, 202, 404), status

    def cleanup(self, *names: str) -> None:
        """Best-effort removal of everything a test created, then verify it is gone."""
        for name in names:
            if not name:
                continue
            self.delete_strategy(name)
            assert self.wait_strategy(name, present=False) is None, "残留 Strategy: " + name
