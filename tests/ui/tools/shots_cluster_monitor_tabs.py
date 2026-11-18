#!/usr/bin/env python3
"""Screenshots + measurements for the 集群监控 tab rework (task-9).

Run from console/tests/ui:  python3 tools/shots_cluster_monitor_tabs.py

Writes viewport screenshots and measurements.json under
artifacts/cluster-monitor-tabs/. Everything is measured in the real browser against
the local dev station (5178), so the numbers can be re-derived by re-running this
script; the old console's five tab baselines in /tmp/shots/old-tab-*.png were taken
2026-11-18 and are reused, not re-shot.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from playwright.sync_api import sync_playwright  # noqa: E402

from conftest import _app_token, _storage_state, app_base  # noqa: E402
from helpers.config import load_config  # noqa: E402

TABS = ("overview", "resource", "apiserver", "scheduler", "ranking")
WIDTHS = (1600, 1280, 1024)
OUT = Path(__file__).resolve().parent.parent / "artifacts" / "cluster-monitor-tabs"


def _wait_ready(page, timeout: float = 90.0) -> str:
    deadline = time.time() + timeout
    surface = page.locator('[data-ai-id="cluster-monitor:surface"]').last
    while time.time() < deadline:
        try:
            if surface.count() and surface.get_attribute("data-ai-state") not in (None, "loading"):
                return surface.get_attribute("data-ai-state") or "ready"
        except Exception:  # noqa: BLE001 - transient during reload
            pass
        page.wait_for_timeout(200)
    return "timeout"


def _box(locator) -> dict | None:
    if locator.count() == 0:
        return None
    try:
        box = locator.first.bounding_box()
    except Exception:  # noqa: BLE001
        return None
    if not box:
        return None
    return {key: round(value, 1) for key, value in box.items()}


def _visible_chart_count(page, tab: str) -> int:
    prefix = "cluster-monitor:resource:chart:" if tab == "resource" else f"cluster-monitor:{tab}:chart:"
    viewport_h = page.viewport_size["height"] if page.viewport_size else 900
    count = 0
    for element in page.locator(f'[data-ai-id^="{prefix}"]').all():
        ai_id = element.get_attribute("data-ai-id") or ""
        suffix = ai_id[len(prefix):]
        if tab != "resource" and ":" in suffix:
            continue
        if tab == "resource" and len(suffix.split(":")) != 2:
            continue
        if not element.is_visible():
            continue
        box = element.bounding_box()
        if box and box["y"] < viewport_h:
            count += 1
    return count


def _measure(page, cluster: str, tab: str, width: int) -> dict:
    tabs = []
    trigger_boxes = []
    for key in TABS:
        locator = page.locator(f'[data-ai-id="cluster-monitor:tab:{key}"]').last
        box = _box(locator)
        trigger_boxes.append(box)
        tabs.append({
            "key": key,
            "active": locator.get_attribute("data-state") == "active" if locator.count() else False,
            "box": box,
        })
    gaps = []
    for left, right in zip(trigger_boxes, trigger_boxes[1:]):
        if left and right:
            gaps.append(round(right["x"] - (left["x"] + left["width"]), 1))

    data: dict = {
        "cluster": cluster,
        "tab": tab,
        "viewport": {"width": width, "height": page.viewport_size["height"] if page.viewport_size else None},
        "surface_state": _wait_ready(page),
        "tabs": tabs,
        "tab_gaps": gaps,
        "active_tab": next((item["key"] for item in tabs if item["active"]), None),
        "visible_charts_first_screen": _visible_chart_count(page, tab),
        "horizontal_overflow": page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        ),
    }
    panel = {"overview": "overview", "resource": "resource", "apiserver": "apiserver",
             "scheduler": "scheduler", "ranking": "ranking"}[tab]
    ai = f'[data-ai-id="cluster-monitor:tabpanel:{panel}"]'
    data["panel_visible"] = page.locator(ai).last.is_visible() if page.locator(ai).count() else False

    if tab == "overview":
        blocks = {}
        for name, ai_id in (
            ("node_ring", "cluster-monitor:overview:node-ring"),
            ("vendor_donut", "cluster-monitor:overview:vendor-donut"),
            ("components", "cluster-monitor:status:components"),
        ):
            blocks[name] = _box(page.locator(f'[data-ai-id="{ai_id}"]').last)
        tops = [b["y"] for b in blocks.values() if b]
        heights = [b["height"] for b in blocks.values() if b]
        data["status_row"] = {
            "blocks": blocks,
            "top_spread": round(max(tops) - min(tops), 1) if tops else None,
            "height_spread": round(max(heights) - min(heights), 1) if heights else None,
        }
        list_box = _box(page.locator('[data-ai-id="cluster-monitor:overview:usage"]').last)
        chart_box = _box(page.locator('[data-ai-id="cluster-monitor:overview:usage-chart"]').last)
        data["usage"] = {
            "list_box": list_box,
            "chart_box": chart_box,
            "chart_to_list_width_ratio": round(chart_box["width"] / list_box["width"], 2) if list_box and chart_box and list_box["width"] else None,
            "row_count": len(page.locator('[data-ai-id^="cluster-monitor:overview:usage:"]').all()),
            "selected_aria_label": page.locator('[data-ai-id="cluster-monitor:overview:usage-chart"]').last.get_attribute("aria-label"),
            "donut_state": page.locator('[data-ai-id="cluster-monitor:overview:vendor-donut"]').last.get_attribute("data-ai-state"),
            "vendor_rows": page.locator('[data-ai-id^="cluster-monitor:overview:vendor:"]').count(),
            "rdma_state": page.locator('[data-ai-id="cluster-monitor:overview:rdma"]').last.get_attribute("data-ai-state"),
            "rdma_text": page.locator('[data-ai-id="cluster-monitor:overview:rdma"]').last.inner_text()[:200],
        }
    if tab == "resource":
        data["groups"] = [page.locator(f'[data-ai-id="cluster-monitor:resource:group:{g}"]').count() for g in ("gpu", "host", "disk", "network", "rdma")]
        data["group_titles"] = [
            page.locator(f'[data-ai-id="cluster-monitor:resource:group:{g}"]').last.locator(':scope > h2').first.inner_text()
            for g in ("gpu", "host", "disk", "network", "rdma")
        ]
        chart_ids = []
        for element in page.locator('[data-ai-id^="cluster-monitor:resource:chart:"]').all():
            ai_id = element.get_attribute("data-ai-id") or ""
            suffix = ai_id[len("cluster-monitor:resource:chart:"):]
            if len(suffix.split(":")) == 2:
                chart_ids.append(suffix)
        data["chart_ids"] = chart_ids
        data["empty_charts"] = page.locator('[data-ai-id$=":empty"]').count()
        data["legends"] = page.locator('[data-ai-id$=":legend"]').count()
    if tab in ("apiserver", "scheduler"):
        data["empty_charts"] = page.locator(f'[data-ai-id^="cluster-monitor:{tab}:chart:"][data-ai-id$=":empty"]').count()
    if tab == "ranking":
        data["rows"] = page.locator('[data-ai-id="cluster-monitor:ranking:surface"] [data-ai-row]').count()
        export = page.locator('[data-ai-id="cluster-monitor:ranking:export"]').last
        data["export_present"] = export.count() > 0
        data["export_disabled"] = export.is_disabled() if export.count() else None
    return data


def main() -> int:
    cfg = load_config()
    token = _app_token(cfg)
    base = app_base(cfg)
    OUT.mkdir(parents=True, exist_ok=True)
    measurements = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "app": base,
        "viewport_widths": list(WIDTHS),
        "old_page_baseline": "/tmp/shots/old-tab-{overview,resource,api-server,scheduler,ranking}.png (2026-11-18)",
        "runs": [],
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for cluster in ("host", "agent"):
            tabs = TABS if cluster == "host" else ("overview", "resource")
            for width in WIDTHS:
                context = browser.new_context(
                    viewport={"width": width, "height": 1000},
                    locale="zh-CN",
                    ignore_https_errors=True,
                    storage_state=_storage_state(base, token),
                )
                page = context.new_page()
                for tab in tabs:
                    url = f"{base}/kube-frontend/clusters/{cluster}/monitor"
                    if tab != "overview":
                        url += f"?tab={tab}"
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                        state = _wait_ready(page)
                        page.wait_for_timeout(1200)
                        path = OUT / f"{cluster}-{tab}-{width}.png"
                        page.screenshot(path=str(path), full_page=False)
                        record = _measure(page, cluster, tab, width)
                        record["screenshot"] = str(path)
                        measurements["runs"].append(record)
                        print(f"{cluster} {tab} {width}: state={state} charts={record['visible_charts_first_screen']} -> {path.name}")
                    except Exception as error:  # noqa: BLE001 - record, keep the batch going
                        measurements["runs"].append({"cluster": cluster, "tab": tab, "width": width, "error": str(error)[:300]})
                        print(f"{cluster} {tab} {width}: ERROR {error}")
                # deep link + narrow once per cluster/width set (host only)
                if cluster == "host" and width == 1600:
                    page.goto(f"{base}/kube-frontend/clusters/{cluster}/monitor?tab=resource", wait_until="domcontentloaded")
                    _wait_ready(page)
                    page.wait_for_timeout(1200)
                    deep = OUT / "host-resource-deeplink-1600.png"
                    page.screenshot(path=str(deep), full_page=False)
                    measurements["deeplink"] = {"url": page.url, "screenshot": str(deep), "active_tab": page.locator('[data-ai-id="cluster-monitor:tab:resource"]').last.get_attribute("data-state")}
                if cluster == "host" and width == 1024:
                    page.set_viewport_size({"width": 900, "height": 1200})
                    page.goto(f"{base}/kube-frontend/clusters/{cluster}/monitor", wait_until="domcontentloaded")
                    _wait_ready(page)
                    page.wait_for_timeout(1200)
                    narrow = OUT / "host-overview-narrow-900.png"
                    page.screenshot(path=str(narrow), full_page=False)
                    boxes = {name: _box(page.locator(f'[data-ai-id="{ai_id}"]').last) for name, ai_id in (
                        ("node_ring", "cluster-monitor:overview:node-ring"),
                        ("vendor_donut", "cluster-monitor:overview:vendor-donut"),
                        ("components", "cluster-monitor:status:components"),
                    )}
                    measurements["narrow_900"] = {
                        "screenshot": str(narrow),
                        "status_blocks": boxes,
                        "overflow": page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
                    }
                context.close()
        browser.close()
    (OUT / "measurements.json").write_text(json.dumps(measurements, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT / 'measurements.json'} ({len(measurements['runs'])} runs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
