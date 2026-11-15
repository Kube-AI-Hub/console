from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

GLOBAL_RULES = '/kapis/alerting.kubesphere.io/v2beta1/globalrulegroups'


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_09(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-09 策略详情：规则搜索与分页。"""

    ui = monitoring_page
    assert ui.api is not None

    status, body = ui.api.request('GET', f'{GLOBAL_RULES}?limit=-1')
    groups = (body or {}).get('items') or [] if status == 200 else []
    candidate = None
    for group in groups:
        rules = ((group.get('spec') or {}).get('rules') or [])
        if len(rules) > 10:
            candidate = (group.get('metadata', {}).get('name'), len(rules), rules)
            break
    if candidate is None:
        pytest.skip('集群没有规则数超过 10 的规则组，分页无法验证')
    name, total, rules = candidate

    ui.page.goto(
        f"{ui.base_url.rstrip('/')}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/alertingrules/{name}?scope=global",
        wait_until='domcontentloaded',
    )
    table = ui.page.locator('[data-ai-id="alertingrules:detail:rule-table"]')
    expect(table).to_be_visible(timeout=60_000)
    rows = table.locator('tbody tr')
    expect(rows).to_have_count(10, timeout=30_000)

    pager = ui.page.locator('[data-ai-id="alertingrules:detail:rule-pager"]')
    expect(pager).to_be_visible(timeout=20_000)
    first_range = ui.page.locator('[data-ai-id="alertingrules:detail:rule-range"]').inner_text()
    assert '1-10' in first_range and str(total) in first_range, first_range

    ui.page.locator('[data-ai-id="alertingrules:detail:rule-next"]').click()
    ui.page.wait_for_timeout(800)
    second_range = ui.page.locator('[data-ai-id="alertingrules:detail:rule-range"]').inner_text()
    assert second_range != first_range, second_range
    assert rows.count() <= 10

    # Search: use a needle that exists in this group, taken from its own rule names.
    rule_names = [str((rule.get('alert') or rule.get('name') or '')) for rule in rules]
    needle = next((item[:6] for item in rule_names if item), '')
    assert needle, rule_names[:3]
    box = ui.page.locator('input[data-ai-id="alertingrules:detail:rule-search"]').first
    box.fill(needle)
    ui.page.wait_for_timeout(1200)
    matched = rows.count()
    assert matched <= total, (matched, total)
    for index in range(matched):
        assert needle.lower() in rows.nth(index).inner_text().lower(), rows.nth(index).inner_text()[:80]

    box.fill('zzz-no-such-rule-xyz')
    ui.page.wait_for_timeout(1200)
    expect(ui.page.locator('[data-ai-id="alertingrules:detail:no-rule-match"]')).to_be_visible(timeout=20_000)
    assert table.count() == 0

    screenshot(ui.page, 'rule-search-paging')

