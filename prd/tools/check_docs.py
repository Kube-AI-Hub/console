#!/usr/bin/env python3
"""门禁：需求（prd）↔ 技术方案（design）↔ 用例（tests）三向追溯 + 结构完整性。

这是本仓库文档的**唯一门禁**。它检查：

1. 结构：catalog、需求/技术方案文件、每层用例、spec 元数据、目录层级；
2. 三向追溯：每条 `AC-*` 既被用例覆盖（`AC↔TC`），又被技术方案承接（`AC↔DES`）；
   每条 `US<n>` 至少被一条用例的 `story` 引用（`US↔TC`）；
3. 章节：三层必备章节齐全，L3 技术方案必须有 `## 仓库落点` 与 `DEC-*`；
4. 宪法：页面 SCSS 不写十六进制色值（C3）。

未迁移的需求（缺 `## 用户故事`）与技术方案（带「待迁移」标记）只报**告警**；`--strict` 下也算失败。

    python3 prd/tools/check_docs.py
    python3 prd/tools/check_docs.py --strict
    python3 prd/tools/check_docs.py --strict prd/cluster-storage design/cluster-storage
    python3 prd/tools/check_docs.py --what structure
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent          # <repo>/prd/tools
REPO = ROOT.parents[1]
PRD = REPO / "prd"
DESIGN = REPO / "design"
CATALOG = PRD / "catalog.yaml"
UI = REPO / "tests" / "ui"
SPECS = UI / "specs"
UI_TESTS = UI / "tests"

# 用例 ID 含下划线（SHARED_STORAGE），`\b` 会在下划线处截断，所以用显式边界。
ID_TOKEN = re.compile(
    r"(?<![A-Za-z0-9_-])((?:AC|DES|DEC|CON|INV|GOT|TC)-[A-Z0-9][A-Z0-9_-]*[A-Z0-9])"
)
AC_TOKEN = re.compile(r"(?<![A-Za-z0-9_-])(AC-[A-Z0-9][A-Z0-9_-]*[A-Z0-9])")
AC_DEF = re.compile(r"^\s*-\s*\*\*(AC-[A-Z0-9_-]+)\*\*\s*[—\-–]\s*(.+?)\s*$")
US_LINE = re.compile(r"^###\s+(US\d+)\s*[-—]")
NEEDS_CLARIFICATION = "[NEEDS CLARIFICATION"
STUB_MARKER = "待迁移：本文件由"
HEX_COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b")
VAGUE_PHRASES = (
    "完成主路径",
    "完成本页主路径",
    "进入本模块完成主路径",
    "拿到本层承诺的结果",
    "拿到本页承诺的结果",
    "拿到本模块提供的价值",
    "走完主路径",
    "走一次主路径",
    "走完本层核心路径",
    "核心路径可完成",
)
MIGRATED_MARKER = "## 用户故事"

PRD_SECTIONS = {
    1: ["## 概述", "## 用户故事", "## 验收场景", "## 设计目标", "## 约束与边界",
        "## UI 交互设计", "## 入口与子模块", "## 状态", "## 功能需求", "## 成功标准",
        "## 明确不做", "## 假设", "## 验收用例"],
    2: ["## 概述", "## 用户故事", "## 验收场景", "## 设计目标", "## 约束与边界",
        "## UI 交互设计", "## 页面结构", "## 异常态", "## 功能需求", "## 成功标准",
        "## 明确不做", "## 假设", "## 功能点", "## 验收用例"],
    3: ["## 概述", "## 用户故事", "## 验收场景", "## 设计目标", "## 约束与边界",
        "## UI 交互设计", "## 文案与校验", "## 边界情况", "## 功能需求", "## 成功标准",
        "## 明确不做", "## 假设", "## 验收用例"],
}

DESIGN_SECTIONS = {
    1: ["## 概述", "## 关联需求", "## 设计目标与非目标", "## 运行时拓扑", "## 模块边界与仓库落点",
        "## 数据归属", "## 关键共享契约", "## 不变量", "## 已知坑",
        "## 测试与可观测", "## 明确不做", "## 后续改进", "## 入口与子模块", "## 验收用例"],
    2: ["## 概述", "## 关联需求", "## 设计目标与非目标", "## 关键约束", "## 页面与技术结构",
        "## 状态与数据归属", "## 关键契约与依赖", "## 不变量", "## 已知坑",
        "## 测试与可观测", "## 明确不做", "## 后续改进", "## 功能点", "## 验收用例"],
    3: ["## 概述", "## 关联需求", "## 设计目标与非目标", "## 关键约束", "## 方案决策",
        "## 系统现状", "## 仓库落点", "## 对外契约", "## 不变量", "## 已知坑",
        "## 测试与可观测", "## 后续改进", "## 验收用例"],
}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def section_body(text: str, heading: str) -> str:
    out: list[str] = []
    on = False
    for line in text.splitlines():
        if line.startswith("## "):
            on = line.strip() == heading
            continue
        if on:
            out.append(line)
    return "\n".join(out)


def ac_defs(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    found: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = AC_DEF.match(line)
        if m and m.group(1) not in found:
            found[m.group(1)] = m.group(2)
    return found


def us_defs(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return [m.group(1) for line in path.read_text(encoding="utf-8").splitlines()
            if (m := US_LINE.match(line))]


def is_prd_migrated(path: Path) -> bool:
    return path.is_file() and MIGRATED_MARKER in path.read_text(encoding="utf-8")


def is_stub(path: Path) -> bool:
    return path.is_file() and STUB_MARKER in path.read_text(encoding="utf-8")


def vague_hits(text: str) -> list[str]:
    return [phrase for phrase in VAGUE_PHRASES if phrase in text]


def load_specs() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for path in sorted(SPECS.rglob("*.yaml")):
        spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        rows[str(spec.get("id") or path.stem)] = spec
    return rows


def nodes(catalog: dict):
    """(level, label, prd_rel, design_rel, test_ids)"""
    for mod in catalog.get("modules") or []:
        yield 1, mod["id"], mod.get("prd", ""), mod.get("design", ""), (mod.get("tests") or {}).get("L1") or []
        for sub in mod.get("submodules") or []:
            yield (2, f"{mod['id']}/{sub['id']}", sub.get("prd", ""), sub.get("design", ""),
                   (sub.get("tests") or {}).get("L2") or [])
            for feat in sub.get("features") or []:
                yield (3, f"{mod['id']}/{sub['id']}/{feat['id']}", feat.get("prd", ""), feat.get("design", ""),
                       (feat.get("tests") or {}).get("L3") or [])


def check_structure(report: Report, catalog: dict) -> None:
    mods = catalog.get("modules") or []
    if not mods:
        report.error("catalog 没有任何模块")

    for level, label, prd_rel, design_rel, test_ids in nodes(catalog):
        if prd_rel and not (REPO / prd_rel).is_file():
            report.error(f"{label}: 需求文件不存在 {prd_rel}")
        if design_rel and not (REPO / design_rel).is_file():
            report.error(f"{label}: 技术方案不存在 {design_rel}")
        for tid in test_ids:
            if not list(SPECS.rglob(f"{tid}.yaml")):
                report.error(f"{label}: 缺 L{level} 用例规格 {tid}")

    for path in SPECS.rglob("TC-*.yaml"):
        rel = path.relative_to(SPECS)
        if rel.parts[0] in {"core", "full"} or len(rel.parts) < 3:
            report.error(f"spec 目录层级不对：{rel}（应为 {{module}}/{{sub}}/TC-*.yaml）")
        spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if path.name.startswith("TC-L3-"):
            if spec.get("level") != 3 or spec.get("suite") != "point":
                report.error(f"{path.name}: L3 spec 的 level/suite 不是 3/point")
            if not spec.get("module") or not spec.get("prd"):
                report.error(f"{path.name}: L3 spec 缺 module 或 prd")

    for path in UI_TESTS.rglob("test_*.py"):
        rel = path.relative_to(UI_TESTS)
        if len(rel.parts) < 3:
            report.error(f"pytest 目录层级不对：tests/{rel}")


FORK_HEADER = "Copyright (C) 2026 Kube AI Hub"


def check_css(report: Report) -> None:
    """C3：本仓库新增/维护的页面 SCSS 不写十六进制色值。

    只查带 Kube AI Hub 版权头的文件：上游 KubeSphere 页面保留它们自己的写法，
    改它们会把升级冲突放大，也不是这条规则要解决的问题。
    """
    root = REPO / "src" / "pages"
    if not root.is_dir():
        return
    for path in root.rglob("*.scss"):
        text = path.read_text(encoding="utf-8")
        if FORK_HEADER not in text:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*"):
                continue
            if HEX_COLOR.search(line):
                report.error(f"{path.relative_to(REPO)}:{lineno}: 页面 SCSS 写了十六进制色值，改用 scss/variables 的 token（C3）")


def main() -> int:
    parser = argparse.ArgumentParser(description="需求 / 技术方案 / 用例 三向追溯 + 结构完整性门禁。")
    parser.add_argument("--strict", action="store_true", help="未迁移的模块也报错。")
    parser.add_argument("--what", choices=["all", "prd", "design", "tests", "structure"], default="all")
    parser.add_argument("scope", nargs="*", help="只检查这些路径前缀，例如 prd/cluster-storage design/cluster-storage")
    args = parser.parse_args()

    report = Report()
    scopes = [s.rstrip("/") for s in args.scope]
    do_prd = args.what in ("all", "prd", "design")
    do_design = args.what in ("all", "design")
    do_tests = args.what in ("all", "tests")
    do_structure = args.what in ("all", "structure") and not scopes

    def in_scope(*paths: str) -> bool:
        if not scopes:
            return True
        return any(any(p.startswith(s) for p in paths if p) for s in scopes)

    catalog = yaml.safe_load(CATALOG.read_text(encoding="utf-8")) if CATALOG.is_file() else {}
    if not catalog:
        print("ERROR catalog.yaml 不存在或为空")
        return 1

    if do_structure:
        check_structure(report, catalog)
        check_css(report)

    specs = load_specs()
    covers_by_spec = {tid: [str(a) for a in (spec.get("covers") or [])] for tid, spec in specs.items()}
    nodes_all = [n for n in nodes(catalog) if in_scope(n[2], n[3])]

    for level, label, prd_rel, design_rel, test_ids in nodes_all:
        if do_prd and prd_rel and not (REPO / prd_rel).is_file():
            report.error(f"{label}: 需求文件不存在 {prd_rel}")
        if do_design:
            if not design_rel:
                report.error(f"{label}: catalog 没有登记技术方案路径")
            elif not (REPO / design_rel).is_file():
                report.error(f"{label}: 技术方案不存在 {design_rel}")
        if do_tests:
            for tid in test_ids:
                if tid not in specs:
                    report.error(f"{label}: 用例规格不存在 {tid}")

    # 编号唯一（只扫已迁移的正文）
    seen: dict[str, str] = {}
    dup: dict[str, list[str]] = {}
    scanned: set[str] = set()
    for _level, _label, prd_rel, design_rel, _t in nodes_all:
        for rel, kind in ((prd_rel, "prd"), (design_rel, "design")):
            if not rel or rel in scanned:
                continue
            scanned.add(rel)
            path = REPO / rel
            if not path.is_file() or (kind == "design" and is_stub(path)):
                continue
            for token in set(ID_TOKEN.findall(path.read_text(encoding="utf-8"))):
                if kind == "prd" and not token.startswith("AC-"):
                    continue
                if kind == "design" and token.startswith("AC-"):
                    continue
                if token in seen:
                    dup.setdefault(token, [seen[token]]).append(rel)
                else:
                    seen[token] = rel
    for token, homes in sorted(dup.items()):
        report.error(f"编号重复：{token} 出现在 {homes}")

    prd_levels: dict[str, int] = {}
    designs_by_prd: dict[str, list[str]] = {}
    for level, _label, prd_rel, design_rel, _t in nodes_all:
        if prd_rel:
            prd_levels.setdefault(prd_rel, level)
        if prd_rel and design_rel:
            designs_by_prd.setdefault(prd_rel, []).append(design_rel)

    acs_by_prd = {rel: ac_defs(REPO / rel) for rel in prd_levels}
    us_by_prd = {rel: us_defs(REPO / rel) for rel in prd_levels}
    ac_to_tests: dict[str, list[str]] = {}
    us_to_tests: dict[str, list[str]] = {}
    for tid, spec in specs.items():
        prd_rel = str(spec.get("prd") or "")
        for ac in covers_by_spec.get(tid, []):
            ac_to_tests.setdefault(ac, []).append(tid)
        for story in [str(s) for s in (spec.get("story") or [])]:
            us_to_tests.setdefault(f"{prd_rel}#{story}", []).append(tid)
    ac_to_designs: dict[str, list[str]] = {}
    for rels in designs_by_prd.values():
        for d in rels:
            path = REPO / d
            if not path.is_file() or is_stub(path):
                continue
            for ac in AC_TOKEN.findall(section_body(path.read_text(encoding="utf-8"), "## 关联需求")):
                ac_to_designs.setdefault(ac, []).append(d)

    if do_prd:
        for prd_rel, level in sorted(prd_levels.items()):
            path = REPO / prd_rel
            if not path.is_file():
                continue
            if not is_prd_migrated(path):
                report.warn(f"{prd_rel}: 待迁移（未按新模板补章节）")
                continue
            text = path.read_text(encoding="utf-8")
            if NEEDS_CLARIFICATION in text:
                report.error(f"{prd_rel}: 需求里还有 {NEEDS_CLARIFICATION}]")
            for section in PRD_SECTIONS[level]:
                if section not in text:
                    report.error(f"{prd_rel}: 需求缺章节 {section}")
            for ac in acs_by_prd[prd_rel]:
                if do_tests and not ac_to_tests.get(ac):
                    report.error(f"{prd_rel}: {ac} 没有被任何用例覆盖")
                if do_design and not ac_to_designs.get(ac):
                    paired = designs_by_prd.get(prd_rel, [])
                    if paired and all(is_stub(REPO / d) for d in paired):
                        continue
                    report.error(f"{prd_rel}: {ac} 没有被任何技术方案承接")
            if do_tests and acs_by_prd[prd_rel]:
                for story in us_by_prd[prd_rel]:
                    if not us_to_tests.get(f"{prd_rel}#{story}"):
                        report.error(f"{prd_rel}: {story} 没有被任何用例的 story 引用")

    if do_tests:
        for tid, spec in specs.items():
            prd_rel = str(spec.get("prd") or "")
            if not in_scope(prd_rel):
                continue
            acs = acs_by_prd.get(prd_rel) or ac_defs(REPO / prd_rel)
            if acs:
                for ac in covers_by_spec.get(tid, []):
                    if ac not in acs:
                        report.error(f"{tid}: covers 的 {ac} 在 {prd_rel} 里找不到")
            stories = us_by_prd.get(prd_rel)
            if stories is None:
                stories = us_defs(REPO / prd_rel)
            for story in [str(s) for s in (spec.get("story") or [])]:
                if stories and story not in stories:
                    report.error(f"{tid}: story 的 {story} 在 {prd_rel} 里找不到")

    if do_design:
        design_levels: dict[str, int] = {}
        for level, _label, prd_rel, design_rel, _t in nodes_all:
            if design_rel:
                design_levels.setdefault(design_rel, level)
        for design_rel, level in sorted(design_levels.items()):
            path = REPO / design_rel
            if not path.is_file():
                continue
            if is_stub(path):
                report.warn(f"{design_rel}: 技术方案待迁移（仍是生成稿）")
                continue
            text = path.read_text(encoding="utf-8")
            for section in DESIGN_SECTIONS[level]:
                if section not in text:
                    report.error(f"{design_rel}: 技术方案缺章节 {section}")
            if NEEDS_CLARIFICATION in text:
                report.error(f"{design_rel}: 技术方案里还有 {NEEDS_CLARIFICATION}]")
            if level == 3 and "DEC-" not in text:
                report.error(f"{design_rel}: 技术方案没有设计决策（DEC-*）")
            paired = [p for (_l, _lab, p, d, _t) in nodes_all if d == design_rel]
            acs: dict[str, str] = {}
            for p in paired:
                acs.update(acs_by_prd.get(p) or ac_defs(REPO / p))
            for ac in AC_TOKEN.findall(section_body(text, "## 关联需求")):
                if acs and ac not in acs:
                    report.error(f"{design_rel}: 关联需求里的 {ac} 在同功能点需求里找不到")

    scanned_docs: set[str] = set()
    if do_prd or do_design:
        for _level, _label, prd_rel, design_rel, _t in nodes_all:
            for rel, enabled in ((prd_rel, do_prd), (design_rel, do_design)):
                if not enabled or not rel or rel in scanned_docs:
                    continue
                scanned_docs.add(rel)
                path = REPO / rel
                if not path.is_file():
                    continue
                for phrase in vague_hits(path.read_text(encoding="utf-8")):
                    report.error(f"{rel}: 含糊套话「{phrase}」")
    if do_tests:
        for path in sorted(SPECS.rglob("*.yaml")):
            spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            prd_rel = str(spec.get("prd") or "")
            rel = str(path.relative_to(REPO))
            if not in_scope(prd_rel, rel):
                continue
            for phrase in vague_hits(path.read_text(encoding="utf-8")):
                report.error(f"{spec.get('id') or path.name}: 含糊套话「{phrase}」")

    for line in report.warnings:
        print(f"WARN  {line}")
    for line in report.errors:
        print(f"ERROR {line}")

    if args.strict:
        report.errors.extend(report.warnings)

    print()
    print(f"errors={len(report.errors)} warnings={len(report.warnings)} "
          f"what={args.what} scopes={scopes or ['all']}")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
