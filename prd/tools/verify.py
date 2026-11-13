#!/usr/bin/env python3
"""一轮迁移收尾要跑的检查，一条命令跑完。

为什么需要它：收尾要跑文档门禁、一致性核对、架构契约、各包单测、E2E。分五次手敲的结果是
经常漏跑一项，而漏掉的那项往往正是下一轮返工的原因（例如改了共享组件却没跑契约）。
这个脚本把顺序固定下来，任一环节失败立刻停止并指出该看什么。

用法：
    python3 prd/tools/verify.py               # 全套（E2E 用 4 个 worker）
    python3 prd/tools/verify.py --no-e2e      # 只跑静态与单测，约 30 秒
    python3 prd/tools/verify.py --serial-e2e  # E2E 串行（提交前的权威判定）
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
KF = REPO / "kube-frontend"


def run(label: str, cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> float:
    print(f"\n=== {label} ===", flush=True)
    started = time.time()
    result = subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, check=False)
    elapsed = time.time() - started
    if result.returncode != 0:
        print(f"\n失败：{label}（{elapsed:.1f}s）", file=sys.stderr)
        print("先修这一项再继续——后续检查建立在它通过之上。", file=sys.stderr)
        raise SystemExit(result.returncode)
    print(f"通过：{label}（{elapsed:.1f}s）", flush=True)
    return elapsed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-e2e", action="store_true")
    parser.add_argument("--serial-e2e", action="store_true")
    args = parser.parse_args()

    total = 0.0
    # Leftover test objects are reported before anything else runs, and nothing is
    # deleted here: a stale fixture object makes later cases fail for no product reason,
    # but an automatic cleanup mid-run would delete objects belonging to cases that are
    # running in parallel against the same cluster.
    leftovers = subprocess.run(
        [sys.executable, "prd/tools/cleanup_test_objects.py"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if leftovers.returncode == 0 and "0 个" not in leftovers.stdout:
        print("\n=== 测试残留（只报告，不删除）===", flush=True)
        print(leftovers.stdout.strip())
        print("确认无人并行使用时：python3 prd/tools/cleanup_test_objects.py --apply")

    total += run("文档门禁", [sys.executable, "prd/tools/check_docs.py", "--strict"], REPO)
    total += run("一致性核对", [sys.executable, "prd/tools/parity_check.py"], REPO)
    # Advisory: prints suspicious assertions but does not fail the run. Retry loops are
    # legitimate and would otherwise trip it.
    print("\n=== 弱断言提示（不阻断） ===", flush=True)
    subprocess.run([sys.executable, "prd/tools/check_weak_assertions.py"], cwd=REPO, check=False)
    total += run("架构契约", [npx(), "vitest", "run", "--config", "config/vitest.config.ts"], KF)
    total += run("api-client 单测", [npx(), "vitest", "run"], KF / "packages/api-client")
    # ai-kit lives at the repository root, not under kube-frontend/.
    total += run("ai-kit 单测", [npx(), "vitest", "run"], REPO / "packages/ai-kit")
    total += run("console-next 单测", [npx(), "vitest", "run"], KF / "apps/console-next")

    if args.no_e2e:
        print(f"\n静态与单测全部通过，合计 {total:.0f}s（未跑 E2E）")
        return 0

    # E2E needs the dev server; say so rather than failing with a connection error.
    app_url = os.environ.get("KA_APP_URL", "http://localhost:5178")
    print(f"\n=== E2E（{app_url}）===", flush=True)
    cmd = [sys.executable, "-m", "pytest", "tests/kube-frontend", "-m", "ui", "-q", "-p", "no:cacheprovider"]
    if not args.serial_e2e:
        cmd += ["-n", "4"]
    total += run("E2E", cmd, REPO / "tests/ui", {"KA_APP_URL": app_url})
    print(f"\n全部通过，合计 {total:.0f}s")
    return 0


def npx() -> str:
    return "npx"


if __name__ == "__main__":
    raise SystemExit(main())
