#!/usr/bin/env python3
"""Render Markdown case docs from specs/*.yaml, plus the three-way traceability matrix."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
SPEC_ROOT = ROOT / "specs"
CASES_ROOT = ROOT / "cases"
REPO_ROOT = ROOT.parents[1]
PRD_CATALOG = REPO_ROOT / "prd" / "catalog.yaml"

AC_DEF = re.compile(r"^\s*-\s*\*\*(AC-[A-Z0-9_-]+)\*\*\s*[—\-–]\s*(.+?)\s*$")
AC_ANY = re.compile(r"(?<![A-Za-z0-9_-])(AC-[A-Z0-9][A-Z0-9_-]*[A-Z0-9])")
US_LINE = re.compile(r"^###\s+(US\d+)\s*[-—]\s*(.*?)\s*(?:\(Priority:\s*(P\d)\))?\s*$")


def md_list(items) -> str:
    return "\n".join(f"- {item}" for item in items or [])


def read_ac(prd_rel: str) -> dict[str, str]:
    path = REPO_ROOT / prd_rel
    if not path.is_file():
        return {}
    found: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = AC_DEF.match(line)
        if m and m.group(1) not in found:
            found[m.group(1)] = m.group(2)
    return found


def read_us(prd_rel: str) -> dict[str, dict]:
    path = REPO_ROOT / prd_rel
    if not path.is_file():
        return {}
    out: dict[str, dict] = {}
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = US_LINE.match(line)
        if m:
            current = m.group(1)
            out[current] = {"title": m.group(2), "priority": m.group(3) or "", "body": []}
            continue
        if current and line.startswith("### "):
            current = None
            continue
        if current:
            out[current]["body"].append(line)
    return out


def catalog_design_map() -> dict[str, str]:
    if not PRD_CATALOG.is_file():
        return {}
    data = yaml.safe_load(PRD_CATALOG.read_text(encoding="utf-8")) or {}
    out: dict[str, str] = {}
    for mod in data.get("modules") or []:
        if mod.get("prd"):
            out[mod["prd"]] = mod.get("design", "")
        for sub in mod.get("submodules") or []:
            if sub.get("prd"):
                out[sub["prd"]] = sub.get("design", "")
            for feat in sub.get("features") or []:
                if feat.get("prd"):
                    out[feat["prd"]] = feat.get("design", "")
    return out


def design_ac_map() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for path in (REPO_ROOT / "design").rglob("*.md"):
        rel = str(path.relative_to(REPO_ROOT))
        body: list[str] = []
        on = False
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                on = line.strip() == "## 关联需求"
                continue
            if on:
                body.append(line)
        out[rel] = AC_ANY.findall("\n".join(body))
    return out


def covers_section(spec: dict) -> list[str]:
    covers = [str(item) for item in (spec.get("covers") or []) if str(item).strip()]
    if not covers:
        return []
    prd = str(spec.get("prd") or "")
    known = read_ac(prd)
    lines = [
        "### 覆盖的验收场景",
        "",
        f"文案来自需求 [`{prd}`](../../../../{prd})，与用例的 `covers` 对应；改需求即改这里。",
        "",
    ]
    for ac in covers:
        text = known.get(ac)
        lines.append(f"- **{ac}** — {text}" if text
                     else f"- **{ac}** — （需求里找不到这条 AC，请先补需求或改 `covers`）")
    lines.append("")
    return lines


def story_section(spec: dict) -> list[str]:
    stories = [str(s) for s in (spec.get("story") or []) if str(s).strip()]
    if not stories:
        return []
    prd = str(spec.get("prd") or "")
    known = read_us(prd)
    lines = [
        "## 覆盖的用户故事",
        "",
        f"文案来自需求 [`{prd}`](../../../../{prd})，与用例的 `story` 对应；改需求即改这里。",
        "",
    ]
    for story in stories:
        item = known.get(story)
        if not item:
            lines.append(f"- **{story}** —（需求里找不到这条用户故事，请先补需求或改 `story`）")
            continue
        independent = ""
        for raw in item["body"]:
            if raw.startswith("**Independent Test**"):
                independent = raw.split("：", 1)[-1].strip()
                break
        priority = f" (Priority: {item['priority']})" if item["priority"] else ""
        lines += [f"### {story} - {item['title']}{priority}", ""]
        for raw in item["body"]:
            text = raw.strip()
            if not text or text.startswith("**Independent Test**"):
                continue
            lines.append(text)
        lines.append("")
        if independent:
            lines += [f"**Independent Test**：{independent}", ""]
    return lines


def steps_section(steps) -> list[str]:
    if not steps:
        return ["## 测试步骤", ""]
    lines = ["## 测试步骤", ""]
    if all(isinstance(step, dict) for step in steps):
        lines += ["| Given | When | Then |", "|-------|------|------|"]
        for step in steps:
            lines.append(f"| {step.get('given', '')} | {step.get('when', '')} | {step.get('then', '')} |")
        lines.append("")
        return lines
    for index, step in enumerate(steps, 1):
        lines.append(f"{index}. {step}")
    lines.append("")
    return lines


def design_section(spec: dict) -> list[str]:
    prd = str(spec.get("prd") or "")
    design = str(spec.get("design") or catalog_design_map().get(prd, ""))
    if not design:
        return []
    return ["### 关联设计", "", f"- 技术方案 [`{design}`](../../../../{design})", ""]


def render(spec: dict) -> str:
    lines = [
        f"# {spec.get('id', '')} {spec.get('title', '')}",
        "",
        f"- **用例 ID**: `{spec.get('id', '')}`",
        f"- **级别**: L{spec.get('level', '')}  **套件**: `{spec.get('suite', '')}`",
        f"- **模块**: `{spec.get('module', '')}` / `{spec.get('submodule', '')}` `{spec.get('feature', '')}`",
        f"- **入口**: `{spec.get('entry_url', '{BASE_URL}')}`",
        f"- **需求**: `{spec.get('prd', '')}`",
        "",
        "## 产品功能",
        "",
        str(spec.get("product", "")).strip(),
        "",
        "### 关联需求",
        "",
        f"- `{spec.get('prd', '')}`",
        "",
        *covers_section(spec),
        *design_section(spec),
        *story_section(spec),
        "## 前置与配置",
        "",
        md_list(spec.get("preconditions") or []),
        "",
        *steps_section(spec.get("steps") or []),
        "## 期望结果",
        "",
        md_list(spec.get("expected") or []),
        "",
        "## 失败排查",
        "",
        md_list(spec.get("troubleshoot") or []) or "- 先看 `tests/ui/artifacts/` 下的截图与日志",
        "",
        "## 产品改版后如何更新自动化",
        "",
        md_list(spec.get("update_automation") or [])
        or "- 步骤文案改 `specs/`；选择器改 `pages/`",
        "",
    ]
    return "\n".join(lines).rstrip() + "\n"


def traceability(specs: list[dict]) -> str:
    lines = [
        "# 需求 ↔ 技术方案 ↔ 用例 追溯矩阵",
        "",
        "由 `generate_case_docs.py` 生成。`覆盖用例` 或 `承接技术方案` 为空，表示这条 AC 还没有用例或还没有技术方案承接。",
        "",
        "| 功能点 | AC | 覆盖用例 | 承接技术方案 |",
        "|--------|----|----------|--------------|",
    ]
    dmap = catalog_design_map()
    dacs = design_ac_map()

    prd_files: dict[str, dict[str, str]] = {}
    covers_by_ac: dict[str, list[str]] = {}
    missing_covers: list[str] = []
    for spec in specs:
        prd = str(spec.get("prd") or "")
        if prd not in prd_files:
            prd_files[prd] = read_ac(prd)
        covers = [str(item) for item in (spec.get("covers") or []) if str(item).strip()]
        if not covers:
            missing_covers.append(str(spec.get("id") or "?"))
        for ac in covers:
            covers_by_ac.setdefault(ac, []).append(str(spec.get("id") or "?"))

    no_design: list[str] = []
    seen: set[str] = set()
    for prd, acs in sorted(prd_files.items()):
        for ac in sorted(acs):
            if ac in seen:
                continue
            seen.add(ac)
            used = ", ".join(f"`{t}`" for t in covers_by_ac.get(ac, [])) or "**（未覆盖）**"
            design = dmap.get(prd, "")
            if design and ac in dacs.get(design, []):
                carried = f"[`{design}`](../../../{design})"
            else:
                carried = "**（无）**"
                no_design.append(ac)
            label = prd.replace("prd/", "").replace(".md", "") if prd else ac
            lines.append(f"| {label} | `{ac}` | {used} | {carried} |")

    lines += ["", "## 小结", ""]
    uncovered = [ac for ac in seen if ac not in covers_by_ac]
    lines.append(f"- 需求里的 AC：{len(seen)} 条，其中未覆盖 {len(uncovered)} 条、无技术方案承接 {len(no_design)} 条。")
    if uncovered:
        lines.append(f"- 未覆盖：{', '.join(f'`{ac}`' for ac in sorted(uncovered))}")
    if no_design:
        lines.append(f"- 无技术方案承接：{', '.join(f'`{ac}`' for ac in sorted(no_design))}")
    if missing_covers:
        lines.append(f"- 没有 `covers` 的用例：{len(missing_covers)} 条")

    story_by_us: dict[str, list[str]] = {}
    us_prds: set[str] = set()
    for spec in specs:
        prd = str(spec.get("prd") or "")
        us_prds.add(prd)
        for story in [str(s) for s in (spec.get("story") or [])]:
            story_by_us.setdefault(f"{prd}#{story}", []).append(str(spec.get("id") or "?"))
    us_rows = [(prd, story, story_by_us.get(f"{prd}#{story}", []))
               for prd in sorted(us_prds) for story in sorted(read_us(prd))]
    if us_rows:
        lines += ["", "## 用户故事覆盖", "", "| 功能点 | 用户故事 | 覆盖用例 |", "|--------|----------|----------|"]
        for prd, story, tids in us_rows:
            label = prd.replace("prd/", "").replace(".md", "") if prd else ""
            used = ", ".join(f"`{t}`" for t in tids) or "**（未覆盖）**"
            lines.append(f"| {label} | `{story}` | {used} |")
        missing_us = [(p, s) for p, s, t in us_rows if not t]
        lines += ["", f"- 用户故事：{len(us_rows)} 条，其中未覆盖 {len(missing_us)} 条。"]
        if missing_us:
            lines.append("- 未覆盖：" + ", ".join(f"`{p}#{s}`" for p, s in missing_us[:40]))
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    written = 0
    specs: list[dict] = []
    for path in sorted(SPEC_ROOT.rglob("*.yaml")):
        spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        specs.append(spec)
        module = spec.get("module") or "misc"
        sub = spec.get("submodule") or spec.get("suite") or "general"
        out_dir = CASES_ROOT / module / sub
        out_dir.mkdir(parents=True, exist_ok=True)
        dest = out_dir / f"{path.stem}.md"
        dest.write_text(render(spec), encoding="utf-8")
        written += 1
        print(f"wrote {dest.relative_to(ROOT)}")
    (CASES_ROOT / "_traceability.md").write_text(traceability(specs), encoding="utf-8")
    print(f"wrote {(CASES_ROOT / '_traceability.md').relative_to(ROOT)}")
    print(f"generated {written} case docs")


if __name__ == "__main__":
    main()
