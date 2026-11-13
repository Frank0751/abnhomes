"""Visual check for i18n: French home, Arabic home (RTL), French booking."""
import os
import re

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = "/home/z/my-project/scripts/shots"
ADMIN_EMAIL = "admin@abnhomes.com.gh"
ADMIN_PASSWORD = "AbnHomes2026!"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()

    for lang, name in [("fr", "home_fr"), ("ar", "home_ar"), ("es", "home_es")]:
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script(f"localStorage.setItem('abn-lang', '{lang}')")
        page = ctx.new_page()
        page.goto(f"{BASE}/", wait_until="networkidle")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/{name}.png")
        html_attrs = page.evaluate("() => ({lang: document.documentElement.lang, dir: document.documentElement.dir})")
        print(lang, html_attrs)
        ctx.close()

    browser.close()
print("done")
