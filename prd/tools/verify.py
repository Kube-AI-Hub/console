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


E2E_REPORT = Path('/tmp/verify-e2e.xml')


def preflight(app_url: str) -> None:
    """Fail fast when the dev stack cannot sign in, with the command that fixes it.

    The stack depends on an SSH tunnel to the cluster (`ssh -N -L 18088:...`). When it drops,
    the BFF answers every login with 502 and pytest reports one error per case — 174 lines that
    all say the same thing and none of which point at the tunnel. One probe here turns that
    into a single diagnosis.
    """
    import json
    import urllib.error
    import urllib.request

    env_file = REPO / 'tests/ui/.env'
    credentials: dict[str, str] = {'username': 'ui-test', 'password': 'UiTest@2026'}
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            key, _, value = line.partition('=')
            # The suite signs in as KA_LOGIN_USERNAME/KA_LOGIN_PASSWORD; KA_USERNAME/
            # KA_PASSWORD belong to the legacy login flow and are not what the BFF accepts.
            if key.strip() == 'KA_LOGIN_USERNAME':
                credentials['username'] = value.strip()
            if key.strip() == 'KA_LOGIN_PASSWORD':
                credentials['password'] = value.strip()

    request = urllib.request.Request(
        f'{app_url.rstrip("/")}/api/session/login',
        data=json.dumps(credentials).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            session = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, OSError, ValueError) as error:
        print('\n环境不可用：无法通过 BFF 登录，E2E 未开始。', file=sys.stderr)
        print(f'  登录端点：{app_url}/api/session/login', file=sys.stderr)
        print(f'  错误：{error}', file=sys.stderr)
        print('  排查顺序：', file=sys.stderr)
        print('    1) 隧道是否在：ssh -N -L 18088:172.16.10.20:30880 sgb000', file=sys.stderr)
        print('    2) BFF 是否在：BFF_PORT=8092 KS_API_URL=http://127.0.0.1:18088 tsx src/dev.ts', file=sys.stderr)
        print('    3) 上游是否通：curl http://127.0.0.1:18088/kapis/version', file=sys.stderr)
        raise SystemExit(3) from error
    if not session.get('token'):
        print('\n环境不可用：登录成功但没有返回 token，E2E 未开始。', file=sys.stderr)
        raise SystemExit(3)


def failing_node_ids(report: Path) -> list[str]:
    """The node ids of failed cases, from pytest's JUnit report."""
    import xml.etree.ElementTree as ET

    if not report.exists():
        return []
    ids: list[str] = []
    try:
        root = ET.parse(report).getroot()
    except ET.ParseError:
        return []
    for case in root.iter('testcase'):
        if case.find('failure') is None and case.find('error') is None:
            continue
        classname = case.get('classname') or ''
        name = case.get('name') or ''
        if not classname or not name:
            continue
        ids.append(f"{classname.replace('.', '/')}.py::{name}")
    return ids


def run_e2e(app_url: str, parallel: bool) -> float:
    """Run the E2E suite; retry failures once, serially.

    Measured over many rounds: a full parallel run against one cluster occasionally
    times out on one or two list pages that pass in ~3s when run alone — contention from
    4 workers plus the static server, not a product failure. Failing the whole gate on
    that is how a real regression gets ignored next time, so a failed case is rerun on
    its own. Anything that fails twice still fails the gate, and the retried cases are
    printed so a genuinely flaky test stays visible instead of being papered over.
    """
    preflight(app_url)
    started = time.time()
    cmd = [
        sys.executable,
        '-m', 'pytest',
        'tests/kube-frontend',
        '-m', 'ui',
        '-q',
        '-p', 'no:cacheprovider',
        f'--junitxml={E2E_REPORT}',
    ]
    if parallel:
        cmd += ['-n', '4']
    if E2E_REPORT.exists():
        E2E_REPORT.unlink()
    print(f"\n=== E2E（{app_url}）===", flush=True)
    result = subprocess.run(cmd, cwd=REPO / 'tests/ui', env={**os.environ, 'KA_APP_URL': app_url}, check=False)
    if result.returncode == 0:
        print(f"通过：E2E（{time.time() - started:.1f}s）", flush=True)
        return time.time() - started

    failed = failing_node_ids(E2E_REPORT)
    if not failed:
        print('\n失败：E2E（无报告可重试）', file=sys.stderr)
        raise SystemExit(result.returncode)

    print(f"\n{len(failed)} 条失败，串行重跑以区分「并发抖动」与「真回归」：", flush=True)
    for node in failed:
        print(f'  - {node}', flush=True)
    retry = subprocess.run(
        [sys.executable, '-m', 'pytest', *failed, '-m', 'ui', '-q', '-p', 'no:cacheprovider'],
        cwd=REPO / 'tests/ui',
        env={**os.environ, 'KA_APP_URL': app_url},
        check=False,
    )
    elapsed = time.time() - started
    if retry.returncode != 0:
        print(f'\n失败：E2E（{elapsed:.1f}s，重跑后仍失败）', file=sys.stderr)
        print('先修这一项再继续——后续检查建立在它通过之上。', file=sys.stderr)
        raise SystemExit(retry.returncode)
    print(f"通过：E2E（{elapsed:.1f}s，其中 {len(failed)} 条为并发抖动，单独重跑通过）", flush=True)
    return elapsed


def _self_test_failing_node_ids() -> None:
    """Sanity check for the JUnit parser: one failure, one error, one pass."""
    import tempfile

    xml = """<testsuites><testsuite>
  <testcase classname="tests.kube-frontend.access-control.test_a" name="test_a[chromium]">
    <failure message="boom">trace</failure>
  </testcase>
  <testcase classname="tests.kube-frontend.app-workloads.test_b" name="test_b[chromium]">
    <error message="timeout">trace</error>
  </testcase>
  <testcase classname="tests.kube-frontend.theme.test_c" name="test_c[chromium]" />
</testsuite></testsuites>"""
    with tempfile.NamedTemporaryFile('w', suffix='.xml', delete=False) as handle:
        handle.write(xml)
        path = Path(handle.name)
    ids = failing_node_ids(path)
    path.unlink()
    assert ids == [
        'tests/kube-frontend/access-control/test_a.py::test_a[chromium]',
        'tests/kube-frontend/app-workloads/test_b.py::test_b[chromium]',
    ], ids


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
    # 缺口清单：老 console 的每个 URL 段都必须有归宿（已迁移/明确不做/别处承接/已登记缺口）。
    # 一致性核对按一级目录名匹配，分组目录下的兄弟页面会整块隐身——见计划 §57。
    total += run("缺口清单", [sys.executable, "prd/tools/gap_check.py", "--strict"], REPO)
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
    total += run_e2e(app_url, parallel=not args.serial_e2e)
    print(f"\n全部通过，合计 {total:.0f}s")
    return 0


def npx() -> str:
    return "npx"


if __name__ == "__main__":
    raise SystemExit(main())
