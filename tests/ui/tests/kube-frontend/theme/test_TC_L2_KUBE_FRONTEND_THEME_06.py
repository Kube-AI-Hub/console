from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CONFIGMAPS = '/kube-frontend/system-workspace/clusters/host/projects/default/configmaps'

STYLE_JS = """() => {
  const btn = document.querySelector('[data-ai-id="configmaps:bulk-delete"]');
  if (!btn) return null;
  const s = getComputedStyle(btn);
  return { disabled: btn.disabled, bg: s.backgroundColor, color: s.color, opacity: s.opacity };
}"""


def _rgb(value: str) -> tuple[int, int, int]:
    parts = value.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',')
    return tuple(int(float(p.strip())) for p in parts[:3])  # type: ignore[return-value]


def _luminance(value: str) -> float:
    r, g, b = _rgb(value)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


@pytest.mark.point
def test_TC_L2_KUBE_FRONTEND_THEME_06(configmaps_page, screenshot):
    """TC-L2-KUBE-FRONTEND-THEME-06 浅色主题与第二色调下的禁用态可读性。"""

    ui = configmaps_page
    base = ui.url.split('/configmaps')[0]

    # localStorage is only reachable once the page has an origin: navigate first, then write,
    # then reload so the bootstrap script picks the stored values up before first paint.
    ui.page.goto(base + '/configmaps', wait_until='domcontentloaded')
    ui.page.wait_for_timeout(1500)

    def apply(mode: str, accent: str) -> None:
        ui.page.evaluate(
            "([m, a]) => { localStorage.setItem('ai-kit-theme', m); localStorage.setItem('ai-kit-accent', a); }",
            [mode, accent],
        )
        ui.page.goto(base + '/configmaps', wait_until='domcontentloaded')
        ui.page.wait_for_timeout(2500)

    # Light + violet
    apply('light', 'violet')
    attrs = ui.page.evaluate("() => [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-accent')]")
    assert attrs == ['light', 'violet'], attrs
    body_bg = ui.page.evaluate('() => getComputedStyle(document.body).backgroundColor')
    assert _luminance(body_bg) > 0.9, f'浅色页面背景不够亮：{body_bg}'

    style = ui.page.evaluate(STYLE_JS)
    assert style is not None, '找不到批量删除按钮'
    assert style['disabled'] is True, style
    assert float(style['opacity']) == 1.0, f'禁用态不应靠透明度衰减：{style}'
    bg = _rgb(style['bg'])
    assert not (bg[0] > 120 and bg[1] < 90 and bg[2] < 90), f'禁用态仍是实心 danger 色：{style}'
    assert _luminance(style['bg']) > 0.8, f'禁用态应是中性表面：{style}'

    screenshot(ui.page, 'theme-light-violet')

    # Light + green accent
    apply('light', 'green')
    attrs = ui.page.evaluate("() => [document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-accent')]")
    assert attrs == ['light', 'green'], attrs
    green_bg = ui.page.evaluate('() => getComputedStyle(document.body).backgroundColor')
    assert _luminance(green_bg) > 0.9, green_bg
    assert green_bg != body_bg, '第二色调下背景应与 violet 不同'
    overflow = ui.page.evaluate('() => document.documentElement.scrollWidth - window.innerWidth')
    assert overflow <= 0, f'浅色 + 绿色调出现横向溢出：{overflow}px'

    screenshot(ui.page, 'theme-light-green')

    # Dark: same inert styling, no filled danger.
    apply('dark', 'violet')
    dark_style = ui.page.evaluate(STYLE_JS)
    assert dark_style is not None
    assert float(dark_style['opacity']) == 1.0, dark_style
    dark_bg = _rgb(dark_style['bg'])
    assert not (dark_bg[0] > 120 and dark_bg[1] < 90 and dark_bg[2] < 90), f'深色禁用态仍是实心 danger：{dark_style}'

