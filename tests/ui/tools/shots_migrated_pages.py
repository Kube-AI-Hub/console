#!/usr/bin/env python3
"""Screenshots + checks for the migrated pages at the breakpoints and themes the
per-page records kept listing as "未验收".

Run from console/tests/ui:  python3 tools/shots_migrated_pages.py [--app URL]

For every page it captures 1024/1600 in dark and light (zh) and 1280 in English, and
asserts three things that a screenshot alone would not catch:

  * no page-level horizontal overflow (the table scrolls inside its own container),
  * the surface is not in the error state,
  * no raw i18n key is rendered as text.

Outputs artifacts/migrated-pages/*.png and measurements.json.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from playwright.sync_api import sync_playwright  # noqa: E402

from conftest import _app_token, _storage_state, app_base  # noqa: E402
from helpers.config import load_config  # noqa: E402

PAGES = (
    ("project-deployments", "/kube-frontend/system-workspace/clusters/host/projects/default/deployments", "deployments:surface"),
    ("project-configmaps", "/kube-frontend/system-workspace/clusters/host/projects/default/configmaps", "configmaps:surface"),
    ("project-secrets", "/kube-frontend/system-workspace/clusters/host/projects/default/secrets", "secrets:surface"),
    ("project-networkpolicies", "/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies", "networkpolicies:surface"),
    ("project-gateway", "/kube-frontend/system-workspace/clusters/host/projects/default/gateways", "gateway:surface"),
    ("project-pvc", "/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims", "persistentvolumeclaims:surface"),
    ("cluster-workloads", "/kube-frontend/clusters/host/deployments", "cluster-deployments:surface"),
    ("cluster-configmaps", "/kube-frontend/clusters/host/configmaps", "cluster-configmaps:surface"),
    ("cluster-serviceaccounts", "/kube-frontend/clusters/host/serviceaccounts", "cluster-serviceaccounts:surface"),
    ("cluster-nodes", "/kube-frontend/clusters/host/nodes", "nodes:surface"),
)

#: (label, width, theme, locale)
RUNS = (
    ("dark-1024", 1024, "dark", "zh"),
    ("dark-1600", 1600, "dark", "zh"),
    ("light-1024", 1024, "light", "zh"),
    ("light-1600", 1600, "light", "zh"),
    ("en-1280", 1280, "dark", "en"),
)

RAW_KEY = re.compile(r"^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+){1,4}$")

#: Client enums that must never appear as a whole line on a Chinese page. The key pattern above
#: cannot see them (no dots), and looking only at screenshots is how `stopped`/`updating` were
#: found on the cluster workload list — this list turns that observation into a check.
RAW_ENUMS = {
    "running", "stopped", "updating", "terminating", "waiting", "completed", "error",
    "failed", "pending", "succeeded", "unknown", "bound", "available", "released",
}

OUT = Path(__file__).resolve().parent.parent / "artifacts" / "migrated-pages"


def _wait_ready(page, ai_id: str, timeout: float = 90.0) -> str:
    deadline = time.time() + timeout
    surface = page.locator(f'[data-ai-id="{ai_id}"]').last
    while time.time() < deadline:
        try:
            if surface.count() and surface.get_attribute("data-ai-state") not in (None, "loading"):
                return surface.get_attribute("data-ai-state") or "ready"
        except Exception:  # noqa: BLE001 - transient while the page renders
            pass
        page.wait_for_timeout(200)
    return "timeout"


def _raw_keys(page, locale: str) -> list[str]:
    text = page.evaluate("() => document.body.innerText")
    found = []
    for line in text.splitlines():
        value = line.strip()
        if not value:
            continue
        if RAW_KEY.match(value) and not value.endswith("."):
            found.append(value)
        elif locale == "zh" and value.lower() in RAW_ENUMS:
            found.append(value)
    return found[:5]


def main() -> int:
    cfg = load_config()
    token = _app_token(cfg)
    base = app_base(cfg)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "app": base, "runs": []}
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for label, width, theme, locale in RUNS:
            state = _storage_state(base, token)
            state["origins"][0]["localStorage"] += [
                {"name": "ai-kit-theme", "value": theme},
                {"name": "kube-frontend-locale", "value": locale},
            ]
            context = browser.new_context(
                viewport={"width": width, "height": 1000},
                locale="zh-CN" if locale == "zh" else "en-US",
                ignore_https_errors=True,
                storage_state=state,
            )
            page = context.new_page()
            for name, path, surface_id in PAGES:
                try:
                    page.goto(f"{base}{path}", wait_until="domcontentloaded", timeout=60_000)
                    surface_state = _wait_ready(page, surface_id)
                    page.wait_for_timeout(900)
                    shot = OUT / f"{name}-{label}.png"
                    page.screenshot(path=str(shot), full_page=False)
                    overflow = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
                    raw = _raw_keys(page, locale)
                    record = {
                        "page": name, "run": label, "width": width, "theme": theme, "locale": locale,
                        "state": surface_state, "overflow_px": overflow, "raw_keys": raw,
                        "screenshot": str(shot.relative_to(OUT.parent)),
                    }
                    if surface_state not in ("ready", "empty"):
                        failures.append(f"{name} {label}: state={surface_state}")
                    if overflow > 1:
                        failures.append(f"{name} {label}: 页面横向溢出 {overflow}px")
                    if raw:
                        failures.append(f"{name} {label}: 渲染了原始文案键 {raw}")
                    report["runs"].append(record)
                    print(f"{name:24s} {label:10s} state={surface_state:6s} overflow={overflow:>3} raw={len(raw)}")
                except Exception as error:  # noqa: BLE001 - report and continue with the next page
                    failures.append(f"{name} {label}: {type(error).__name__}: {error}")
                    print(f"{name:24s} {label:10s} FAILED {error}")
            context.close()
        browser.close()
    (OUT / "measurements.json").write_text(json.dumps({**report, "failures": failures}, ensure_ascii=False, indent=1))
    print(f"\n{len(report['runs'])} runs, {len(failures)} problems -> {OUT / 'measurements.json'}")
    for line in failures:
        print(f"  - {line}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
