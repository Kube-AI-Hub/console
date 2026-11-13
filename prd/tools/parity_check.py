#!/usr/bin/env python3
"""逐页核对：老 console 的功能点 vs 迁移后的实现。

为什么需要它：迁移是分批做的，每批只盯着自己的页面，很容易出现「这一页迁了
列表但漏了详情」「这一页没有子页面却写了详情路由」这类不对称。这个脚本把两边
的清单摆在一起，缺口就是一份可执行的待办，而不是靠记忆。

用法：
    python3 prd/tools/parity_check.py            # 只打印差异
    python3 prd/tools/parity_check.py --json     # 机器可读

它检查的是**结构**层面的完整性：页面存在与否、页面的子详情是否存在、每个页面
有没有被区域登记（侧栏/页签能否到达）、有没有用例规格。具体字段与交互的对照
仍以 design 文档里的逐项表为准。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
APP = REPO / "kube-frontend/apps/console-next/src"
ROUTES = APP / "routes"
SPECS = REPO / "tests/ui/specs/kube-frontend"
OLD = REPO / "src/pages"

#: 老 console 里**项目作用域**的一级页面目录 → 迁移后的路由段。
#: 只列已经决定迁移的页面；老 console 的其余页面在 UNMIGRATED 里显式登记，
#: 这样「没写」和「决定不做」不会混在一起。
PROJECT_PAGES = {
    "configmaps": "configmaps",
    "secrets": "secrets",
    "serviceaccounts": "serviceaccounts",
    "deployments": "deployments",
    "statefulsets": "statefulsets",
    "daemonsets": "daemonsets",
    "jobs": "jobs",
    "cronjobs": "cronjobs",
    "pods": "pods",
    "services": "services",
    "routes": "ingresses",
    "volumes": "persistentvolumeclaims",
    "volumesnapshots": "volumesnapshots",
    "alerting/messages": "alerts",
    "alerting/policies": "alertingrules",
    "roles": "roles",
    "members": "members",
    "baseinfo": "baseinfo",
    "networkpolicies": "networkpolicies",
    "gateway": "gateways",
    "logcollection": "log-collections",
}

#: 老 console 里**集群作用域**的一级页面目录 → 迁移后的路由段。
#: 与 PROJECT_PAGES 分开，因为它们的作用域不同（集群级列表跨全部命名空间）。
CLUSTER_PAGES = {
    "configmaps": "configmaps",
    "nodes": "nodes",
    "projects": "namespaces",
    "servicecomponents": "components",
    "storage": "storageclasses",
    "persistentvolumes": "persistentvolumes",
}

#: 集群作用域里明确不迁移的页面与原因。
CLUSTER_UNMIGRATED = {
    "custommonitoring": "自定义监控：需要图表引擎",
    "logcollections": "日志收集：需要日志组件配置",
    "gateway": "集群网关：本集群无网关控制器实例",
    "kubeconfig": "集群 kubeconfig 管理：需要生成与轮换逻辑",
}

#: 老 console 里有、本轮明确不迁移的页面，以及原因。
UNMIGRATED = {
    "overview": "项目概览：需要配额/用量接口，单独立项",
    "applications": "应用商店：依赖 openpitrix 模块",
    "applications_template": "应用模板：依赖 openpitrix 模块",
    "imagebuilder": "镜像构建器：依赖 devops 模块",
    "grayrelease": "灰度发布：依赖 servicemesh 模块",
    "custommonitoring": "自定义监控：需要图表引擎",
}


def route_segments() -> dict[str, set[str]]:
    """迁移后的路由段，按作用域分组。"""
    project = ROUTES / "kube-frontend.$workspace.clusters.$cluster.projects.$namespace"
    cluster = ROUTES / "kube-frontend.clusters.$cluster"
    out: dict[str, set[str]] = {"project": set(), "cluster": set()}
    if project.is_dir():
        out["project"] = {p.name for p in project.iterdir() if p.is_dir()}
    if cluster.is_dir():
        out["cluster"] = {p.name for p in cluster.iterdir() if p.is_dir()}
    return out


def page_files(scope_dir: Path, segment: str) -> list[str]:
    """The files of one page folder: `route.tsx` / `index.tsx` / `$name.tsx`. """
    folder = scope_dir / segment
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.iterdir() if p.suffix == ".tsx")


def registry_pages() -> dict[str, dict]:
    """Pages registered in the area registry, keyed by `scope:segment`. """
    text = (APP / "areas/registry.ts").read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for match in re.finditer(r"scope: '(project|cluster)'([\s\S]*?)\n  \},", text):
        scope, body = match.group(1), match.group(2)
        # Keyed by `path`, not `key`: the route folder is named after the path, so
        # comparing a camelCase key against a kebab-case folder reported a page as
        # "not registered" while it was registered and reachable.
        for page in re.finditer(r"\{ key: '[^']+', path: '([^']+)'([^}]*)\}", body):
            out[f"{scope}:{page.group(1)}"] = {
                "status": "planned" if "planned" in page.group(2) else "ready",
            }
    return out


def spec_features() -> dict[str, list[str]]:
    """Which submodule folders have at least one spec. """
    out: dict[str, list[str]] = {}
    if not SPECS.is_dir():
        return out
    for folder in SPECS.iterdir():
        if folder.is_dir():
            out[folder.name] = [p.stem for p in folder.glob("*.yaml")]
    return out


def main() -> int:
    segments = route_segments()
    project_dir = ROUTES / "kube-frontend.$workspace.clusters.$cluster.projects.$namespace"
    cluster_dir = ROUTES / "kube-frontend.clusters.$cluster"
    registry = registry_pages()
    specs = spec_features()

    report: dict[str, object] = {"missing": [], "orphan": [], "unregistered": [], "no_spec": [], "details": {}}

    # 1. 老 console 的项目页面 → 是否已迁移
    for old, segment in PROJECT_PAGES.items():
        if not (OLD / "projects/containers" / old).exists() and not (OLD / "projects/containers" / old.split("/")[0]).exists():
            continue
        if segment not in segments["project"]:
            report["missing"].append(f"{old} -> {segment}（老页面存在，迁移后没有该路由）")

    # 2. 迁移后多余的项目路由（老 console 没有的页面）
    expected = set(PROJECT_PAGES.values())
    for segment in sorted(segments["project"] - expected):
        report["orphan"].append(segment)

    # 3. 每个页面的子页面结构
    for segment in sorted(segments["project"]):
        files = page_files(project_dir, segment)
        key = f"project:{segment}"
        report["details"][key] = files
        if "route.tsx" not in files:
            report["missing"].append(f"{segment}：缺 route.tsx（列表会吞掉详情）")
        if "index.tsx" not in files:
            report["missing"].append(f"{segment}：缺 index.tsx")
        if key not in registry:
            report["unregistered"].append(key)

    # 集群级：老页面 → 是否已迁移。此前只查「多余」与「未登记」，一条**没迁移的**
    # 集群页因此完全不出现在报告里——缺口必须自己浮出来，不能靠人记得去数。
    for old, segment in CLUSTER_PAGES.items():
        if not (OLD / "clusters/containers" / old).exists():
            continue
        if segment not in segments["cluster"]:
            report["missing"].append(f"cluster:{old} -> {segment}（老页面存在，迁移后没有该路由）")

    for segment in sorted(segments["cluster"]):
        files = page_files(cluster_dir, segment)
        key = f"cluster:{segment}"
        report["details"][key] = files
        if key not in registry:
            report["unregistered"].append(key)

    # 4. 用例规格：页面能否被验证
    for submodule in ("configmaps", "secrets", "serviceaccounts", "app-workloads",
                      "storage", "monitoring", "project-settings", "cluster-management"):
        if not specs.get(submodule):
            report["no_spec"].append(submodule)

    if "--json" in sys.argv:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    print(f"迁移后的项目页面：{len(segments['project'])} 个；集群页面：{len(segments['cluster'])} 个")
    for label, key in (("缺口", "missing"), ("多余路由", "orphan"),
                       ("未登记区域（侧栏到不了）", "unregistered"), ("无用例规格", "no_spec")):
        items = report[key]  # type: ignore[index]
        print(f"\n{label}：{len(items)}")
        for item in items:
            print(f"  - {item}")

    print("\n显式决定不迁移的页面（项目作用域）：")
    for name, why in UNMIGRATED.items():
        print(f"  - {name}：{why}")
    print("\n显式决定不迁移的页面（集群作用域）：")
    for name, why in CLUSTER_UNMIGRATED.items():
        print(f"  - {name}：{why}")

    print("\n每页的文件：")
    for key, files in report["details"].items():  # type: ignore[union-attr]
        print(f"  {key}: {', '.join(files) if files else '（空）'}")

    total_gaps = sum(len(report[key]) for key in ("missing", "orphan", "unregistered", "no_spec"))  # type: ignore[arg-type]
    print(f"\n合计待处理：{total_gaps}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
