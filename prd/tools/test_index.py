"""用例规格与测试文件的对应关系。

规则（`docs/SDD.md` 第 2 节）：**一 spec 一测试文件，路径与文件名镜像**。

    specs/cluster-storage/shared-storage/TC-L3-...-QUOTA-01.yaml
    tests/cluster-storage/shared-storage/test_TC_L3_..._QUOTA_01.py

对应关系由路径决定，不靠命名约定去猜，所以 `find` 就能看出哪条 spec 没实现。

这里只做解析，判定在 `check_docs.py` 的 `check_test_binding`。
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import yaml

# 用例 ID 含下划线（SHARED_STORAGE），`\b` 会在下划线处截断，所以用显式边界。
TC_ID = re.compile(r"(?<![A-Za-z0-9_-])(TC-[A-Z0-9][A-Z0-9_-]*[A-Z0-9])")


def test_path_for(spec_path: Path, specs_root: Path, tests_root: Path) -> Path:
    """spec 的路径 → 期望的测试文件路径。

    目录整体镜像，文件名把连字符换成下划线并加 `test_` 前缀：

        specs/{module}/{sub}/TC-X-Y-01.yaml
        tests/{module}/{sub}/test_TC_X_Y_01.py
    """
    rel = spec_path.relative_to(specs_root)
    return tests_root / rel.parent / f"test_{spec_path.stem.replace('-', '_')}.py"


def spec_path_for(test_path: Path, specs_root: Path, tests_root: Path) -> Path:
    """测试文件路径 → 期望的 spec 路径（反向，用于抓孤儿文件）。

    反向不能靠字符串替换：正向把 `-` 换成 `_`，回推时分不清原来的 `_`（用例 ID
    里的 `SHARED_STORAGE`）和原来的 `-`。所以用正向表反查。
    """
    for tid, path in specs(specs_root).items():
        if test_path_for(path, specs_root, tests_root) == test_path:
            return path
    return specs_root / test_path.relative_to(tests_root).with_suffix(".yaml")


def load_spec(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def spec_id(path: Path) -> str:
    return str(load_spec(path).get("id") or path.stem)


def test_functions(path: Path) -> list[ast.FunctionDef]:
    """模块顶层的 `test_*` 函数。"""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name.startswith("test_")
    ]


def function_ids(node: ast.FunctionDef) -> list[str]:
    """函数 docstring 里出现的全部 TC ID。"""
    return TC_ID.findall(ast.get_docstring(node) or "")


def function_markers(node: ast.FunctionDef) -> set[str]:
    """函数上的 `@pytest.mark.<x>` 标记名。"""
    names: set[str] = set()
    for decorator in node.decorator_list:
        text = ast.unparse(decorator)
        match = re.match(r"^pytest\.mark\.([a-z_]+)$", text)
        if match:
            names.add(match.group(1))
    return names


def is_skipped(node: ast.FunctionDef) -> bool:
    """整个函数被 skip / xfail（装饰器里带 skip 或 xfail）。"""
    return any(
        token in ast.unparse(decorator)
        for decorator in node.decorator_list
        for token in ("skip", "xfail")
    )


def specs(specs_root: Path) -> dict[str, Path]:
    """spec id → 路径。"""
    return {spec_id(path): path for path in sorted(specs_root.rglob("TC-*.yaml"))}


def bindings(specs_root: Path, tests_root: Path) -> dict[str, list[tuple[Path, ast.FunctionDef]]]:
    """spec id → 绑定了它的 (测试文件, 函数)。

    绑定按路径：只有 `test_path_for(spec)` 这个文件里、docstring 首行带该 ID 的函数
    才算绑定。这样把 spec 搬到别的目录、或把测试写进错误的文件，都会被判定为未绑定。
    """
    out: dict[str, list[tuple[Path, ast.FunctionDef]]] = {}
    for tid, path in specs(specs_root).items():
        expected = test_path_for(path, specs_root, tests_root)
        if not expected.is_file():
            continue
        hits = [
            (expected, node)
            for node in test_functions(expected)
            if tid in function_ids(node)
        ]
        if hits:
            out[tid] = hits
    return out
