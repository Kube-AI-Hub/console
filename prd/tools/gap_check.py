"""缺口清单：老 console 的每一个 URL 段，是否有明确归宿。

## 为什么需要这个工具

`parity_check.py` 按**一级目录名**匹配。老 console 把页面按功能分组存放：

```text
clusters/containers/Storage/{Volumes, StorageClasses, VolumeSnapshots, JuiceFS, PV, ...}
clusters/containers/Workload/{Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, Pods, Services, Routes}
```

于是「`Storage` 这个目录名对上了新 UI 的 `storageclasses`」= 整个 `Storage/` 子树被当成已迁移；
`Workload` 更直接——它在 `STRUCTURAL_DIRS` 里，被当作布局目录**整个跳过**。

结果就是：`Storage/Volumes`（集群级 PVC 列表）、`VolumeSnapshots`、`JuiceFS`、
`Workload` 下的 8 个集群级负载页，从未被任何自动检查枚举过。
缺口分析（`docs/plans/new-ui-gap-analysis.md`）统计的 115 个页面级缺口，成因不是判断错了，
是**从来没进过清单**。

本工具按 URL 段递归枚举，不做目录名匹配，因此不受分组方式影响。

## 四类归宿

| 归宿 | 含义 | 要求 |
| --- | --- | --- |
| `✓ 已迁移` | 新 UI 有对应段 | 自动比对，改名登记在 `RENAME` |
| `⊘ 明确不做` | 决定不做 | **必须写原因**，且能追到接口探测结果（见计划 §6.1） |
| `⇄ 别处承接` | 在另一个作用域/页面承接 | 写清在哪 |
| `… 已登记缺口` | 承认没做，有计划 | 指向计划条目，持续可见、不阻断 CI |

四类之外的段 = **未归类**，说明从没被考虑过。`--strict` 下退出码 1。

这不是为了把列表变空，而是为了让「没做」和「不做」分开：
分不清这两者的条目，正是缺口能长期隐身的原因。

用法：

    python3 prd/tools/gap_check.py            # 报告
    python3 prd/tools/gap_check.py --strict   # 有未归类条目则退出码 1（verify.py 用它）
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OLD = REPO / "src/pages"
ROUTES = REPO / "kube-frontend/apps/console-next/src/routes"

Q, BT = chr(39), chr(96)
_VAL = "([" + Q + BT + "][^" + Q + BT + "]*[" + Q + BT + "]|\\[[^\\]]*\\])"
_PATH = re.compile("path:" + r"\s*" + _VAL)

#: 老作用域目录 → 新 UI 路由目录。作用域决定去哪儿找对应页面。
SCOPE_DIRS = {
    "clusters": "kube-frontend.clusters.$cluster",
    "projects": "kube-frontend.$workspace.clusters.$cluster.projects.$namespace",
    "access": "kube-frontend.access",
    "settings": "kube-frontend.settings",
    # 应用商店的页面落在两个顶层目录下，段级归宿见 MAPPED。
    "apps": "kube-frontend.apps-manage",
    "workspaces": "kube-frontend.workspaces.$workspace",
}

#: 老段名 → 新段名（改名、合并、复数统一）。**按作用域分别登记**：
#: `roles` 在集群里是 clusterrole，在项目里是项目角色，同一个词指向不同页面。
RENAME: dict[str, dict[str, str]] = {
    "clusters": {
        "base-info": "settings",
        "customresources": "custom-resources",
        "logcollections": "log-collections",
        "monitor-cluster": "monitor",
        "projects": "namespaces",
        "pv": "persistentvolumes",
        "roles": "clusterroles",
        "volumes": "persistentvolumeclaims",
        "alerts": "alerting-messages",
        "alert-rules": "alerting-policies",
    },
    "projects": {
        "s2ibuilders": "s2ibuilder",
        "base-info": "baseinfo",
        "volume-snapshots": "volumesnapshots",
        "volumes": "persistentvolumeclaims",
        "alert-rules": "alertingrules",
    },
    "access": {"accounts": "users", "roles": "clusterroles"},
    "settings": {"base-info": "info"},
    "workspaces": {
        "base-info": "overview",
        "groups": "user-groups",
    },
}

#: 明确不迁移的段 → 原因。原因必须能追到接口探测结果（见计划 §6.1）或已登记的技术约束。
UNMIGRATED: dict[str, str] = {
    "clusters/kubeconfig": "kubeconfig 读取 405（计划 §7.3）；导入更新已迁移",
    "projects/applications": "自制应用（CRD Application）：application.kubesphere.io/v1alpha1 只提供 helm* 资源，applications 资源 404；模板应用已由应用商店承接",
    "settings/third-login": "第三方登录：登录方式由服务端注入，控制台无写入路径（计划 §7.3）",
}

#: 在别处承接的段 → 说明。
ELSEWHERE: dict[str, str] = {
    "workspaces/devops": "DevOps 工程在集群作用域 /kube-frontend/clusters/<cluster>/devops（新 UI 集群侧栏），不在企业空间作用域",
    "clusters/roles": "集群角色统一在「访问控制 › 平台角色」维护（同一批 clusterrole 对象）",
    "settings/notification-configuration": "重定向到 settings/mail（通知渠道是每渠道一页）",
}

#: 已登记缺口：承认还没做，并指向计划条目。**不是「明确不做」**——
#: 登记在此是为了让它们持续可见，而不是消失。
PLANNED: dict[str, str] = {
    # 2026-11-15：用户确认所有组件已开启（应用商店/DevOps/集群网关/联邦/服务网格）。
    # 这些段原登记为「模块未开启」，现改为待迁移，按区域分批交付。
}

#: 整个作用域级别的归宿。老 console 有 9 个作用域，其中四个整块不在迁移范围内——
#: 它们必须在这里出现，否则「不迁移」和「忘了枚举」看起来一模一样。
SCOPE_DECISIONS: dict[str, tuple[str, str]] = {
    # 2026-11-15：两个整块作用域随组件开启进入迁移范围，按区域分批交付。
    "devops": ("migrated", "DevOps 工程：列表/详情/页签/流水线详情已迁移"),
    "fedprojects": ("migrated", "联邦项目：列表/详情/资源详情已迁移"),
}

#: 老段 → 新 UI 的页面位置。用于**不在某个作用域目录下**的页面
#: （应用商店是顶栏一级入口，路径是 `/kube-frontend/apps` 与 `/apps-manage`）。
MAPPED: dict[str, str] = {
    "apps/apps": "kube-frontend/apps（应用商店浏览）",
    "apps/apps-manage": "kube-frontend/apps-manage（商店管理）",
    "apps/store": "kube-frontend/apps-manage/store（商店里的应用）",
    "apps/categories": "kube-frontend/apps-manage/categories",
    "apps/reviews": "kube-frontend/apps-manage/reviews",
}

#: 只做重定向、没有自己页面的段：它们是入口别名，不是页面。
REDIRECT_ONLY = {"*", "workloads", "clusters"}

CATEGORY_MARK = {"migrated": "✓", "unmigrated": "⊘", "elsewhere": "⇄", "planned": "…", "untracked": "✗"}


def _first_segment(path: str) -> str:
    """路径的第一段，跳过参数段与模板变量。"""
    for part in path.strip("/").split("/"):
        if not part or part.startswith(":") or part.startswith("$") or "${" in part:
            continue
        if part in REDIRECT_ONLY:
            return ""
        return part
    return ""


def legacy_segments(scope_dir: Path) -> set[str]:
    """老作用域里出现的所有 URL 段。

    直接读 `routes/*.js` 的 `path:` 字面量。不按容器目录枚举——
    `clusters/containers/Workload/Deployments` 的段是 `/clusters/:c/deployments`，
    与目录层级无关，只有路径才是页面身份。
    """
    segments: set[str] = set()
    for f in sorted((scope_dir / "routes").glob("*.js")):
        text = f.read_text(encoding="utf-8", errors="replace")
        for match in _PATH.finditer(text):
            for raw in re.findall("[" + Q + BT + "]([^" + Q + BT + "]*)[" + Q + BT + "]", match.group(1)):
                segment = _first_segment(raw)
                if segment:
                    segments.add(segment.lower())
    return segments


def new_segments(scope: str) -> set[str]:
    directory = ROUTES / SCOPE_DIRS[scope]
    if not directory.exists():
        return set()
    return {entry.name.lower() for entry in directory.iterdir() if entry.is_dir()}


def classify(scope: str, segment: str, new: set[str]) -> tuple[str, str]:
    """给一个老段定归宿。返回 (类别, 说明)。

    **已迁移优先于任何登记。** 反过来的话，一条过期的 `PLANNED`（页面其实已经迁了）
    会一直把真实进度盖住——这正是本工具要消除的那类"看起来没做/看起来做了"的错觉。
    登记过期不静默：迁移了但还挂着 `不做`/`缺口` 的，单独报"登记过期"。
    """
    key = f"{scope}/{segment}"
    target = RENAME.get(scope, {}).get(segment, segment)
    if target in new:
        stale = UNMIGRATED.get(key) or PLANNED.get(key) or ELSEWHERE.get(key)
        note = f"（登记过期：仍标着「{stale}」）" if stale else (target if target != segment else "")
        return "migrated", note
    if key in UNMIGRATED:
        return "unmigrated", UNMIGRATED[key]
    if key in ELSEWHERE:
        return "elsewhere", ELSEWHERE[key]
    if key in MAPPED:
        return "migrated", MAPPED[key]
    if key in PLANNED:
        return "planned", PLANNED[key]
    return "untracked", "既未迁移也未登记"


def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    totals = dict.fromkeys(CATEGORY_MARK, 0)
    untracked: list[str] = []
    stale: list[str] = []

    for scope in SCOPE_DECISIONS:
        if (OLD / scope).exists():
            category, reason = SCOPE_DECISIONS[scope]
            totals[category] += 1
            print(f"\n## {scope}  （整块）")
            print(f"  {CATEGORY_MARK[category]} {reason}")

    for scope in SCOPE_DIRS:
        scope_dir = OLD / scope
        if not scope_dir.exists():
            continue
        segments = legacy_segments(scope_dir)
        new = new_segments(scope)

        print(f"\n## {scope}  （老 {len(segments)} 段 / 新 {len(new)} 段）")
        for segment in sorted(segments):
            category, note = classify(scope, segment, new)
            totals[category] += 1
            if category == "untracked":
                untracked.append(f"{scope}/{segment}")
            if "登记过期" in note:
                stale.append(f"{scope}/{segment}")
            detail = f" → {note}" if note else ""
            print(f"  {CATEGORY_MARK[category]} {segment:30s}{detail}")

    print("\n## 汇总")
    print(
        f"  已迁移 {totals['migrated']} / 明确不做 {totals['unmigrated']}"
        f" / 别处承接 {totals['elsewhere']} / 已登记缺口 {totals['planned']}"
        f" / **未归类 {totals['untracked']}**"
    )
    if stale:
        print("\n登记过期（页面已迁移，但清单还标着「不做/缺口」；更新清单或回退代码）：")
        for item in stale:
            print(f"  - {item}")
    if untracked:
        print("\n未归类（缺口正是从这里漏掉的，必须逐条判定）：")
        for item in untracked:
            print(f"  - {item}")
    if strict and untracked:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
