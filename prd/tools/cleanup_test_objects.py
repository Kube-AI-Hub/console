#!/usr/bin/env python3
"""清理 E2E 留下的测试对象。

为什么需要它：用例都在 `finally` 里删自己创建的对象，但进程被中断、超时或 fixture 中途失败时
删不掉。跑了几百轮之后，`default` 里攒下几十个 `tc-e2e-*` / `pw*` 对象——列表变长、分页出现、
「第一行」不再是目标对象，于是**后续用例开始莫名失败**，看起来像产品坏了。

默认 dry-run，只打印；加 --apply 才真的删。

用法：
    python3 prd/tools/cleanup_test_objects.py                    # 看看有什么
    python3 prd/tools/cleanup_test_objects.py --apply             # 真的删
    python3 prd/tools/cleanup_test_objects.py --apply --namespace spaces
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

#: Prefixes the suite uses. Deliberately narrow: a delete tool that is clever about
#: guessing which objects "look like tests" eventually removes something real.
PREFIXES = ("tc-e2e-", "tc-create-", "pw")
RESOURCES = {
    "configmaps": "/api/v1",
    "secrets": "/api/v1",
    "serviceaccounts": "/api/v1",
    "persistentvolumeclaims": "/api/v1",
    "services": "/api/v1",
    "deployments": "/apis/apps/v1",
    "statefulsets": "/apis/apps/v1",
    "daemonsets": "/apis/apps/v1",
}


def login(app: str, user: str, password: str) -> str:
    request = urllib.request.Request(
        f"{app}/api/session/login",
        data=json.dumps({"username": user, "password": password}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
        return json.loads(response.read())["token"]


def call(app: str, token: str, path: str, method: str = "GET") -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{app}{path}",
        headers={"authorization": f"Bearer {token}"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as error:  # type: ignore[attr-defined]
        return error.code, {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", default=os.environ.get("KA_APP_URL", "http://localhost:5178"))
    parser.add_argument("--user", default=os.environ.get("KA_USERNAME", "admin"))
    parser.add_argument("--password", default=os.environ.get("KA_PASSWORD", ""))
    parser.add_argument("--namespace", default="default")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("需要口令：--password 或 KA_PASSWORD")

    token = login(args.app, args.user, args.password)
    total = 0
    for resource, prefix in RESOURCES.items():
        status, body = call(args.app, token, f"{prefix}/namespaces/{args.namespace}/{resource}?limit=-1")
        if status != 200:
            print(f"{resource}: 读取失败 {status}")
            continue
        doomed = [
            item["metadata"]["name"]
            for item in body.get("items", [])
            if item["metadata"]["name"].startswith(PREFIXES)
        ]
        if not doomed:
            continue
        print(f"{resource}: {len(doomed)} 个测试对象 {doomed[:4]}{' …' if len(doomed) > 4 else ''}")
        total += len(doomed)
        if args.apply:
            for name in doomed:
                call(args.app, token, f"{prefix}/namespaces/{args.namespace}/{resource}/{name}", "DELETE")

    if total == 0:
        print("没有测试残留。")
        return 0
    print(f"\n共 {total} 个" + ("，已删除。" if args.apply else "；加 --apply 才会真的删除。"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
