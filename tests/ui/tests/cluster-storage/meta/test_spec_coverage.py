"""规格与测试的对应关系。

`check_docs.py` 能证明「每条 AC 有用例」，但证明不了「每条用例真的有测试在跑」。
这里补上那一环：`specs/**/TC-*.yaml` 里的每个 id，必须在 `tests/**` 里有一个同名
测试函数（`test_TC_...`），否则说明这条用例只写在纸上。

放在 `tests/cluster-storage/meta/` 是因为门禁要求 pytest 文件在
`tests/{module}/{sub}/` 下；它检查的是全仓库的 specs，不只这一个模块。

无浏览器，秒级完成，适合放进 CI 的文档门禁之后。
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

UI_ROOT = Path(__file__).resolve().parents[3]
SPEC_ROOT = UI_ROOT / "specs"
TESTS_ROOT = UI_ROOT / "tests"

SPEC_ID = re.compile(r"^TC-[A-Z0-9_-]+$")


def spec_ids() -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for path in sorted(SPEC_ROOT.rglob("TC-*.yaml")):
        spec = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        spec_id = str(spec.get("id") or path.stem)
        assert SPEC_ID.match(spec_id), f"{path}: 用例 id 不合规 {spec_id}"
        rows.append((spec_id, str(path.relative_to(UI_ROOT))))
    return rows


META = Path(__file__).resolve()


def collected_test_names() -> set[str]:
    """Every test function in the suite except this file's own checks."""
    names: set[str] = set()
    for path in TESTS_ROOT.rglob("test_*.py"):
        if path.resolve() == META:
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^def (test_[A-Za-z0-9_]+)\(", line)
            if match:
                names.add(match.group(1))
    return names


def test_every_spec_has_a_test() -> None:
    """每条用例规格都要有同名测试，防止「文档写了、代码没测」。"""
    names = collected_test_names()
    missing = [
        (spec_id, rel)
        for spec_id, rel in spec_ids()
        if f"test_{spec_id.replace('-', '_')}" not in names
    ]
    assert not missing, "以下用例规格没有对应的测试函数：" + ", ".join(
        f"{spec_id}（{rel}）" for spec_id, rel in missing
    )


def test_every_test_maps_to_a_spec() -> None:
    """反过来也要成立：测试函数名必须能对上一条规格，避免孤儿测试。"""
    known = {f"test_{spec_id.replace('-', '_')}" for spec_id, _ in spec_ids()}
    orphans = sorted(name for name in collected_test_names() if name not in known)
    assert not orphans, "以下测试没有对应的用例规格：" + ", ".join(orphans)


def test_spec_suites_match_markers() -> None:
    """spec 的 suite 与测试上的 marker 一致（core / full / point）。"""
    markers = {}
    for path in TESTS_ROOT.rglob("test_*.py"):
        lines = path.read_text(encoding="utf-8").splitlines()
        pending: str | None = None
        for line in lines:
            match = re.match(r"^@pytest\.mark\.(core|full|point|flow)$", line.strip())
            if match:
                pending = match.group(1)
                continue
            match = re.match(r"^def (test_[A-Za-z0-9_]+)\(", line)
            if match and pending:
                markers[match.group(1)] = pending
                pending = None

    mismatched = []
    for spec_id, rel in spec_ids():
        spec = yaml.safe_load((UI_ROOT / rel).read_text(encoding="utf-8")) or {}
        expected = spec.get("suite")
        name = f"test_{spec_id.replace('-', '_')}"
        # `flow` specs are marked full on purpose (they are journeys).
        actual = "full" if expected == "flow" else markers.get(name)
        if actual != expected and expected != "flow":
            mismatched.append(f"{spec_id}: spec={expected} test={actual}")
    assert not mismatched, "suite 与 marker 不一致：" + "; ".join(mismatched)
