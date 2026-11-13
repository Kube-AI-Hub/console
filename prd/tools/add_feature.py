#!/usr/bin/env python3
"""为一个功能点生成全部骨架，一次做完六处登记。

为什么需要它：新增一个迁移页要在六处手工登记（PRD 树、catalog、区域注册表、语言键、
用例规格、测试文件），再加路由文件夹。少写一处、写错一个 id 拼写，门禁就会报错——于是
「加一个页面」变成「加页面 + 补两三次门禁」的往返。把机械部分交给脚本，人只写真正需要
判断的东西（需求、技术方案、页面实现）。

用法：
    python3 prd/tools/add_feature.py --submodule cluster-management --feature node-pools \
        --title 节点池 --scope cluster

它做什么：
  1. 在 prd/tools/tree.py 的对应子模块下插入功能节点
  2. 生成 prd/<模块>/<子>/<功能>.md 与 design/<模块>/<子>/<功能>.md（带全部必需章节）
  3. 生成 tests/ui/specs/<模块>/<子>/<TC>.yaml 与 tests/ui/tests/<模块>/<子>/test_<TC>.py
  4. 在区域注册表登记（scope=cluster 才登记，project 由现有页面派生）

它**不**做什么：不写页面本身、不猜字段、不填技术方案的内容。那些是迁移真正的工作。
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TREE = REPO / "prd/tools/tree.py"
REGISTRY = REPO / "kube-frontend/apps/console-next/src/areas/registry.ts"


def snake(feature: str) -> str:
    return feature.replace("-", "_").upper()


def camel(feature: str) -> str:
    parts = feature.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def add_tree_node(submodule: str, feature: str, title: str, tc: str) -> bool:
    """插入功能节点，紧跟在同子模块已有节点之后。

    定位方式是「该子模块 id 的块」——树是嵌套字面量，正则改不动结构，只能按缩进找插入点。
    """
    text = TREE.read_text(encoding="utf-8")
    marker = f'"id": "{submodule}"'
    start = text.find(marker)
    if start == -1:
        raise SystemExit(f"tree.py 里找不到子模块 {submodule!r}")
    # The submodule block ends at the next line whose indent is <= its own.
    line_start = text.rfind("\n", 0, start) + 1
    indent = len(text[line_start:start]) - len(text[line_start:start].lstrip())
    cursor = start
    depth = 0
    block_end = None
    while cursor < len(text):
        ch = text[cursor]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                block_end = cursor
                break
        cursor += 1
    if block_end is None:
        raise SystemExit("找不到子模块块的结尾")
    # Insert before the closing brace of `pages`/list; use the last node's indent.
    tail = text[:block_end]
    last_node = tail.rfind('"id":')
    node_indent = tail.rfind("\n", 0, last_node) + 1
    node_indent = len(tail[node_indent:last_node]) - len(tail[node_indent:last_node].lstrip())
    node = (
        f'{" " * node_indent}{{\n'
        f'{" " * (node_indent + 4)}"id": "{feature}",\n'
        f'{" " * (node_indent + 4)}"title": "{title}",\n'
        f'{" " * (node_indent + 4)}"tests": {{"L3": ["{tc}"]}},\n'
        f'{" " * node_indent}}},\n'
    )
    text = text[:block_end] + node + text[block_end:]
    TREE.write_text(text, encoding="utf-8")
    return True


def write(path: Path, content: str) -> None:
    if path.exists():
        raise SystemExit(f"{path} 已存在，不覆盖")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--module", default="kube-frontend")
    parser.add_argument("--submodule", required=True)
    parser.add_argument("--feature", required=True, help="kebab-case，例如 node-pools")
    parser.add_argument("--title", required=True, help="中文标题，例如 节点池")
    parser.add_argument("--scope", choices=("project", "cluster"), default="cluster")
    parser.add_argument("--route", default=None, help="路由段，默认等于 feature")
    args = parser.parse_args()

    feature, title = args.feature, args.title
    route = args.route or feature
    tc = f"TC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01"
    prd_rel = f"prd/{args.module}/{args.submodule}/{feature}.md"
    design_rel = f"design/{args.module}/{args.submodule}/{feature}.md"
    test_rel = f"tests/ui/tests/{args.module}/{args.submodule}/test_{tc.replace('-', '_')}.py"

    add_tree_node(args.submodule, feature, title, tc)

    write(REPO / prd_rel, f"""# {title}（L3）

[子模块需求](./_index.md)

## 概述

（写这一页是什么、给谁用。不要写实现方式。）

## 用户故事

### US1 - （一句话说明用户要完成什么） (Priority: P1)

