#!/usr/bin/env python3
"""Dependency-free static checks for the JB PARFUMS ERP UI."""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_FILE = ROOT / "index.html"
CSS_FILE = ROOT / "assets" / "css" / "styles.css"
JS_FILE = ROOT / "assets" / "js" / "app.js"

REQUIRED_IDS = {
    "sidebar", "view-root", "page-date",
    "product-dialog", "product-form", "toast-region",
    "menu-toggle", "mobile-scrim", "product-count",
    "breadcrumb-current", "page-eyebrow", "sidebar-collapse",
    "font-decrease", "font-increase", "font-scale-label", "order-detail-dialog",
    "auth-dialog", "auth-form", "auth-control", "connection-pill", "auth-feedback",
    "auth-email", "auth-password", "auth-otp-field", "auth-otp", "auth-resend-code", "auth-mode-switch",
}

REQUIRED_VIEWS = {
    'data-view="dashboard"',
    'data-view="products"',
    'data-view="inventory"',
    'data-view="orders"',
    'data-view="customers"',
    'data-view="billing"',
    'data-view="hr"',
}


class UIParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.local_refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            value = attrs.get(key, "")
            if value and not value.startswith(("http://", "https://", "data:", "#", "mailto:")):
                self.local_refs.append(value.split("?", 1)[0])


def fail(message):
    print("FAIL:", message)
    return 1



def report_hygiene(js, html):
    """Advisory source scan; reports candidates without changing or rejecting code."""
    combined = js + "\n" + html
    declarations = re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", js)
    candidates = sorted({
        name for name in declarations
        if len(re.findall(r"\b" + re.escape(name) + r"\b", combined)) == 1
    })
    if candidates:
        print("REVIEW: possible unreferenced functions (heuristic only): " + ", ".join(candidates))
    else:
        print("PASS: no obvious unreferenced named functions.")

    cache_features = {
        "Service Worker": r"navigator\.serviceWorker",
        "Cache API": r"\bcaches\.",
        "IndexedDB": r"\bindexedDB\b",
        "HTTP cache directives": r"Cache-Control|ETag|Last-Modified",
    }
    detected = [label for label, pattern in cache_features.items() if re.search(pattern, js + html, re.I)]
    if detected:
        print("INFO: app-level cache integrations found: " + ", ".join(detected))
    else:
        print("INFO: no Service Worker, Cache API or IndexedDB integration in app code.")
    if "localStorage" in js:
        print("INFO: localStorage is used for DEMO persistence; it is not an application cache.")

    delegated = {
        event: len(re.findall(r"document\.addEventListener\(\s*['\"]" + event + r"['\"]", js))
        for event in ("click", "input", "change", "keydown")
    }
    active = [event + "=" + str(count) for event, count in delegated.items() if count]
    if active:
        print("INFO: document-delegated event handlers: " + ", ".join(active))
        print("INFO: listener counts are advisory; distinct delegated handlers are not assumed to conflict.")


def main():
    required_files = (
        HTML_FILE,
        CSS_FILE,
        JS_FILE,
        ROOT / "playwright.config.mjs",
        ROOT / "package.json",
        ROOT / "tests" / "e2e" / "ui.spec.mjs",
        ROOT / "scripts" / "run-validation.sh",
        ROOT / "scripts" / "ai-repair.mjs",
        ROOT / "scripts" / "validate-ai-patch.mjs",
    )
    for path in required_files:
        if not path.is_file():
            return fail("Missing required file: " + str(path.relative_to(ROOT)))

    parser = UIParser()
    parser.feed(HTML_FILE.read_text(encoding="utf-8"))

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        return fail("Duplicate HTML IDs: " + ", ".join(duplicates))

    missing_ids = sorted(REQUIRED_IDS - set(parser.ids))
    if missing_ids:
        return fail("Missing required HTML IDs: " + ", ".join(missing_ids))

    html = HTML_FILE.read_text(encoding="utf-8")
    missing_views = sorted(view for view in REQUIRED_VIEWS if view not in html)
    if missing_views:
        return fail("Missing navigation views: " + ", ".join(missing_views))

    missing_refs = [
        ref for ref in parser.local_refs
        if not (ROOT / ref).is_file()
    ]
    if missing_refs:
        return fail("Broken local asset references: " + ", ".join(missing_refs))

    css = CSS_FILE.read_text(encoding="utf-8")
    if css.count("{") != css.count("}"):
        return fail("CSS brace count is unbalanced.")
    for marker in ('data-font-scale="normal"', 'data-font-scale="large"', 'data-font-scale="larger"'):
        if marker not in css:
            return fail("Missing font scale style: " + marker)

    js = JS_FILE.read_text(encoding="utf-8")
    for marker in ("new FormData(form)", "renderView()", "function setFontLevel", "function setSidebarCollapsed", "function showOrderDetails", "function saveOrderStatus"):
        if marker not in js:
            return fail("Expected UI hook was not found: " + marker)

    report_hygiene(js, html)
    print("PASS: required files, IDs, navigation, local assets, CSS and UI hooks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
