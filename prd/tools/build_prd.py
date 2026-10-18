#!/usr/bin/env python3
"""按 `tree.py` 同步 `prd/catalog.yaml`，并**只补缺失**的需求稿、技术方案稿与 L1/L2 用例桩。

已有 Markdown 一律不动。要覆盖手写内容必须显式加 `--force-prd` / `--force-design`，
那会毁掉正文，只在全新脚手架重建时使用。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tree import MODULES, tc_id  # noqa: E402

ROOT = Path(__file__).resolve().parent          # <repo>/prd/tools
REPO = ROOT.parents[1]
PRD = REPO / "prd"
DESIGN = REPO / "design"
SPECS = REPO / "tests" / "ui" / "specs"
CATALOG = PRD / "catalog.yaml"

STUB = "待迁移：本文件由 `prd/tools/build_prd.py` 生成，请按 `{}` 的模板补全后删掉这一行。"


def design_id_for(tc: str) -> str:
    """TC-L3-X-Y-Z-01 -> DES-L3-X-Y-Z（前缀替换，不 slugify）。"""
    return tc.replace("TC-", "DES-", 1).rsplit("-", 1)[0]


def prd_body(level: int, module: str, sub: str, feature: str, title: str) -> str:
    if level == 1:
        return f"""# {title}（L1）

{STUB.format("prd/templates/L1-module.md")}

## 概述

## 用户故事

### US1 - 作为运维，从集群菜单进入{title}，看到可操作的入口

**Independent Test**：打开 `/clusters/default/juicefs-storage/overview`，核对页签与主区。

## 验收场景

- **AC-CORE-{module.upper()}-01** — Given 已登录，When 打开入口，Then 页签可见且不报错。

## 设计目标

## 约束与边界

## UI 交互设计

## 入口与子模块

## 状态

## 功能需求

## 成功标准

## 明确不做

## 假设

## 验收用例

- `TC-CORE-{module.upper()}-01`
"""

    if level == 2:
        return f"""# {title}（L2）

{STUB.format("prd/templates/L2-submodule.md")}

## 概述

## 用户故事

### US1 - 作为运维，打开{title}，在三个页签之间切换并看到各自的数据

**Independent Test**：依次打开概览、卷与配额、性能，核对每页的主区。

## 验收场景

- **AC-FULL-{module.upper()}-{sub.upper()}-01** — Given 已登录，When 打开页面，Then 三个页签可切换。

## 设计目标

## 约束与边界

## UI 交互设计

## 页面结构

## 异常态

## 功能需求

## 成功标准

## 明确不做

## 假设

## 功能点

## 验收用例

- `TC-FULL-{module.upper()}-{sub.upper()}-01`
"""

    tc = tc_id(module, sub, feature)
    return f"""# {title}（L3）

{STUB.format("prd/templates/L3-feature.md")}

## 概述

## 用户故事

### US1 - 作为运维，在{title}上完成一次真实操作并看到结果

**Independent Test**：打开 `{{entry_url}}`，执行该功能点的主操作，核对可观察结果。

## 验收场景

- **AC-{tc[3:]}** — Given 已登录，When 执行主操作，Then 结果符合预期。

## 设计目标

## 约束与边界

## UI 交互设计

## 文案与校验

## 边界情况

## 功能需求

## 成功标准

## 明确不做

## 假设

## 验收用例

- `{tc}`
"""


def design_body(level: int, module: str, sub: str, feature: str, title: str, acs: list[str]) -> str:
    ac_lines = "\n".join(f"- `{ac}`" for ac in acs) or "- （待补）"
    head = f"""# {title} · 技术方案（L{level}）

{STUB.format(f"design/templates/L{level}-" + ("module" if level == 1 else "submodule" if level == 2 else "feature") + ".md")}

## 概述

## 关联需求

{ac_lines}

## 设计目标与非目标
"""
    if level == 1:
        return head + """
## 运行时拓扑

## 模块边界与仓库落点

## 数据归属

## 关键共享契约

## 不变量

## 已知坑

## 测试与可观测

## 明确不做

## 后续改进

## 入口与子模块

## 验收用例
"""
    if level == 2:
        return head + """
## 关键约束

## 页面与技术结构

## 状态与数据归属

## 关键契约与依赖

## 不变量

## 已知坑

## 测试与可观测

## 明确不做

## 后续改进

## 功能点

## 验收用例
"""
    return head + """
## 关键约束

## 方案决策

## 系统现状

## 仓库落点

## 对外契约

## 不变量

## 已知坑

## 测试与可观测

## 后续改进