作为 **（角色）**，我希望 **（能力）**，以便 **（价值）**。

**Independent Test**：（怎样单独验证这条故事成立）

## 验收场景

- **AC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01** — （前置条件），当（动作），则（可核对的结果）。

## 设计目标

（这一页在体验上的目标。）

## 约束与边界

- （数据来源、只读还是可写。）

## UI 交互设计

（列、行操作、弹窗、加载与空态。）

## 文案与校验

- （每条文案对应的键，以及校验规则。）

## 边界情况

- （空数据、超时、无权限时分别显示什么。）

## 明确不做

- （哪些相关能力不在本页。）

## 假设

- （依赖的环境或数据前提。）

## 验收用例

- `{tc}`

## 功能需求

- **FR-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01** — （可测试的要求。）

## 成功标准

- **SC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01** — （可衡量的标准。）
""")

    write(REPO / design_rel, f"""# {title}（L3）

[子模块需求](../../../{prd_rel})

## 关联需求

- AC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01

## 概述

（技术方案摘要。）

## 系统现状

（老 console 对应页面是什么样、本页继承哪些列与操作。）

## 仓库落点

- `apps/console-next/src/pages/`
- `src/routes/`

## 对外契约

（读哪个接口、是否写。）

## 设计目标与非目标

目标：… 非目标：…

## 关键约束

- …

## 方案决策

### DEC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01 — （决策名）

**为什么**：（理由）

**被否方案**：（考虑过的替代方案与代价）

**何时重新考虑**：（触发条件）

## 不变量

1. …

## 已知坑

- …

## 测试与可观测

E2E 见 `tests/{args.module}/{args.submodule}/`。

## 后续改进

（已知但不本轮做的事。）

## 验收用例

- `{tc}`
""")

    write(REPO / f"tests/ui/specs/{args.module}/{args.submodule}/{tc}.yaml", f"""id: {tc}
level: 3
suite: point
module: {args.module}
submodule: {args.submodule}
feature: {feature}
title: {title} · （一句话）
entry_url: '{{BASE_URL}}/kube-frontend/…'
prd: {prd_rel}
design: {design_rel}

covers:
- AC-L3-{args.module.upper()}-{snake(args.submodule)}-{snake(feature)}-01

story:
- US1

product: （可核对的产品行为）
preconditions:
- 已登录
steps:
- （步骤）
expected:
- （期望）
performance:
- （若接口慢，写实测数字；否则写「无特殊要求」）
troubleshoot:
- （失败时先看什么）
update_automation:
- （列或操作变化时改哪里）
""")

    write(REPO / test_rel, f'''from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def {f"test_{tc.replace('-', '_')}"}(page, ui_config, screenshot):
    """{tc} （一句话）。"""

    # 断言要读回数据，不要只看「按钮亮了」：迁移中多条缺陷都是「看起来成功了」。
    pytest.skip("骨架：填写本用例的步骤与断言")
''')

    if args.scope == "cluster":
        text = REGISTRY.read_text(encoding="utf-8")
        # Append after the cluster area's last page, not before whichever page happens
        # to be named in an anchor: the anchor approach put the new tab in the middle of
        # the tab strip, so the generated order disagreed with the sidebar.
        block_start = text.find("key: 'cluster-management'")
        if block_start == -1:
            raise SystemExit("区域注册表里找不到集群管理块，手工登记")
        block_end = text.find("    ],", block_start)
        if block_end == -1:
            raise SystemExit("区域注册表里找不到 pages 数组结束位置，手工登记")
        # Insert before the closing bracket, keeping the file's own indentation.
        pages_body = text[block_start:block_end]
        last_newline = block_end
        # `key` matches `path` in the registry: every existing page uses the kebab-case
        # route name, and a camelCase key made the parity check call a registered page
        # "unregistered" because it compares against the route folder.
        entry = (
            f"      {{ key: '{route}', path: '{route}', "
            f"titleKey: 'cluster.{camel(feature)}.title', status: 'planned' }},\n"
        )
        text = text[:last_newline] + entry + text[last_newline:]
        REGISTRY.write_text(text, encoding="utf-8")

    print("已生成：")
    for rel in (prd_rel, design_rel,
                f"tests/ui/specs/{args.module}/{args.submodule}/{tc}.yaml", test_rel):
        print(f"  {rel}")
    if args.scope == "cluster":
        print("  区域注册表已插入（status: planned，页面写完再改 ready）")
    print(f"\nTC: {tc}")
    print("下一步：写需求 → 写技术方案 → 实现页面 → 填用例断言 → 门禁")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
