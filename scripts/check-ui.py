#!/usr/bin/env python3
"""Low-cost static checks for the JB PARFUMS UI foundation."""

from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_FILE = ROOT / "index.html"
CSS_FILE = ROOT / "assets" / "css" / "styles.css"
JS_FILE = ROOT / "assets" / "js" / "app.js"

REQUIRED_IDS = {
    "sidebar", "view-root", "global-search", "page-date",
    "product-dialog", "product-form", "toast-region",
    "menu-toggle", "mobile-scrim", "product-count",
    "breadcrumb-current", "page-eyebrow",
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


def main():
    for path in (HTML_FILE, CSS_FILE, JS_FILE):
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

    missing_refs = [
        ref for ref in parser.local_refs
        if not (ROOT / ref).is_file()
    ]
    if missing_refs:
        return fail("Broken local asset references: " + ", ".join(missing_refs))

    css = CSS_FILE.read_text(encoding="utf-8")
    if css.count("{") != css.count("}"):
        return fail("CSS brace count is unbalanced.")

    js = JS_FILE.read_text(encoding="utf-8")
    if "new FormData(form)" not in js or "renderView()" not in js:
        return fail("Expected UI form/render hooks were not found.")

    print("PASS: required files, IDs, local assets, CSS braces and UI hooks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
