#!/usr/bin/env python3
"""Scan every console page for untranslated text.

Loads each page in the browser (zh), then reports text that is either a locale key
(\`a.b.c\`) or a raw client enum, in three places a reader looks at: attribute labels
(\`dt\`), column headers (\`th\`) and any element carrying a data-ai-id.

Usage (from console/tests/ui):
    KA_APP_URL=http://127.0.0.1:5180 python3 tools/i18n_scan.py [--limit N]
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from playwright.sync_api import sync_playwright  # noqa: E402

from conftest import _app_token, _storage_state  # noqa: E402
from helpers.config import load_config  # noqa: E402

ROOT = Path('/Users/yuan/code/kube-ai-hub/console/kube-frontend')
REGISTRY = ROOT / 'apps/console-next/src/areas/registry.ts'
OUT = Path(__file__).resolve().parent.parent / 'artifacts' / 'i18n-scan'

KEY_RE = re.compile(r'^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+){1,5}$')
RAW_ENUMS = {'running', 'waiting', 'completed', 'error', 'failed', 'pending', 'unknown', 'bound', 'updating', 'stopped', 'terminating'}


def _dictionary_keys() -> set[str]:
    text = (ROOT / 'packages/locales/src/index.ts').read_text()
    return set(re.findall(r"^  '([^']+)':", text, re.M))


def _urls() -> list[tuple[str, str]]:
    """(scope, url path) for every page the registry declares."""
    text = REGISTRY.read_text()
    scope_roots = {
        'workspace': '/kube-frontend/system-workspace',
        'project': '/kube-frontend/system-workspace/clusters/host/projects/default',
        'cluster': '/kube-frontend/clusters/host',
        'platform': '/kube-frontend',
    }
    # Each section starts with "scope: 'x'"; pages inside it carry a path.
    out: list[tuple[str, str]] = []
    scope = None
    for line in text.splitlines():
        m = re.search(r"scope:\s*'(project|cluster|platform|workspace)'", line)
        if m:
            scope = m.group(1)
            continue
        m = re.search(r"\{\s*key: '([^']+)',\s*path: '([^']+)'", line)
        if m and scope:
            path = m.group(2)
            if '$' in path:
                continue
            out.append((scope, f"{scope_roots[scope]}/{path}"))
    return out


def main() -> int:
    limit = None
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    locale = 'zh'
    if '--locale' in sys.argv:
        locale = sys.argv[sys.argv.index('--locale') + 1]
    cfg = load_config()
    token = _app_token(cfg)
    base = cfg.app.rstrip('/')
    keys = _dictionary_keys()
    key_namespaces = {key.split('.')[0] for key in keys}
    OUT.mkdir(parents=True, exist_ok=True)
    pages = _urls()
    if limit:
        pages = pages[:limit]
    problems: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        state = _storage_state(base, token)
        state['origins'][0]['localStorage'] += [
            {'name': 'ai-kit-theme', 'value': 'dark'},
            {'name': 'kube-frontend-locale', 'value': locale},
        ]
        context = browser.new_context(viewport={'width': 1440, 'height': 1000},
                                      locale='zh-CN' if locale == 'zh' else 'en-US',
                                      ignore_https_errors=True, storage_state=state)
        page = context.new_page()
        for scope, path in pages:
            url = f'{base}{path}'
            try:
                page.goto(url, wait_until='domcontentloaded', timeout=45_000)
                deadline = time.time() + 20
                while time.time() < deadline:
                    if page.locator('[data-ai-id$=":surface"], [data-ai-id$=":page"]').count():
                        break
                    page.wait_for_timeout(300)
                page.wait_for_timeout(1200)
                found = page.evaluate("""() => {
                  const pick = (el) => (el.textContent || '').trim();
                  const out = [];
                  const push = (where, text) => { if (text) out.push([where, text]); };
                  for (const dt of document.querySelectorAll('dt')) push('dt', pick(dt));
                  for (const th of document.querySelectorAll('th')) push('th', pick(th));
                  for (const el of document.querySelectorAll('[data-ai-id]')) push('ai', pick(el));
                  for (const el of document.querySelectorAll('h1,h2,h3,label,legend')) push('label', pick(el));
                  // Attribute-like text a reader also sees: placeholders, tooltips, accessible names.
                  for (const el of document.querySelectorAll('[placeholder]')) push('placeholder', el.getAttribute('placeholder'));
                  for (const el of document.querySelectorAll('[title]')) push('title', el.getAttribute('title'));
                  for (const el of document.querySelectorAll('[aria-label]')) push('aria', el.getAttribute('aria-label'));
                  return out;
                }""")
            except Exception as error:  # noqa: BLE001 - one page failing must not stop the scan
                problems.append({'page': path, 'where': 'load', 'text': f'{type(error).__name__}: {error}'})
                print(f'{path:60s} LOAD FAILED')
                continue
            # Also scan one detail page per list: attributes (dt) live there, and a missing
            # label shows up as a key only once the object is open.
            detail_url = None
            try:
                link = page.locator('[data-ai-row] a[href]').first
                if link.count():
                    detail_url = link.get_attribute('href')
            except Exception:  # noqa: BLE001
                detail_url = None
            if detail_url:
                try:
                    page.goto(f'{base}{detail_url}' if detail_url.startswith('/') else detail_url,
                              wait_until='domcontentloaded', timeout=45_000)
                    page.wait_for_timeout(2000)
                    detail_found = page.evaluate("""() => {
                  const pick = (el) => (el.textContent || '').trim();
                  const out = [];
                  const push = (where, text) => { if (text) out.push([where, text]); };
                  for (const dt of document.querySelectorAll('dt')) push('dt', pick(dt));
                  for (const th of document.querySelectorAll('th')) push('th', pick(th));
                  for (const el of document.querySelectorAll('[data-ai-id]')) push('ai', pick(el));
                  for (const el of document.querySelectorAll('h1,h2,h3,label,legend')) push('label', pick(el));
                  // Attribute-like text a reader also sees: placeholders, tooltips, accessible names.
                  for (const el of document.querySelectorAll('[placeholder]')) push('placeholder', el.getAttribute('placeholder'));
                  for (const el of document.querySelectorAll('[title]')) push('title', el.getAttribute('title'));
                  for (const el of document.querySelectorAll('[aria-label]')) push('aria', el.getAttribute('aria-label'));
                  return out;
                }""")
                    found = [list(x) for x in found] + [list(x) for x in detail_found]

                    # A dialog is where attribute labels and field names live too; open the first
                    # create/add entry and scan it, then close without submitting.
                    try:
                        trigger = page.locator('[data-ai-id$=":create"], [data-ai-id$=":add"], [data-ai-id$=":invite"]').first
                        if trigger.count() and trigger.is_visible():
                            trigger.click()
                            page.wait_for_timeout(1500)
                            dialog_found = page.evaluate("""() => {
                  const pick = (el) => (el.textContent || '').trim();
                  const out = [];
                  const push = (where, text) => { if (text) out.push([where, text]); };
                  for (const dt of document.querySelectorAll('dt')) push('dt', pick(dt));
                  for (const th of document.querySelectorAll('th')) push('th', pick(th));
                  for (const el of document.querySelectorAll('[data-ai-id]')) push('ai', pick(el));
                  for (const el of document.querySelectorAll('h1,h2,h3,label,legend')) push('label', pick(el));
                  // Attribute-like text a reader also sees: placeholders, tooltips, accessible names.
                  for (const el of document.querySelectorAll('[placeholder]')) push('placeholder', el.getAttribute('placeholder'));
                  for (const el of document.querySelectorAll('[title]')) push('title', el.getAttribute('title'));
                  for (const el of document.querySelectorAll('[aria-label]')) push('aria', el.getAttribute('aria-label'));
                  return out;
                }""")
                            found = [list(x) for x in found] + [list(x) for x in dialog_found]
                            page.keyboard.press('Escape')
                            page.wait_for_timeout(400)
                    except Exception:  # noqa: BLE001 - a dialog that will not open is not this scan's subject
                        pass
                except Exception:  # noqa: BLE001 - a broken detail page must not stop the scan
                    pass

            bad = []
            seen = set()
            for where, text in found:
                value = text.strip()
                if not value or value in seen:
                    continue
                seen.add(value)
                # A raw key: the value is exactly a dictionary key, or looks like one AND starts
                # with a namespace the dictionary actually uses (so object names like
                # `sh.helm.release.v1.x` and versions like `v1.28.15` do not trip it).
                looks_key = KEY_RE.match(value) and value.split('.')[0] in key_namespaces
                if value in keys or looks_key or value.lower() in RAW_ENUMS:
                    bad.append({'where': where, 'text': value})
            if bad:
                problems.append({'page': path, 'scope': scope, 'items': bad})
                print(f'{path:60s} {len(bad)} suspicious')
                for item in bad[:4]:
                    print(f'    [{item["where"]}] {item["text"]}')
            else:
                print(f'{path:60s} ok')
        browser.close()
    (OUT / f'report-{locale}.json').write_text(json.dumps({'locale': locale, 'pages': len(pages), 'problems': problems}, ensure_ascii=False, indent=1))
    print(f'\n{len(pages)} pages [{locale}], {len(problems)} with suspicious text')
    return 0 if not problems else 1


if __name__ == '__main__':
    raise SystemExit(main())