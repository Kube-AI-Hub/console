"""逐页对照审计（生成物）。

这份文件回答一个问题：**老 console 的每个页面，在新 UI 里对应哪一页、有哪些验收场景、
哪些能力被明确不做**。它由 catalog（页面与 AC 的登记）与各 PRD 生成，不是手写，
所以不会随迁移推进而失真。

用法：python3 prd/tools/parity_report.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "prd" / "catalog.yaml"
OUTPUT = REPO / "docs" / "plans" / "page-parity-audit.md"
NOT_DOING = "## 明确不做"


def acs_of(prd: Path) -> list[str]:
    if not prd.exists():
        return []
    text = prd.read_text(encoding="utf-8", errors="replace")
    found: list[str] = []
    for match in re.finditer(r"AC-[A-Z0-9_-]+", text):
        value = match.group(0)
        if value not in found:
            found.append(value)
    return found


def not_doing_of(prd: Path) -> list[str]:
    """The 明确不做 bullets of one requirement file, first clause each."""
    if not prd.exists():
        return []
    text = prd.read_text(encoding="utf-8", errors="replace")
    if NOT_DOING not in text:
        return []
    section = text.split(NOT_DOING, 1)[1]
    nxt = re.search(r"\n## ", section)
    if nxt:
        section = section[: nxt.start()]
    bullets: list[str] = []
    for line in section.splitlines():
        line = line.strip()
        if line.startswith(("- ", "* ")):
            item = line[2:].strip()
            bullets.append(re.split(r"[。；;]", item)[0])
    return bullets


def main() -> int:
    catalog = yaml.safe_load(CATALOG.read_text(encoding="utf-8"))
    rows: list[str] = []
    totals = {"pages": 0, "acs": 0, "tests": 0}

    for module in catalog.get("modules", []):
        mtitle = module.get("title", module.get("id", ""))
        for submodule in module.get("submodules", []):
            features = submodule.get("features", [])
            if not features:
                continue
            rows.append(f"### {mtitle} · {submodule.get('title', submodule.get('id'))}\n")
            rows.append("| 页面 | 验收场景 | 用例 | 明确不做 |")
            rows.append("| --- | --- | --- | --- |")
            for feature in features:
                prd = REPO / str(feature.get("prd", ""))
                acs = acs_of(prd)
                tests = [t for level in (feature.get("tests") or {}).values() for t in level]
                not_doing = not_doing_of(prd)
                totals["pages"] += 1
                totals["acs"] += len(acs)
                totals["tests"] += len(tests)
                rows.append(
                    "| {title} | {acs} | {tests} | {not_doing} |".format(
                        title=feature.get("title", feature.get("id", "")),
                        acs=", ".join(acs) or "—",
                        tests=", ".join(tests) or "—",
                        not_doing="；".join(not_doing) or "—",
                    )
                )
            rows.append("")

    header = [
        "# 逐页对照审计（生成物）",
        "",
        "由 `prd/tools/parity_report.py` 从 `prd/catalog.yaml` 与各 PRD 生成：每个页面一行，列出它的验收场景、",
        "用例与**明确不做**。跨页面差异（为什么列表是页面、弹窗是编辑）的叙事解释在",
        "[`page-parity-report.md`](./page-parity-report.md)，能力级差距在 [`capability-matrix.md`](./capability-matrix.md)。",
        "",
        "## 规模",
        "",
        f"- 页面（catalog 功能点）：{totals['pages']}",
        f"- 验收场景（AC）：{totals['acs']}",
        f"- 登记用例（L2/L3）：{totals['tests']}",
        "",
        "> 页面级缺口与 URL 段归宿看 `gap_check.py`，覆盖完整性看 `check_docs.py --strict`（每个 AC 必须被 spec 覆盖）。",
        "",
        "## 逐页对照",
        "",
    ]
    OUTPUT.write_text("\n".join(header + rows), encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO)}: {totals['pages']} pages, {totals['acs']} ACs, {totals['tests']} tests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
