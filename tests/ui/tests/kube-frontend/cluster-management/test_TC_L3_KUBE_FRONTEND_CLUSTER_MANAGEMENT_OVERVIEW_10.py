from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_10(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10 密集属性表与节点块铺满。"""
    ui = cluster_overview_page
    ui.open()
    ui.wait_ready()
    basic = ui.control("basic")
    status = ui.control("kubernetes-status")
    expect(basic).to_be_visible()
    expect(status).to_be_visible()
    # The definition list renders only once the cluster object has arrived; reading it
    # before that throws on a null node rather than failing an assertion.
    expect(basic.locator("dl")).to_be_visible()
    expect(status.locator("dl")).to_be_visible()

    # ---- 行式属性表：标签在左列、值在右列，字号与颜色都区分开 ----
    layout = basic.evaluate("""element => {
        const dl = element.querySelector('dl');
        const cells = [...dl.children];
        const style = (node) => getComputedStyle(node);
        const rows = [];
        for (let index = 0; index < cells.length; index += 2) {
            const dt = cells[index];
            const dd = cells[index + 1];
            const label = dt.getBoundingClientRect();
            const value = dd.getBoundingClientRect();
            rows.push({
                labelX: label.x,
                valueX: value.x,
                labelHeight: label.height,
                labelSize: parseFloat(style(dt).fontSize),
                valueSize: parseFloat(style(dd).fontSize),
                labelColor: style(dt).color,
                valueColor: style(dd).color,
                rule: style(dt).borderTopWidth,
                dtTop: dt.getBoundingClientRect().top,
                ddTop: dd.getBoundingClientRect().top,
            });
        }
        return { rows, columns: style(dl).gridTemplateColumns };
    }""")
    rows = layout["rows"]
    assert len(rows) == 9, f"基本信息应保留九个字段（含描述），实际 {len(rows)}"
    assert len(layout["columns"].split()) == 2, f"桌面端应为两列属性表：{layout['columns']}"
    # 标签必须是行里更大的那一半：读表时先按字段名找到行，再看右侧的值。
    assert min(row["labelSize"] for row in rows) > max(row["valueSize"] for row in rows)
    assert all(row["labelColor"] != row["valueColor"] for row in rows)
    # 标签列起点一致、值列起点一致，且标签只占一个行盒（换行会让行高翻倍）。
    assert max(row["labelX"] for row in rows) - min(row["labelX"] for row in rows) < 2
    assert max(row["valueX"] for row in rows) - min(row["valueX"] for row in rows) < 2
    lines = basic.evaluate("""element => [...element.querySelectorAll('dt')].map(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects().length;
    })""")
    assert max(lines) == 1, f"标签换行：每行行盒数 {lines}"
    # 分隔线必须贯穿标签列与值列：两半的上边界在同一 y，否则一行会断成两段。
    assert max(abs(row["dtTop"] - row["ddTop"]) for row in rows) < 1, "标签与值的分隔线不在同一高度"
    # 字段之间有 1px 分隔线，首行不加（否则与面板头部边框叠成双线）。
    assert rows[0]["rule"] in ("0px", "0")
    assert all(row["rule"] not in ("0px", "0") for row in rows[1:])

    # ---- Kubernetes 状态沿用同一套列，两个面板的值列对齐 ----
    status_layout = status.evaluate("""element => {
        const dl = element.querySelector('dl');
        const cells = [...dl.children];
        const first = cells[1].getBoundingClientRect();
        return { valueX: first.x, count: cells.length / 2, rule: getComputedStyle(cells[0]).borderTopWidth };
    }""")
    assert status_layout["count"] == 5
    assert abs(status_layout["valueX"] - rows[0]["valueX"]) < 2

    # ---- 节点块与排行头部等高，块内没有按钮 ----
    node = ui.control("node-summary")
    expect(node.get_by_role("link", name="查看全部节点")).to_have_attribute(
        "href", f"/kube-frontend/clusters/{ui.cluster}/nodes")
    expect(node.get_by_role("button")).to_have_count(0)
    headers = [node.locator("header").first.bounding_box(), ui.control("ranking").locator("header").first.bounding_box()]
    assert all(headers)
    assert abs(headers[0]["height"] - headers[1]["height"]) < 2, headers
    assert abs(headers[0]["y"] - headers[1]["y"]) < 2, headers

    # ---- 环图与数字组垂直居中，中间不留空白带；就绪率只出现一次 ----
    centring = node.evaluate("""element => {
        const body = element.querySelector('header').nextElementSibling;
        const block = element.querySelector('[data-ai-id="overview:usage-nodes"]');
        const ring = block.querySelector('.ai-metric-ring');
        const content = block.getBoundingClientRect();
        const circle = ring.getBoundingClientRect();
        const bodyBox = body.getBoundingClientRect();
        return {
            contentCentre: content.top + content.height / 2,
            ringCentre: circle.top + circle.height / 2,
            bodyCentre: bodyBox.top + bodyBox.height / 2,
            ratioNodes: block.querySelectorAll('[data-ai-field="ratio"]').length,
            ringText: ring.textContent.trim(),
        };
    }""")
    assert abs(centring["ringCentre"] - centring["bodyCentre"]) < 4, centring
    assert centring["ratioNodes"] == 1, "就绪率只能出现一次（环心）"
    assert "100%" in centring["ringText"] or "-" in centring["ringText"], centring

    # ---- 三档：标签不换行、无横向溢出 ----
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        wrapped = basic.evaluate("""element => [...element.querySelectorAll('dt')].filter(node => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return range.getClientRects().length > 1;
        }).length""")
        assert wrapped == 0, f"{width} 下标签换行 {wrapped} 处"
        assert abs(ui.control("basic").bounding_box()["width"] - ui.control("node-summary").bounding_box()["width"]) < 2
        screenshot(ui.page, f"overview-dense-{width}")

    # ---- 深浅主题下标签与值仍可区分 ----
    for theme in ("light", "dark"):
        ui.page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")
        colours = basic.evaluate("""element => {
            const dt = element.querySelector('dt');
            const dd = element.querySelector('dd');
            return { label: getComputedStyle(dt).color, value: getComputedStyle(dd).color };
        }""")
        assert colours["label"] != colours["value"], f"{theme} 主题下标签与值同色"
        screenshot(ui.page, f"overview-dense-{theme}")
    ui.page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
