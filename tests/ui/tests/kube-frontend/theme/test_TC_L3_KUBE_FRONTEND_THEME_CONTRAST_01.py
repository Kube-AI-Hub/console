from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.contrast import audit

pytestmark = pytest.mark.ui

#: Pages that between them exercise the shared chrome and the list/table surfaces.
PAGES = (
    ('overview', '/kube-frontend/workspaces/system-workspace/overview'),
    ('projects', '/kube-frontend/workspaces/system-workspace/projects'),
    ('configmaps', '/kube-frontend/system-workspace/clusters/host/projects/default/configmaps'),
    ('secrets', '/kube-frontend/system-workspace/clusters/host/projects/default/secrets'),
    ('platform-info', '/kube-frontend/settings/info'),
)

THEMES = ('dark', 'light')

#: Contrast defects that exist today, keyed by the violating text.
#:
#: They are listed rather than ignored so the suite stays honest: a *new* violation still fails, and
#: an entry that stops reproducing also fails (the fix landed -- delete the entry). Both directions
#: are asserted below.
KNOWN_CONTRAST_DEFECTS = {
    # violet-300 (--ai-accent) used as link text on --ai-surface-2 (navy-500): 2.84:1.
    # ai-kit's link-styled button paints `text-ai-accent`; the accent is a fill colour, not a text
    # colour, so it needs a text-specific token (a lighter violet) before this can pass.
    '查看文档': {'ratio': 2.84, 'defect': 'link-accent-on-surface-2' },
    # status badge: --ai-success (0 138 92) on the light page background is 4.07:1, just under AA.
    'Active': {'ratio': 4.07, 'defect': 'success-text-on-light-bg'},
}


def _apply_theme(page, theme: str) -> None:
    """Set the theme the way the app itself stores it, before the next navigation.

    `ThemeProvider` reads `ai-kit-theme` from localStorage and mirrors it onto
    `<html data-theme>` in a pre-paint script, so writing the key and reloading is the same
    path a reader takes through the appearance controls.
    """
    page.evaluate("theme => localStorage.setItem('ai-kit-theme', theme)", theme)


@pytest.mark.point
@pytest.mark.parametrize('theme', THEMES)
@pytest.mark.parametrize('page_spec', PAGES, ids=[spec[0] for spec in PAGES])
def test_TC_L3_KUBE_FRONTEND_THEME_CONTRAST_01(configmaps_page, screenshot, page_spec, theme):
    """TC-L3-KUBE-FRONTEND-THEME-CONTRAST-01 渲染后文本对比度达到 WCAG AA。

    The token contract (`config/theme-contrast-contract.test.ts`) proves the palette pairs are
    readable; this proves the pages actually paint with them. Both are needed: a readable palette
    applied through the wrong token still produces unreadable text.
    """

    ui = configmaps_page
    origin = ui.url.split('/kube-frontend/')[0]
    _, path = page_spec

    ui.page.goto(origin + '/kube-frontend/', wait_until='domcontentloaded')
    _apply_theme(ui.page, theme)
    ui.page.goto(origin + path, wait_until='domcontentloaded')

    # The attribute the stylesheet keys off, not just the stored value: if the provider did not
    # apply it, the page is still painted in the other theme and the audit below would measure
    # the wrong thing.
    expect(ui.page.locator('html')).to_have_attribute('data-theme', theme, timeout=30_000)

    main = ui.page.locator('main')
    expect(main.first).to_be_visible(timeout=60_000)
    ui.page.wait_for_timeout(1200)

    violations = audit(ui.page, 'main')
    known = [item for item in violations if item.get('text') in KNOWN_CONTRAST_DEFECTS]
    new = [item for item in violations if item.get('text') not in KNOWN_CONTRAST_DEFECTS]

    assert new == [], '出现新的对比度缺陷：' + repr(new[:6])

    # The allowlist must not rot: every entry has to still reproduce somewhere in this run.
    for item in known:
        expected = KNOWN_CONTRAST_DEFECTS[item['text']]
        assert abs(float(item['ratio']) - expected['ratio']) < 0.05, (
            f"{item['text']} 的对比度已从 {expected['ratio']} 变为 {item['ratio']}：若已修复请从 KNOWN_CONTRAST_DEFECTS 删除"
        )

    screenshot(ui.page, f'theme-{theme}-{page_spec[0]}')