## 验收用例
"""


def spec_stub(tc: str, level: int, module: str, sub: str, feature: str, title: str,
              prd_rel: str, design_rel: str, acs: list[str], stories: list[str]) -> str:
    suite = {1: "core", 2: "full"}.get(level, "point")
    data = {
        "id": tc,
        "level": level,
        "suite": suite,
        "module": module,
        "submodule": sub or "flow",
        "feature": feature or "page",
        "title": title,
        "entry_url": "{BASE_URL}/clusters/default/juicefs-storage/overview",
        "prd": prd_rel,
        "design": design_rel,
        "covers": acs,
        "story": stories,
        "product": f"验证{title}的入口与主区。",
        "preconditions": ["已登录，且在 default 集群"],
        "steps": ["打开 {BASE_URL}/clusters/default/juicefs-storage/overview"],
        "expected": ["页面主区可见且不出现未翻译 key"],
    }
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)


def acs_of(path: Path) -> list[str]:
    if not path.is_file():
        return []
    import re
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*-\s*\*\*(AC-[A-Z0-9_-]+)\*\*", line)
        if m:
            out.append(m.group(1))
    return out


def stories_of(path: Path) -> list[str]:
    if not path.is_file():
        return []
    import re
    return [m.group(1) for line in path.read_text(encoding="utf-8").splitlines()
            if (m := re.match(r"^###\s+(US\d+)\s*[-—]", line))]


def write(path: Path, body: str, force: bool) -> bool:
    if path.is_file() and not force:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="同步 catalog 并补缺失稿。")
    parser.add_argument("--force-prd", action="store_true")
    parser.add_argument("--force-design", action="store_true")
    args = parser.parse_args()

    catalog = {"modules": []}
    created = 0

    for mod in MODULES:
        prd_rel = f"prd/{mod['id']}/_index.md"
        design_rel = f"design/{mod['id']}/_index.md"
        prd_path = REPO / prd_rel
        created += write(prd_path, prd_body(1, mod["id"], "", "", mod["title"]), args.force_prd)
        acs = acs_of(prd_path)
        created += write(REPO / design_rel, design_body(1, mod["id"], "", "", mod["title"], acs), args.force_design)
        created += write(SPECS / mod["id"] / "core" / f"{mod['tests']['L1'][0]}.yaml",
                         spec_stub(mod["tests"]["L1"][0], 1, mod["id"], "", "", mod["title"],
                                   prd_rel, design_rel, acs, stories_of(prd_path)), args.force_prd)

        entry = {
            "id": mod["id"],
            "title": mod["title"],
            "prd": prd_rel,
            "design": design_rel,
            "tests": {"L1": mod["tests"]["L1"]},
            "submodules": [],
        }

        for sub in mod.get("submodules") or []:
            s_prd = f"prd/{mod['id']}/{sub['id']}/_index.md"
            s_design = f"design/{mod['id']}/{sub['id']}/_index.md"
            s_prd_path = REPO / s_prd
            created += write(s_prd_path, prd_body(2, mod["id"], sub["id"], "", sub["title"]), args.force_prd)
            s_acs = acs_of(s_prd_path)
            created += write(REPO / s_design,
                             design_body(2, mod["id"], sub["id"], "", sub["title"], s_acs), args.force_design)
            created += write(SPECS / mod["id"] / sub["id"] / f"{sub['tests']['L2'][0]}.yaml",
                             spec_stub(sub["tests"]["L2"][0], 2, mod["id"], sub["id"], "", sub["title"],
                                       s_prd, s_design, s_acs, stories_of(s_prd_path)), args.force_prd)

            sub_entry = {
                "id": sub["id"],
                "title": sub["title"],
                "prd": s_prd,
                "design": s_design,
                "tests": {"L2": sub["tests"]["L2"]},
                "features": [],
            }

            for feat in sub.get("features") or []:
                f_prd = f"prd/{mod['id']}/{sub['id']}/{feat['id']}.md"
                f_design = f"design/{mod['id']}/{sub['id']}/{feat['id']}.md"
                f_prd_path = REPO / f_prd
                created += write(f_prd_path, prd_body(3, mod["id"], sub["id"], feat["id"], feat["title"]),
                                 args.force_prd)
                f_acs = acs_of(f_prd_path)
                created += write(REPO / f_design,
                                 design_body(3, mod["id"], sub["id"], feat["id"], feat["title"], f_acs),
                                 args.force_design)
                sub_entry["features"].append({
                    "id": feat["id"],
                    "title": feat["title"],
                    "prd": f_prd,
                    "design": f_design,
                    "tests": {"L3": (feat.get("tests") or {}).get("L3")
                              or [tc_id(mod["id"], sub["id"], feat["id"])]},
                })

            entry["submodules"].append(sub_entry)

        catalog["modules"].append(entry)

    CATALOG.write_text(yaml.safe_dump(catalog, sort_keys=False, allow_unicode=True), encoding="utf-8")
    print(f"catalog: {CATALOG.relative_to(REPO)}")
    print(f"created {created} file(s); existing Markdown left untouched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
