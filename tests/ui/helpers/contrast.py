"""WCAG contrast audit for a rendered page.

Why a browser-side audit instead of asserting on class names: the theme colours
live in SCSS tokens and are applied through several wrappers (`Card`, `Table`,
`Level`), so the only reliable question is "what colour is this text actually
painted on". This walks the text nodes of a container, resolves the effective
background by climbing ancestors until an opaque one is found, and computes the
WCAG 2.1 ratio.

Usage:

    violations = audit(page, "main")
    assert violations == []
"""

from __future__ import annotations

from typing import Any

# Runs in the page. Returns one entry per failing text node.
_AUDIT_JS = """
(args) => {
  const root = document.querySelector(args.selector)
  if (!root) return [{ selector: args.selector, reason: 'container not found' }]

  const parse = (value) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(value || '')
    if (!m) return null
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()))
    if (parts.length < 3) return null
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }

  const lum = ({ r, g, b }) => {
    const f = (c) => {
      const v = c / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })

  const background = (el) => {
    let node = el
    const layers = []
    while (node && node !== document.documentElement) {
      const color = parse(getComputedStyle(node).backgroundColor)
      if (color && color.a > 0) {
        layers.push(color)
        if (color.a >= 1) break
      }
      node = node.parentElement
    }
    const htmlBg = parse(getComputedStyle(document.documentElement).backgroundColor)
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor)
    const pageBg = htmlBg && htmlBg.a > 0 ? htmlBg : bodyBg
    let base = pageBg && pageBg.a >= 1 ? pageBg : { r: 20, g: 33, b: 90, a: 1 }
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      base = blend(layers[i], base)
    }
    return base
  }

  const ratio = (a, b) => {
    const la = lum(a)
    const lb = lum(b)
    const hi = Math.max(la, lb)
    const lo = Math.min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
  }

  const describe = (el) => {
    const cls = (el.className || '').toString().trim().split(/\\s+/).filter(Boolean).join('.')
    const text = (el.textContent || '').trim().slice(0, 40)
    return { tag: el.tagName.toLowerCase(), cls, text }
  }

  const out = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  let node = walker.nextNode()
  while (node) {
    const text = (node.textContent || '').trim()
    if (text) {
      const el = node.parentElement
      const style = el ? getComputedStyle(el) : null
      const visible = el
        && style
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && el.getClientRects().length > 0
        && parseFloat(style.opacity || '1') > 0
      if (visible) {
        const fg = parse(style.color)
        if (fg) {
          const bg = background(el)
          const painted = fg.a >= 1 ? fg : blend(fg, bg)
          const value = ratio(painted, bg)
          const key = `${describe(el).cls}|${text}`
          if (value < args.minRatio && !seen.has(key)) {
            seen.add(key)
            out.push({
              ...describe(el),
              color: style.color,
              background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
              ratio: Math.round(value * 100) / 100,
              minRatio: args.minRatio,
            })
          }
        }
      }
    }
    node = walker.nextNode()
  }
  return out
}
"""


def audit(page: Any, selector: str = "main", min_ratio: float = 4.5) -> list[dict]:
    """Return the text nodes in `selector` whose contrast is below `min_ratio`."""
    return page.evaluate(_AUDIT_JS, {"selector": selector, "minRatio": min_ratio})


def audit_all(page: Any, selectors: list[str], min_ratio: float = 4.5) -> list[dict]:
    violations: list[dict] = []
    for selector in selectors:
        violations.extend(audit(page, selector, min_ratio))
    return violations


def untranslated_keys(page: Any) -> list[str]:
    """Visible text that looks like an i18n key rather than a translation.

    The console falls back to the key itself when a string is missing, so a
    missing translation shows up as `SOMETHING_PL` / `SOMETHING_DESC`.
    """
    return page.evaluate(
        """
        () => {
          const text = document.body.innerText || ''
          const found = text.match(/\\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\\b/g) || []
          return Array.from(new Set(found)).filter((key) => key.length > 3)
        }
        """
    )
