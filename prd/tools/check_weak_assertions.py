#!/usr/bin/env python3
"""找出「看起来在验证，其实什么都没验」的用例。

为什么需要它：迁移中至少有四处断言永远不会失败，因此长期给绿灯，直到某次重构后行为变了才暴露：

  assert "8 位" in dialog.inner_text()     # «至少 8 位…» 是密码字段的静态提示，始终在屏上
  assert "小写字母" in dialog.inner_text()  # 同理，是名称字段的提示
  assert "数量" in dialog.inner_text()      # 是字段标签
  expect(dialog).to_be_visible()           # 对话框一直可见，什么都不说明

三类可机械识别：
  1. 提交后 sleep，再断言一段「提交前就已存在」的文案 → 读回数据或断言对话框状态才对
  2. 固定 sleep 后立即断言 → 应改成等待条件（expect 会轮询）
  3. 只断言元素可见就当作功能验证

用法：
    python3 prd/tools/check_weak_assertions.py            # 打印
    python3 prd/tools/check_weak_assertions.py --strict    # 有发现即失败
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TESTS = REPO / "tests/ui/tests"

#: A fixed sleep followed within two lines by an assertion. Playwright's `expect` polls;
#: a sleep does not, so the assertion reads whatever happened to be painted.
SLEEP_THEN_ASSERT = re.compile(
    r"wait_for_timeout\(\s*([0-9_]+)\s*\)\n(?:\s*\n)?(?:\s*(?:#.*)?\n)*\s*(assert |expect\()"
)

#: Asserting that a piece of text is somewhere in a dialog right after submitting. Whether
#: it is an error or a permanent hint cannot be told from the test — only a human can, but
#: this pattern is where all four vacuous assertions lived.
TEXT_IN_DIALOG = re.compile(r'assert\s+"([^"]+)"\s+in\s+dialog\.inner_text\(\)')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    findings: list[str] = []
    for path in sorted(TESTS.rglob("test_*.py")):
        text = path.read_text(encoding="utf-8")
        rel = path.relative_to(REPO)
        for match in SLEEP_THEN_ASSERT.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(f"{rel}:{line} 固定 sleep({match.group(1)}ms) 后紧接断言 — 改成等待条件")
        for match in TEXT_IN_DIALOG.finditer(text):
            line = text[: match.start()].count("\n") + 1
            findings.append(
                f"{rel}:{line} 断言文案 {match.group(1)!r} 在对话框里 — 确认它不是静态提示；"
                "更稳的是断言对话框仍开着 + 读回数据"
            )

    if not findings:
        print("没有发现弱断言。")
        return 0
    print(f"发现 {len(findings)} 处可疑断言：\n")
    for finding in findings:
        print(f"  - {finding}")
    print(
        "\n说明：这些不是必然错误，但每一处都值得看一眼——"
        "静态提示、始终可见的元素都会让断言永远为真。"
    )
    return 1 if args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
